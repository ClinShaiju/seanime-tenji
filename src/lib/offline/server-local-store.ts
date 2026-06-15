import type { Anime_Entry, Anime_Episode, Status } from "@/api/generated/types"
import { useServerStatus, useServerUrl } from "@/atoms/server.atoms"
import { useMemo, useSyncExternalStore } from "react"
import { createMMKV } from "react-native-mmkv"

const store = createMMKV({ id: "seanime-server-local-entries" })

const META_KEY = "catalog"
const REVISION_KEY = "revision"
const CURRENT_SCHEMA_VERSION = 1

export type ServerLocalIdentity = {
    key: string
    serverUrl: string
    os: "android" | "ios"
    dataDir: string
}

export type ServerLocalAnimeRecord = {
    mediaId: number
    title: string
    coverImageUrl?: string
    bannerImageUrl?: string
    payload: string
    localFilePaths: string[]
    savedAt: number
}

type ServerLocalCatalogMeta = {
    schemaVersion: number
    identity: ServerLocalIdentity
    mediaIds: number[]
    updatedAt: number
}

function recordKey(mediaId: number): string {
    return `anime:${mediaId}`
}

function readJson<T>(key: string): T | undefined {
    const raw = store.getString(key)
    if (!raw) return undefined

    try {
        return JSON.parse(raw) as T
    }
    catch {
        return undefined
    }
}

function readMeta(): ServerLocalCatalogMeta | undefined {
    const meta = readJson<ServerLocalCatalogMeta>(META_KEY)
    if (meta?.schemaVersion !== CURRENT_SCHEMA_VERSION) return undefined
    return meta
}

function notifyChange(): void {
    const revision = store.getNumber(REVISION_KEY) ?? 0
    store.set(REVISION_KEY, revision + 1)
}

function subscribeToChanges(callback: () => void): () => void {
    const listener = store.addOnValueChangedListener((key) => {
        if (key === REVISION_KEY) callback()
    })
    return () => listener.remove()
}

function getRevision(): number {
    return store.getNumber(REVISION_KEY) ?? 0
}

export function normalizeServerLocalUrl(serverUrl: string): string {
    try {
        const url = new URL(serverUrl)
        url.hash = ""
        url.search = ""
        url.pathname = ""
        return url.origin.toLowerCase()
    }
    catch {
        return serverUrl.trim().replace(/\/+$/, "").toLowerCase()
    }
}

export function createServerLocalIdentity(
    serverUrl: string | null | undefined,
    status: Status | null | undefined,
): ServerLocalIdentity | null {
    if (!serverUrl || !status?.dataDir) return null

    const os = status.os?.toLowerCase()
    if (os !== "android" && os !== "ios") return null

    const normalizedUrl = normalizeServerLocalUrl(serverUrl)
    const keyDataDir = os === "ios" ? "Documents" : status.dataDir
    return {
        key: `${os}:${keyDataDir}:${normalizedUrl}`,
        serverUrl: normalizedUrl,
        os,
        dataDir: status.dataDir,
    }
}

export function parseServerLocalAnimeEntry(record: ServerLocalAnimeRecord | undefined): Anime_Entry | undefined {
    if (!record) return undefined

    try {
        const entry = JSON.parse(record.payload) as Anime_Entry
        return entry.mediaId === record.mediaId && entry.media ? entry : undefined
    }
    catch {
        return undefined
    }
}

export function filterServerLocalAnimeEntry(
    entry: Anime_Entry,
    localFilePaths: ReadonlySet<string>,
): Anime_Entry {
    const episodes = (entry.episodes ?? []).filter(episode => (
        !!episode.localFile?.path && localFilePaths.has(episode.localFile.path)
    ))
    const localFiles = (entry.localFiles ?? []).filter(file => localFilePaths.has(file.path))
    const nextEpisode = entry.nextEpisode?.localFile?.path && localFilePaths.has(entry.nextEpisode.localFile.path)
        ? entry.nextEpisode
        : undefined

    return {
        ...entry,
        episodes,
        localFiles,
        nextEpisode,
        currentEpisodeCount: episodes.length,
    }
}

export function getServerLocalAnimeRecords(identity: ServerLocalIdentity | null): ServerLocalAnimeRecord[] {
    const meta = readMeta()
    if (!identity || !meta || meta.identity.key !== identity.key) return []

    return meta.mediaIds.flatMap(mediaId => {
        const record = readJson<ServerLocalAnimeRecord>(recordKey(mediaId))
        return record ? [record] : []
    })
}

export function getServerLocalAnimeRecord(
    mediaId: number,
    identity: ServerLocalIdentity | null,
): ServerLocalAnimeRecord | undefined {
    const meta = readMeta()
    if (!identity || !meta || meta.identity.key !== identity.key || !meta.mediaIds.includes(mediaId)) {
        return undefined
    }

    return readJson<ServerLocalAnimeRecord>(recordKey(mediaId))
}

export function saveServerLocalAnimeRecords(
    identity: ServerLocalIdentity,
    records: ServerLocalAnimeRecord[],
    completeRefresh: boolean,
): void {
    const currentMeta = readMeta()

    if (currentMeta && currentMeta.identity.key !== identity.key && !completeRefresh) {
        return
    }

    const storedIds = currentMeta?.mediaIds ?? []
    const existingIds = currentMeta?.identity.key === identity.key
        ? currentMeta.mediaIds
        : []
    const incomingIds = records.map(record => record.mediaId)
    const nextIds = completeRefresh
        ? incomingIds
        : Array.from(new Set([...existingIds, ...incomingIds]))

    if (completeRefresh) {
        for (const mediaId of storedIds) {
            if (!incomingIds.includes(mediaId)) {
                store.remove(recordKey(mediaId))
            }
        }
    }

    for (const record of records) {
        store.set(recordKey(record.mediaId), JSON.stringify(record))
    }

    const meta: ServerLocalCatalogMeta = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        identity,
        mediaIds: nextIds,
        updatedAt: Date.now(),
    }
    store.set(META_KEY, JSON.stringify(meta))
    notifyChange()
}

export function updateServerLocalAnimeProgress(
    mediaId: number,
    episodeNumber: number,
    identity: ServerLocalIdentity | null,
): void {
    const meta = readMeta()
    if (!identity || meta?.identity.key !== identity.key || !meta.mediaIds.includes(mediaId)) return

    const record = readJson<ServerLocalAnimeRecord>(recordKey(mediaId))
    const entry = parseServerLocalAnimeEntry(record)
    if (!record || !entry) return

    const nextProgress = Math.max(entry.listData?.progress ?? 0, episodeNumber)
    const updatedEntry: Anime_Entry = {
        ...entry,
        listData: {
            ...(entry.listData ?? {}),
            progress: nextProgress,
        },
    }

    store.set(recordKey(mediaId), JSON.stringify({
        ...record,
        payload: JSON.stringify(updatedEntry),
    } satisfies ServerLocalAnimeRecord))
    notifyChange()
}

export function useServerLocalIdentity(): ServerLocalIdentity | null {
    const serverUrl = useServerUrl()
    const status = useServerStatus()
    return useMemo(() => createServerLocalIdentity(serverUrl, status), [serverUrl, status])
}

export function useServerLocalAnimeRecords(): ServerLocalAnimeRecord[] {
    const identity = useServerLocalIdentity()
    const revision = useSyncExternalStore(subscribeToChanges, getRevision)

    return useMemo(() => {
        void revision
        return getServerLocalAnimeRecords(identity)
    }, [identity, revision])
}

export function useServerLocalAnimeRecord(mediaId: number | undefined): ServerLocalAnimeRecord | undefined {
    const identity = useServerLocalIdentity()
    const revision = useSyncExternalStore(subscribeToChanges, getRevision)

    return useMemo(() => {
        void revision
        if (!mediaId) return undefined
        return getServerLocalAnimeRecord(mediaId, identity)
    }, [identity, mediaId, revision])
}

export function useServerLocalAnimeEntry(mediaId: number | undefined): Anime_Entry | undefined {
    const record = useServerLocalAnimeRecord(mediaId)
    return useMemo(() => parseServerLocalAnimeEntry(record), [record])
}

export function getServerLocalEpisodeCount(record: ServerLocalAnimeRecord): number {
    return parseServerLocalAnimeEntry(record)?.episodes?.length ?? record.localFilePaths.length
}

export function isServerLocalEpisode(episode: Anime_Episode, record: ServerLocalAnimeRecord | undefined): boolean {
    return !!episode.localFile?.path && !!record?.localFilePaths.includes(episode.localFile.path)
}
