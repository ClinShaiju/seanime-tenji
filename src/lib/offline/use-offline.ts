import {
    DeleteAnilistListEntry_Variables,
    EditAnilistListEntry_Variables,
    UpdateAnimeEntryProgress_Variables,
    UpdateMangaProgress_Variables,
} from "@/api/generated/endpoint.types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Entry, Manga_Entry } from "@/api/generated/types"
import { useServerUrl } from "@/atoms/server.atoms"
import { getConnectionSnapshot, subscribeToConnectionState } from "@/lib/connection-state"
import { syncManualOfflineConnectionState } from "@/lib/connection-state"
import { manualOfflineModeAtom } from "@/lib/offline/manual-offline-mode"
import { enqueueMutation, getPendingMutationCount, type PendingMutationConflictGuard } from "@/lib/offline/mutation-queue"
import {
    getAllOfflineEntries,
    getOfflineEntry,
    isEntrySavedOffline,
    type OfflineEntryType,
    refreshOfflineEntry,
    removeOfflineEntry,
    type SavedOfflineEntry,
    saveEntryOffline,
} from "@/lib/offline/offline-entry-store"
import { toast } from "@/lib/utils/toast"
import { useAtom } from "jotai"
import { useAtomValue } from "jotai"
import { type SetStateAction, useCallback, useMemo, useSyncExternalStore } from "react"
import { createMMKV } from "react-native-mmkv"

////////////////////////// External store subscription for reactive updates

const changeNotifier = createMMKV({ id: "seanime-offline-notifier" })
const NOTIFIER_KEY = "rev"

function notifyChange(): void {
    // bump a revision counter so subscribers re-render
    const rev = changeNotifier.getNumber(NOTIFIER_KEY) ?? 0
    changeNotifier.set(NOTIFIER_KEY, rev + 1)
}

function subscribeToChanges(callback: () => void): () => void {
    const listener = changeNotifier.addOnValueChangedListener((key) => {
        if (key === NOTIFIER_KEY) callback()
    })
    return () => listener.remove()
}

function getRevision(): number {
    return changeNotifier.getNumber(NOTIFIER_KEY) ?? 0
}

function useConnectionSnapshot() {
    return useSyncExternalStore(subscribeToConnectionState, getConnectionSnapshot)
}

function getEffectiveConnectionState({
    hasServerUrl,
    manualOffline,
    hasNetwork,
    serverReachability,
}: {
    hasServerUrl: boolean
    manualOffline: boolean
    hasNetwork: boolean
    serverReachability: ReturnType<typeof getConnectionSnapshot>["serverReachability"]
}): "idle" | "connecting" | "connected" | "disconnected" {
    if (!hasServerUrl) return "idle"
    if (manualOffline) return "disconnected"
    if (!hasNetwork || serverReachability === "unreachable") return "disconnected"
    if (serverReachability === "reachable") return "connected"
    return "connecting"
}

////////////////////////// Hooks

/**
 * Check if a specific entry is saved for offline.
 * Reactively updates when entries are added/removed.
 */
export function useIsEntrySavedOffline(type: OfflineEntryType, anilistId: number | undefined): boolean {
    const rev = useSyncExternalStore(subscribeToChanges, getRevision)
    return useMemo(() => {
        // rev is used to trigger recalculation
        void rev
        if (!anilistId) return false
        return isEntrySavedOffline(type, anilistId)
    }, [type, anilistId, rev])
}

/**
 * Get all offline entries of a given type.
 * Reactively updates when entries are added/removed.
 */
export function useOfflineEntries(type: OfflineEntryType): SavedOfflineEntry[] {
    const rev = useSyncExternalStore(subscribeToChanges, getRevision)
    return useMemo(() => {
        void rev
        return getAllOfflineEntries(type)
    }, [type, rev])
}

/**
 * Get a single offline entry by ID.
 * Reactively updates when entries change.
 */
export function useOfflineEntry(type: OfflineEntryType, anilistId: number | undefined): SavedOfflineEntry | undefined {
    const rev = useSyncExternalStore(subscribeToChanges, getRevision)
    return useMemo(() => {
        void rev
        if (!anilistId) return undefined
        return getOfflineEntry(type, anilistId)
    }, [type, anilistId, rev])
}

/**
 * Get the number of pending offline mutations.
 * Reactively updates when the queue changes.
 */
export function usePendingMutationCount(): number {
    const rev = useSyncExternalStore(subscribeToChanges, getRevision)
    return useMemo(() => {
        void rev
        return getPendingMutationCount()
    }, [rev])
}

/**
 * Whether the app should keep treating the server as available.
 * Returns false only when offline is explicit or reachability has been confirmed as lost.
 */
export function useIsServerConnected(): boolean {
    const serverUrl = useServerUrl()
    const manualOffline = useAtomValue(manualOfflineModeAtom)
    const connectionSnapshot = useConnectionSnapshot()

    const connectionState = getEffectiveConnectionState({
        hasServerUrl: Boolean(serverUrl),
        manualOffline,
        hasNetwork: connectionSnapshot.hasNetwork,
        serverReachability: connectionSnapshot.serverReachability,
    })

    return connectionState !== "idle" && connectionState !== "disconnected"
}

export function useServerConnectionState(): "idle" | "connecting" | "connected" | "disconnected" {
    const serverUrl = useServerUrl()
    const manualOffline = useAtomValue(manualOfflineModeAtom)
    const connectionSnapshot = useConnectionSnapshot()

    return getEffectiveConnectionState({
        hasServerUrl: Boolean(serverUrl),
        manualOffline,
        hasNetwork: connectionSnapshot.hasNetwork,
        serverReachability: connectionSnapshot.serverReachability,
    })
}

export function useManualOfflineMode() {
    const [manualOffline, setManualOffline] = useAtom(manualOfflineModeAtom)

    const setManualOfflineMode = useCallback((nextValue: SetStateAction<boolean>) => {
        const resolvedValue = typeof nextValue === "function"
            ? nextValue(manualOffline)
            : nextValue

        setManualOffline(resolvedValue)
        syncManualOfflineConnectionState()
    }, [manualOffline, setManualOffline])

    return [manualOffline, setManualOfflineMode] as const
}

/**
 * Save an anime entry for offline viewing.
 * Also refreshes the offline snapshot if the entry was already saved.
 */
export function useSaveAnimeEntryOffline() {
    return useCallback((entry: Anime_Entry) => {
        const title =
            entry.media?.title?.english ||
            entry.media?.title?.romaji ||
            entry.media?.title?.userPreferred ||
            `Anime #${entry.mediaId}`

        saveEntryOffline({
            anilistId: entry.mediaId,
            type: "anime",
            title,
            coverImageUrl: entry.media?.coverImage?.large ?? entry.media?.coverImage?.extraLarge,
            payload: JSON.stringify(entry),
            savedAt: Date.now(),
        })
        notifyChange()
        toast.success(`"${title}" saved for offline`)
    }, [])
}

/**
 * Save a manga entry for offline viewing.
 */
export function useSaveMangaEntryOffline() {
    return useCallback((entry: Manga_Entry) => {
        const title =
            entry.media?.title?.english ||
            entry.media?.title?.romaji ||
            entry.media?.title?.userPreferred ||
            `Manga #${entry.mediaId}`

        saveEntryOffline({
            anilistId: entry.mediaId,
            type: "manga",
            title,
            coverImageUrl: entry.media?.coverImage?.large ?? entry.media?.coverImage?.extraLarge,
            payload: JSON.stringify(entry),
            savedAt: Date.now(),
        })
        notifyChange()
        toast.success(`"${title}" saved for offline`)
    }, [])
}

/**
 * Remove an entry from offline storage.
 */
export function useRemoveOfflineEntry() {
    return useCallback((type: OfflineEntryType, anilistId: number) => {
        removeOfflineEntry(type, anilistId)
        notifyChange()
        toast.info("Removed from offline")
    }, [])
}

/**
 * Toggle an anime entry's offline saved state.
 */
export function useToggleAnimeOffline(entry: Anime_Entry | undefined) {
    const save = useSaveAnimeEntryOffline()
    const remove = useRemoveOfflineEntry()
    const isSaved = useIsEntrySavedOffline("anime", entry?.mediaId)

    return useMemo(() => ({
        isSaved,
        toggle: () => {
            if (!entry) return
            if (isSaved) {
                remove("anime", entry.mediaId)
            } else {
                save(entry)
            }
        },
    }), [entry, isSaved, save, remove])
}

/**
 * Queue an offline-aware progress update.
 * If connected, this returns false and the caller should use the normal mutation.
 * If disconnected, this queues the mutation and returns true.
 */
export function useOfflineProgressUpdate() {
    const isConnected = useIsServerConnected()

    return useCallback(
        (variables: UpdateAnimeEntryProgress_Variables, conflictGuard?: PendingMutationConflictGuard): boolean => {
            if (isConnected) return false

            enqueueMutation(
                API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.endpoint,
                API_ENDPOINTS.ANIME_ENTRIES.UpdateAnimeEntryProgress.methods[0],
                variables,
                conflictGuard,
            )
            notifyChange()
            toast.info("Progress update queued for sync")
            return true
        },
        [isConnected],
    )
}

/**
 * Queue an offline-aware manga progress update.
 * If connected, this returns false and the caller should use the normal mutation.
 * If disconnected, this queues the mutation and returns true.
 */
export function useOfflineMangaProgressUpdate() {
    const isConnected = useIsServerConnected()

    return useCallback(
        (variables: UpdateMangaProgress_Variables, conflictGuard?: PendingMutationConflictGuard): boolean => {
            if (isConnected) return false

            enqueueMutation(
                API_ENDPOINTS.MANGA.UpdateMangaProgress.endpoint,
                API_ENDPOINTS.MANGA.UpdateMangaProgress.methods[0],
                variables,
                conflictGuard,
            )
            notifyChange()
            toast.info("Manga progress queued for sync")
            return true
        },
        [isConnected],
    )
}

/**
 * Queue an offline-aware list entry edit.
 * If connected, returns false and the caller should use the normal mutation.
 * If disconnected, queues the mutation and returns true.
 */
export function useOfflineListEntryEdit() {
    const isConnected = useIsServerConnected()

    return useCallback(
        (variables: EditAnilistListEntry_Variables, conflictGuard?: PendingMutationConflictGuard): boolean => {
            if (isConnected) return false

            enqueueMutation(
                API_ENDPOINTS.ANILIST.EditAnilistListEntry.endpoint,
                API_ENDPOINTS.ANILIST.EditAnilistListEntry.methods[0],
                variables,
                conflictGuard,
            )
            notifyChange()
            toast.info("List update queued for sync")
            return true
        },
        [isConnected],
    )
}

/**
 * Queue an offline-aware list entry deletion.
 * If connected, returns false and the caller should use the normal mutation.
 * If disconnected, queues the mutation and returns true.
 */
export function useOfflineListEntryDelete() {
    const isConnected = useIsServerConnected()

    return useCallback(
        (variables: DeleteAnilistListEntry_Variables, conflictGuard?: PendingMutationConflictGuard): boolean => {
            if (isConnected) return false

            enqueueMutation(
                API_ENDPOINTS.ANILIST.DeleteAnilistListEntry.endpoint,
                API_ENDPOINTS.ANILIST.DeleteAnilistListEntry.methods[0],
                variables,
                conflictGuard,
            )
            notifyChange()
            toast.info("List deletion queued for sync")
            return true
        },
        [isConnected],
    )
}

/**
 * Refresh an offline entry's cached payload with fresh server data.
 * Call this after a successful fetch to keep the offline copy current.
 */
export function useRefreshOfflineEntryPayload() {
    return useCallback((type: OfflineEntryType, anilistId: number, freshEntry: Anime_Entry | Manga_Entry) => {
        if (!isEntrySavedOffline(type, anilistId)) return

        const title =
            freshEntry.media?.title?.english ||
            freshEntry.media?.title?.romaji ||
            freshEntry.media?.title?.userPreferred

        refreshOfflineEntry(
            type,
            anilistId,
            JSON.stringify(freshEntry),
            title ?? undefined,
            freshEntry.media?.coverImage?.large ?? freshEntry.media?.coverImage?.extraLarge ?? undefined,
        )
    }, [])
}
