import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { addWsMessageHandler, WsServerMessage } from "@/atoms/websocket.atoms"
import { requestServerLocalSync } from "@/lib/offline"
import { logger } from "@/lib/utils/logger"
import { toast } from "@/lib/utils/toast"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"

const WEBSOCKET_EVENTS = {
    // toast events
    ErrorToast: "error-toast",
    SuccessToast: "success-toast",
    InfoToast: "info-toast",
    WarningToast: "warning-toast",
    // collection refresh events
    RefreshedAnilistAnimeCollection: "refreshed-anilist-anime-collection",
    RefreshedAnilistMangaCollection: "refreshed-anilist-manga-collection",
    // library watcher events
    AutoScanCompleted: "auto-scan-completed",
    LibraryWatcherFileAdded: "library-watcher-file-added",
    LibraryWatcherFileRemoved: "library-watcher-file-removed",
    // auto downloader
    AutoDownloaderItemAdded: "auto-downloader-item-added",
    // playback progress events
    PlaybackManagerProgressUpdated: "playback-manager-progress-updated",
    PlaybackManagerProgressVideoCompleted: "playback-manager-progress-video-completed",
    // manga download events
    ChapterDownloadQueueUpdated: "chapter-download-queue-updated",
    // extension events
    ExtensionsReloaded: "extensions-reloaded",
    ExtensionUpdatesFound: "extension-updates-found",
    PluginUnloaded: "plugin-unloaded",
    PluginLoaded: "plugin-loaded",
    // sync events
    SyncLocalFinished: "sync-local-finished",
    // server-side state changes made from another client
    SettingsChanged: "settings-changed",
    ServerLoggedOutAnilist: "server-logged-out-anilist",
    // generic invalidation
    InvalidateQueries: "invalidate-queries",
} as const

const settingsChangedKeys = [
    API_ENDPOINTS.SETTINGS.GetSettings.key,
    API_ENDPOINTS.STATUS.GetStatus.key,
] as const

const animeCollectionRefreshKeys = [
    API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key,
    API_ENDPOINTS.ANILIST.GetAnimeCollection.key,
    API_ENDPOINTS.ANILIST.GetRawAnimeCollection.key,
    API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key,
    API_ENDPOINTS.MANGA.GetMangaCollection.key,
    API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key,
    API_ENDPOINTS.MANGA.GetMangaEntry.key,
    API_ENDPOINTS.ANIME_COLLECTION.GetAnimeCollectionSchedule.key,
    API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key,
] as const

const mangaCollectionRefreshKeys = [
    API_ENDPOINTS.MANGA.GetAnilistMangaCollection.key,
    API_ENDPOINTS.MANGA.GetRawAnilistMangaCollection.key,
    API_ENDPOINTS.MANGA.GetMangaCollection.key,
    API_ENDPOINTS.MANGA.GetMangaEntry.key,
] as const

const syncLocalFinishedKeys = [
    API_ENDPOINTS.LOCAL.LocalGetTrackedMediaItems.key,
] as const

const extensionsReloadedKeys = [
    API_ENDPOINTS.EXTENSIONS.ListAnimeTorrentProviderExtensions.key,
    API_ENDPOINTS.EXTENSIONS.ListMangaProviderExtensions.key,
    API_ENDPOINTS.EXTENSIONS.ListOnlinestreamProviderExtensions.key,
    API_ENDPOINTS.EXTENSIONS.ListCustomSourceExtensions.key,
    API_ENDPOINTS.EXTENSIONS.ListExtensionData.key,
    API_ENDPOINTS.EXTENSIONS.GetAllExtensions.key,
    API_ENDPOINTS.EXTENSIONS.GetExtensionUserConfig.key,
    API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.key,
    API_ENDPOINTS.EXTENSIONS.ListDevelopmentModeExtensions.key,
] as const

const extensionUpdatesFoundKeys = [
    API_ENDPOINTS.EXTENSIONS.GetExtensionUpdateData.key,
    API_ENDPOINTS.EXTENSIONS.GetAllExtensions.key,
] as const

const pluginUnloadedKeys = [
    API_ENDPOINTS.EXTENSIONS.ListDevelopmentModeExtensions.key,
] as const

const libraryRefreshKeys = [
    API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key,
    API_ENDPOINTS.ANILIST.GetAnimeCollection.key,
    API_ENDPOINTS.LIBRARY_EXPLORER.GetLibraryExplorerFileTree.key,
    API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key,
] as const

const autoDownloaderRefreshKeys = [
    API_ENDPOINTS.AUTO_DOWNLOADER.GetAutoDownloaderItems.key,
] as const

const playbackProgressRefreshKeys = [
    API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key,
] as const

const chapterDownloadRefreshKeys = [
    API_ENDPOINTS.MANGA_DOWNLOAD.GetMangaDownloadQueue.key,
    API_ENDPOINTS.MANGA_DOWNLOAD.GetMangaDownloadData.key,
    API_ENDPOINTS.MANGA_DOWNLOAD.GetMangaDownloadsList.key,
] as const

async function invalidateQueryKeys(queryClient: ReturnType<typeof useQueryClient>, queryKeys: readonly string[]) {
    await Promise.all(queryKeys.map(queryKey => queryClient.invalidateQueries({ queryKey: [queryKey] })))
}

export function useWebsocketEventRouter() {
    const queryClient = useQueryClient()

    React.useEffect(() => {
        const handleMessage = async (message: WsServerMessage) => {
            switch (message.type) {
                case WEBSOCKET_EVENTS.ErrorToast:
                    if (typeof message.payload === "string") {
                        toast.error(message.payload)
                    }
                    return
                case WEBSOCKET_EVENTS.SuccessToast:
                    if (typeof message.payload === "string") {
                        toast.success(message.payload)
                    }
                    return
                case WEBSOCKET_EVENTS.InfoToast:
                    if (typeof message.payload === "string") {
                        toast.info(message.payload)
                    }
                    return
                case WEBSOCKET_EVENTS.WarningToast:
                    if (typeof message.payload === "string") {
                        toast.warning(message.payload)
                    }
                    return
                case WEBSOCKET_EVENTS.RefreshedAnilistAnimeCollection:
                    await invalidateQueryKeys(queryClient, animeCollectionRefreshKeys)
                    requestServerLocalSync()
                    return
                case WEBSOCKET_EVENTS.RefreshedAnilistMangaCollection:
                    await invalidateQueryKeys(queryClient, mangaCollectionRefreshKeys)
                    return
                case WEBSOCKET_EVENTS.ExtensionsReloaded:
                    await invalidateQueryKeys(queryClient, extensionsReloadedKeys)
                    return
                case WEBSOCKET_EVENTS.ExtensionUpdatesFound:
                    await invalidateQueryKeys(queryClient, extensionUpdatesFoundKeys)
                    return
                case WEBSOCKET_EVENTS.PluginUnloaded:
                case WEBSOCKET_EVENTS.PluginLoaded:
                    await invalidateQueryKeys(queryClient, pluginUnloadedKeys)
                    return
                case WEBSOCKET_EVENTS.AutoScanCompleted:
                case WEBSOCKET_EVENTS.LibraryWatcherFileAdded:
                case WEBSOCKET_EVENTS.LibraryWatcherFileRemoved:
                    await invalidateQueryKeys(queryClient, libraryRefreshKeys)
                    requestServerLocalSync()
                    return
                case WEBSOCKET_EVENTS.AutoDownloaderItemAdded:
                    await invalidateQueryKeys(queryClient, autoDownloaderRefreshKeys)
                    return
                case WEBSOCKET_EVENTS.PlaybackManagerProgressUpdated:
                case WEBSOCKET_EVENTS.PlaybackManagerProgressVideoCompleted:
                    await invalidateQueryKeys(queryClient, playbackProgressRefreshKeys)
                    return
                case WEBSOCKET_EVENTS.ChapterDownloadQueueUpdated:
                    await invalidateQueryKeys(queryClient, chapterDownloadRefreshKeys)
                    return
                case WEBSOCKET_EVENTS.SyncLocalFinished:
                    await invalidateQueryKeys(queryClient, syncLocalFinishedKeys)
                    requestServerLocalSync()
                    return
                case WEBSOCKET_EVENTS.SettingsChanged:
                    await invalidateQueryKeys(queryClient, settingsChangedKeys)
                    return
                case WEBSOCKET_EVENTS.ServerLoggedOutAnilist:
                    await invalidateQueryKeys(queryClient, [API_ENDPOINTS.STATUS.GetStatus.key])
                    if (typeof message.payload === "string" && message.payload) {
                        toast.warning(message.payload)
                    }
                    return
                case WEBSOCKET_EVENTS.InvalidateQueries:
                    if (Array.isArray(message.payload) && message.payload.every(item => typeof item === "string")) {
                        await invalidateQueryKeys(queryClient, message.payload)
                    } else {
                        logger("websocket-event-router").warning("Received invalidate-queries event with invalid payload", message.payload)
                    }
                    return
                default:
                    return
            }
        }

        return addWsMessageHandler(message => void handleMessage(message))
    }, [queryClient])
}
