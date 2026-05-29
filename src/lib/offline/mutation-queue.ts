import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Entry, Manga_Entry } from "@/api/generated/types"
import { logger } from "@/lib/utils/logger"
import { createMMKV } from "react-native-mmkv"

const store = createMMKV({ id: "seanime-mutation-queue" })

const QUEUE_KEY = "queue"
const QUEUE_VERSION_KEY = "__version__"
const CURRENT_VERSION = 1

type PendingMutationMediaType = "anime" | "manga"

type PendingMutationListDataSnapshot = {
    exists: boolean
    progress: number | null
    score: number | null
    status: string | null
    repeat: number | null
    startedAt: string | null
    completedAt: string | null
}

export type PendingMutationConflictGuard = {
    kind: "list-data"
    mediaType: PendingMutationMediaType
    mediaId: number
    snapshot: PendingMutationListDataSnapshot
}

type EntryListData = NonNullable<Anime_Entry["listData"] | Manga_Entry["listData"]>

export type PendingMutation = {
    /** Unique identifier for deduplication/tracking */
    id: string
    /** API endpoint path */
    endpoint: string
    /** HTTP method */
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    /** JSON-serialized request body */
    payloadJson: string
    /** Epoch ms when the mutation was queued */
    createdAt: number
    /** Number of failed replay attempts */
    retryCount: number
    /** Last error message if replay failed */
    lastError?: string
    /** upstream state that must still match before replay */
    conflictGuard?: PendingMutationConflictGuard
}

////////////////////////// Internal helpers

function readQueue(): PendingMutation[] {
    // version gate
    const version = store.getNumber(QUEUE_VERSION_KEY)
    if (version !== CURRENT_VERSION) {
        store.set(QUEUE_VERSION_KEY, CURRENT_VERSION)
        store.set(QUEUE_KEY, "[]")
        return []
    }

    const raw = store.getString(QUEUE_KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw) as PendingMutation[]
    }
    catch {
        return []
    }
}

function writeQueue(queue: PendingMutation[]): void {
    store.set(QUEUE_KEY, JSON.stringify(queue))
}

function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function snapshotListData(listData: EntryListData | undefined): PendingMutationListDataSnapshot {
    return {
        exists: !!listData,
        progress: listData?.progress ?? null,
        score: listData?.score ?? null,
        status: listData?.status ?? null,
        repeat: listData?.repeat ?? null,
        startedAt: listData?.startedAt ?? null,
        completedAt: listData?.completedAt ?? null,
    }
}

function listDataSnapshotsEqual(left: PendingMutationListDataSnapshot, right: PendingMutationListDataSnapshot): boolean {
    return left.exists === right.exists
        && left.progress === right.progress
        && left.score === right.score
        && left.status === right.status
        && left.repeat === right.repeat
        && left.startedAt === right.startedAt
        && left.completedAt === right.completedAt
}

async function getCurrentListDataSnapshot(
    serverUrl: string,
    guard: PendingMutationConflictGuard,
): Promise<PendingMutationListDataSnapshot> {
    if (guard.mediaType === "anime") {
        const entry = await buildSeaQuery<Anime_Entry>({
            serverUrl,
            endpoint: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.endpoint.replace("{id}", String(guard.mediaId)),
            method: API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.methods[0],
            muteError: true,
        })

        return snapshotListData(entry?.listData)
    }

    const entry = await buildSeaQuery<Manga_Entry>({
        serverUrl,
        endpoint: API_ENDPOINTS.MANGA.GetMangaEntry.endpoint.replace("{id}", String(guard.mediaId)),
        method: API_ENDPOINTS.MANGA.GetMangaEntry.methods[0],
        muteError: true,
    })

    return snapshotListData(entry?.listData)
}

async function getConflictReason(serverUrl: string, guard: PendingMutationConflictGuard): Promise<string | null> {
    const currentSnapshot = await getCurrentListDataSnapshot(serverUrl, guard)

    if (listDataSnapshotsEqual(guard.snapshot, currentSnapshot)) {
        return null
    }

    return `${guard.mediaType} #${guard.mediaId} changed upstream`
}

export function createListDataConflictGuard(
    mediaType: PendingMutationMediaType,
    mediaId: number,
    entry: Anime_Entry | Manga_Entry | undefined,
): PendingMutationConflictGuard {
    return {
        kind: "list-data",
        mediaType,
        mediaId,
        snapshot: snapshotListData(entry?.listData),
    }
}

////////////////////////// API

/**
 * Enqueue a mutation for later replay.
 */
export function enqueueMutation(
    endpoint: string,
    method: PendingMutation["method"],
    payload: unknown,
    conflictGuard?: PendingMutationConflictGuard,
): void {
    const mutation: PendingMutation = {
        id: generateId(),
        endpoint,
        method,
        payloadJson: JSON.stringify(payload),
        createdAt: Date.now(),
        retryCount: 0,
        conflictGuard,
    }
    const queue = readQueue()
    queue.push(mutation)
    writeQueue(queue)

    logger("mutation-queue").info(`Queued mutation: ${method} ${endpoint} (${queue.length} pending)`)
}

export function getPendingMutations(): PendingMutation[] {
    return readQueue()
}

export function getPendingMutationCount(): number {
    return readQueue().length
}

export function removeMutation(id: string): void {
    const queue = readQueue().filter(m => m.id !== id)
    writeQueue(queue)
}

export function markMutationFailed(id: string, error: string): void {
    const queue = readQueue()
    const mutation = queue.find(m => m.id === id)
    if (mutation) {
        mutation.retryCount += 1
        mutation.lastError = error
    }
    writeQueue(queue)
}

/**
 * Drain the mutation queue, replaying each mutation against the server.
 * Returns the number of successfully replayed mutations.
 *
 * Stops on the first failure to preserve ordering (later mutations may depend on earlier ones succeeding).
 */
export async function drainMutationQueue(serverUrl: string): Promise<{
    processed: number
    skippedConflicts: number
    remaining: number
    error?: string
}> {
    const queue = readQueue()
    if (queue.length === 0) {
        return { processed: 0, skippedConflicts: 0, remaining: 0 }
    }

    logger("mutation-queue").info(`Draining ${queue.length} pending mutations`)

    let processed = 0
    let skippedConflicts = 0

    for (const mutation of queue) {
        // skip mutations that have failed too many times
        if (mutation.retryCount >= 5) {
            logger("mutation-queue").warning(
                `Skipping mutation ${mutation.id} after ${mutation.retryCount} failures: ${mutation.lastError}`,
            )
            removeMutation(mutation.id)
            processed++
            continue
        }

        try {
            const payload = JSON.parse(mutation.payloadJson)
            const conflictReason = mutation.conflictGuard
                ? await getConflictReason(serverUrl, mutation.conflictGuard)
                : null

            if (conflictReason) {
                removeMutation(mutation.id)
                skippedConflicts++
                logger("mutation-queue").warning(`Skipped offline mutation ${mutation.id}: ${conflictReason}`)
                continue
            }

            await buildSeaQuery({
                serverUrl,
                endpoint: mutation.endpoint,
                method: mutation.method,
                data: payload,
            })
            removeMutation(mutation.id)
            processed++
            logger("mutation-queue").info(`Replayed: ${mutation.method} ${mutation.endpoint}`)
        }
        catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            markMutationFailed(mutation.id, errorMsg)
            logger("mutation-queue").warning(
                `Failed to replay ${mutation.method} ${mutation.endpoint}: ${errorMsg}`,
            )
            // stop on first failure to preserve ordering
            return {
                processed,
                skippedConflicts,
                remaining: getPendingMutationCount(),
                error: errorMsg,
            }
        }
    }

    return { processed, skippedConflicts, remaining: 0 }
}

export function clearMutationQueue(): void {
    writeQueue([])
}
