export {
    type OfflineEntryType,
    type SavedOfflineEntry,
    saveEntryOffline,
    removeOfflineEntry,
    getOfflineEntry,
    isEntrySavedOffline,
    getAllOfflineEntries,
    getOfflineEntryCount,
    refreshOfflineEntry,
    clearAllOfflineEntries,
} from "./offline-entry-store"

export {
    type DownloadEntrySnapshotType,
    saveAnimeDownloadEntrySnapshot,
    saveMangaDownloadEntrySnapshot,
    getAnimeDownloadEntrySnapshot,
    getMangaDownloadEntrySnapshot,
    updateAnimeDownloadEntrySnapshotProgress,
    removeDownloadEntrySnapshot,
} from "./download-entry-snapshot-store"

export {
    type PendingMutation,
    type PendingMutationConflictGuard,
    createListDataConflictGuard,
    enqueueMutation,
    getPendingMutations,
    getPendingMutationCount,
    removeMutation,
    drainMutationQueue,
    clearMutationQueue,
} from "./mutation-queue"

// Services
export { useOfflineSyncService } from "./sync-service"
export { useDownloadSnapshotRefreshService } from "./download-snapshot-refresh-service"
export { useServerLocalSyncService, requestServerLocalSync } from "./server-local-sync-service"

export {
    type ServerLocalIdentity,
    type ServerLocalAnimeRecord,
    createServerLocalIdentity,
    normalizeServerLocalUrl,
    parseServerLocalAnimeEntry,
    filterServerLocalAnimeEntry,
    getServerLocalAnimeRecords,
    getServerLocalAnimeRecord,
    saveServerLocalAnimeRecords,
    updateServerLocalAnimeProgress,
    useServerLocalIdentity,
    useServerLocalAnimeRecords,
    useServerLocalAnimeRecord,
    useServerLocalAnimeEntry,
    getServerLocalEpisodeCount,
    isServerLocalEpisode,
} from "./server-local-store"

// React hooks
export {
    useIsEntrySavedOffline,
    useOfflineEntries,
    useOfflineEntry,
    usePendingMutationCount,
    useIsServerConnected,
    useServerConnectionState,
    useManualOfflineMode,
    useSaveAnimeEntryOffline,
    useSaveMangaEntryOffline,
    useRemoveOfflineEntry,
    useToggleAnimeOffline,
    useOfflineProgressUpdate,
    useOfflineMangaProgressUpdate,
    useOfflineListEntryEdit,
    useOfflineListEntryDelete,
    useRefreshOfflineEntryPayload,
} from "./use-offline"
