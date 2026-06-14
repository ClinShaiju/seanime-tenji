import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { getDownloadNetworkBlockReason } from "@/atoms/download-settings.atoms"
import { useServerStatus, useServerUrl } from "@/atoms/server.atoms"
import {
    cancelAnimeDownload,
    clearAllAnimeDownloads,
    deleteAllAnimeDownloadsForMedia,
    deleteAnimeDownloadedFile,
    formatBytes,
    getAnimeDownloadDiskUsage,
    isAnimeDownloadActive,
    isLocalServer,
    resumeAnimeDownload,
    resumeStalledAnimeDownloads,
    retryAnimeDownload,
    retryFailedAnimeDownloads,
    startBatchDownload,
    startEpisodeDownload,
} from "@/lib/downloads/download-manager"
import {
    batchDownloadStoreWrites,
    type DownloadedAnimeInfo,
    type DownloadedEpisode,
    type DownloadStatus,
    getActiveDownloads,
    getAllDownloadedAnime,
    getAnimeTotalDownloadSize,
    getCompletedEpisodesForMedia,
    getDownloadedEpisode,
    getDownloadedEpisodeCount,
    getDownloadedEpisodesForMedia,
    getDownloadEpisodeId,
    getDownloadRevision,
    getEpisodeDownloadStatus,
    getFailedDownloads,
    isEpisodeDownloaded,
    subscribeToDownloadChanges,
} from "@/lib/downloads/download-store"
import { toast } from "@/lib/utils/toast"
import { useCallback, useMemo, useSyncExternalStore } from "react"

function useDownloadRevision(): number {
    return useSyncExternalStore(subscribeToDownloadChanges, getDownloadRevision)
}

/**
 * Check if a specific episode is fully downloaded on device.
 */
export function useIsEpisodeDownloaded(
    mediaId: number | undefined,
    episode: Anime_Episode | undefined,
): boolean {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId || !episode) return false
        const episodeId = getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
        return isEpisodeDownloaded(mediaId, episodeId)
    }, [mediaId, episode, rev])
}

/**
 * Get the download status of a specific episode.
 */
export function useEpisodeDownloadStatus(
    mediaId: number | undefined,
    episode: Anime_Episode | undefined,
): DownloadStatus | null {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId || !episode) return null
        const episodeId = getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
        return getEpisodeDownloadStatus(mediaId, episodeId)
    }, [mediaId, episode, rev])
}

/**
 * Get the stored download record for a specific episode.
 */
export function useEpisodeDownloadInfo(
    mediaId: number | undefined,
    episode: Anime_Episode | undefined,
): DownloadedEpisode | undefined {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId || !episode) return undefined
        const episodeId = getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
        return getDownloadedEpisode(mediaId, episodeId)
    }, [mediaId, episode, rev])
}

/**
 * Check if a specific episode download is actively in progress.
 */
export function useIsEpisodeDownloading(
    mediaId: number | undefined,
    episode: Anime_Episode | undefined,
): boolean {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId || !episode) return false
        const episodeId = getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
        return isAnimeDownloadActive(mediaId, episodeId)
    }, [mediaId, episode, rev])
}

////////////////////////// Media-level hooks

/**
 * Get all downloaded episodes for a given anime.
 */
export function useDownloadedEpisodesForMedia(mediaId: number | undefined): DownloadedEpisode[] {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId) return []
        return getDownloadedEpisodesForMedia(mediaId)
    }, [mediaId, rev])
}

/**
 * Get only completed downloads for a given anime.
 */
export function useCompletedEpisodesForMedia(mediaId: number | undefined): DownloadedEpisode[] {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        if (!mediaId) return []
        return getCompletedEpisodesForMedia(mediaId)
    }, [mediaId, rev])
}

export function useActiveAnimeDownloads(): DownloadedEpisode[] {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        return getActiveDownloads()
    }, [rev])
}

export function useFailedAnimeDownloads(): DownloadedEpisode[] {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        return getFailedDownloads()
    }, [rev])
}

////////////////////////// Library-level hooks

/**
 * Get all anime that have downloaded episodes.
 */
export function useAllDownloadedAnime(): DownloadedAnimeInfo[] {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        return getAllDownloadedAnime()
    }, [rev])
}

/**
 * Get total download size across all anime.
 */
export function useAnimeTotalDownloadSize(): { bytes: number; formatted: string } {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        const bytes = getAnimeTotalDownloadSize()
        return { bytes, formatted: formatBytes(bytes) }
    }, [rev])
}

/**
 * Get disk usage of the downloads directory.
 */
export function useAnimeDownloadDiskUsage(): { bytes: number; formatted: string } {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        const bytes = getAnimeDownloadDiskUsage()
        return { bytes, formatted: formatBytes(bytes) }
    }, [rev])
}

export function useDownloadedEpisodeCount(): number {
    "use no memo"

    const rev = useDownloadRevision()
    return useMemo(() => {
        void rev
        return getDownloadedEpisodeCount()
    }, [rev])
}

////////////////////////// Action hooks

/**
 * Returns a function to start downloading a single episode.
 */
export function useStartEpisodeDownload(entry: Anime_Entry | undefined) {
    const serverUrl = useServerUrl()

    return useCallback(
        (episode: Anime_Episode) => {
            void (async () => {
                if (!serverUrl || !entry) {
                    toast.error("Server not connected")
                    return
                }
                if (!episode.localFile?.path) {
                    toast.error("No local file available for this episode")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Downloading ${episode.displayTitle}...`)
                startEpisodeDownload(serverUrl, entry, episode).catch(() => {
                    // errors are handled inside startEpisodeDownload
                })
            })()
        },
        [serverUrl, entry],
    )
}

/**
 * Returns a function to start downloading multiple episodes.
 */
export function useStartAnimeBatchDownload(entry: Anime_Entry | undefined) {
    const serverUrl = useServerUrl()

    return useCallback(
        (episodes: Anime_Episode[]) => {
            void (async () => {
                if (!serverUrl || !entry) {
                    toast.error("Server not connected")
                    return
                }
                const downloadable = episodes.filter(ep => ep.localFile?.path)
                if (downloadable.length === 0) {
                    toast.error("No episodes available for download")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Downloading ${downloadable.length} episode${downloadable.length > 1 ? "s" : ""}...`)
                startBatchDownload(serverUrl, entry, downloadable).catch(() => {
                    // errors are handled inside startBatchDownload
                })
            })()
        },
        [serverUrl, entry],
    )
}

/**
 * Returns a function to cancel an active episode download.
 */
export function useCancelAnimeDownload() {
    return useCallback(
        (mediaId: number, episode: Anime_Episode) => {
            const episodeId = getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
            cancelAnimeDownload(mediaId, episodeId)
            toast.info("Download cancelled")
        },
        [],
    )
}

/**
 * Returns a function to delete a downloaded episode.
 */
export function useDeleteAnimeDownload() {
    return useCallback(
        (mediaId: number, episodeId: string) => {
            deleteAnimeDownloadedFile(mediaId, episodeId)
            toast.info("Download removed")
        },
        [],
    )
}

export function useDeleteAnimeQueueItems() {
    return useCallback(
        (episodes: DownloadedEpisode[]) => {
            if (episodes.length === 0) return

            batchDownloadStoreWrites(() => {
                for (const episode of episodes) {
                    deleteAnimeDownloadedFile(episode.mediaId, episode.aniDBEpisode)
                }
            })

            toast.info(`Removed ${episodes.length} queued download${episodes.length > 1 ? "s" : ""}`)
        },
        [],
    )
}

/**
 * Returns a function to delete all downloads for a media.
 */
export function useDeleteAllAnimeDownloadsForMedia() {
    return useCallback(
        (mediaId: number) => {
            void (async () => {
                await deleteAllAnimeDownloadsForMedia(mediaId)
                toast.info("All downloads removed")
            })()
        },
        [],
    )
}

/**
 * Returns a function to clear all downloads.
 */
export function useClearAllAnimeDownloads() {
    return useCallback(() => {
        void (async () => {
            await clearAllAnimeDownloads()
            toast.info("All downloads cleared")
        })()
    }, [])
}

export function useRetryAnimeDownload() {
    const serverUrl = useServerUrl()

    return useCallback(
        (episode: DownloadedEpisode) => {
            void (async () => {
                if (!serverUrl) {
                    toast.error("Server not connected")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Retrying ${episode.displayTitle}...`)
                retryAnimeDownload(serverUrl, episode).catch(() => {
                })
            })()
        },
        [serverUrl],
    )
}

export function useRetryAllFailedAnimeDownloads() {
    const serverUrl = useServerUrl()

    return useCallback(
        (episodes: DownloadedEpisode[]) => {
            void (async () => {
                if (episodes.length === 0) return
                if (!serverUrl) {
                    toast.error("Server not connected")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Retrying ${episodes.length} failed download${episodes.length > 1 ? "s" : ""}...`)
                retryFailedAnimeDownloads(serverUrl, episodes).catch(() => {
                })
            })()
        },
        [serverUrl],
    )
}

export function useResumeAnimeDownload() {
    const serverUrl = useServerUrl()

    return useCallback(
        (episode: DownloadedEpisode) => {
            void (async () => {
                if (!serverUrl) {
                    toast.error("Server not connected")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Resuming ${episode.displayTitle}...`)
                resumeAnimeDownload(serverUrl, episode).catch(() => {
                })
            })()
        },
        [serverUrl],
    )
}

export function useResumeAllAnimeDownloads() {
    const serverUrl = useServerUrl()

    return useCallback(
        (episodes: DownloadedEpisode[]) => {
            void (async () => {
                if (episodes.length === 0) return
                if (!serverUrl) {
                    toast.error("Server not connected")
                    return
                }

                const networkBlockReason = await getDownloadNetworkBlockReason()
                if (networkBlockReason) {
                    toast.error(networkBlockReason)
                    return
                }

                toast.info(`Resuming ${episodes.length} queued download${episodes.length > 1 ? "s" : ""}...`)
                resumeStalledAnimeDownloads(serverUrl, episodes).catch(() => {
                })
            })()
        },
        [serverUrl],
    )
}

export function useIsLocalServer(): boolean {
    const serverUrl = useServerUrl()
    const serverStatus = useServerStatus()
    return useMemo(() => {
        if (!serverUrl) return false
        if (isLocalServer(serverUrl)) return true
        const os = serverStatus?.os?.toLowerCase()
        return os === "android" || os === "ios"
    }, [serverUrl, serverStatus])
}
