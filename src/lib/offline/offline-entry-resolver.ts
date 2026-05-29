import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AL_BaseAnime, AL_BaseManga, Anime_Entry, Anime_Episode, Manga_Entry } from "@/api/generated/types"
import { type DownloadedAnimeInfo, type DownloadedEpisode, getAnimeInfo, getDownloadedEpisodesForMedia } from "@/lib/downloads/download-store"
import { type DownloadedMangaInfo, getAllDownloadedChaptersForMediaAllProviders, getMangaInfo } from "@/lib/downloads/manga-download-store"
import { getAnimeDownloadEntrySnapshot, getMangaDownloadEntrySnapshot } from "@/lib/offline/download-entry-snapshot-store"
import { getOfflineEntry } from "@/lib/offline/offline-entry-store"
import { restoreQueryData } from "@/lib/query-persistence"

function parseStoredEntryPayload<T>(payload: string | undefined): T | undefined {
    if (!payload) return undefined

    try {
        return JSON.parse(payload) as T
    }
    catch {
        return undefined
    }
}

function isValidAnimeEntry(entry: Anime_Entry | undefined, mediaId: number): entry is Anime_Entry {
    return Boolean(entry && entry.mediaId === mediaId && entry.media)
}

function isValidMangaEntry(entry: Manga_Entry | undefined, mediaId: number): entry is Manga_Entry {
    return Boolean(entry && entry.mediaId === mediaId && entry.media)
}

function getStoredAnimeEntry(mediaId: number): Anime_Entry | undefined {
    const downloadedEntrySnapshot = getAnimeDownloadEntrySnapshot(mediaId)
    if (isValidAnimeEntry(downloadedEntrySnapshot, mediaId)) {
        return downloadedEntrySnapshot
    }

    const storedOfflineEntry = parseStoredEntryPayload<Anime_Entry>(getOfflineEntry("anime", mediaId)?.payload)
    if (isValidAnimeEntry(storedOfflineEntry, mediaId)) {
        return storedOfflineEntry
    }

    const persistedQueryEntry = restoreQueryData<Anime_Entry>([
        API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key,
        String(mediaId),
    ])
    if (isValidAnimeEntry(persistedQueryEntry, mediaId)) {
        return persistedQueryEntry
    }

    return undefined
}

function getStoredMangaEntry(mediaId: number): Manga_Entry | undefined {
    const downloadedEntrySnapshot = getMangaDownloadEntrySnapshot(mediaId)
    if (isValidMangaEntry(downloadedEntrySnapshot, mediaId)) {
        return downloadedEntrySnapshot
    }

    const storedOfflineEntry = parseStoredEntryPayload<Manga_Entry>(getOfflineEntry("manga", mediaId)?.payload)
    if (isValidMangaEntry(storedOfflineEntry, mediaId)) {
        return storedOfflineEntry
    }

    const persistedQueryEntry = restoreQueryData<Manga_Entry>([
        API_ENDPOINTS.MANGA.GetMangaEntry.key,
        String(mediaId),
    ])
    if (isValidMangaEntry(persistedQueryEntry, mediaId)) {
        return persistedQueryEntry
    }

    return undefined
}

function getAnimeFallbackTitle(mediaId: number, info: DownloadedAnimeInfo | undefined): string {
    return info?.title || `Anime #${mediaId}`
}

function getMangaFallbackTitle(mediaId: number, info: DownloadedMangaInfo | undefined): string {
    return info?.title || `Manga #${mediaId}`
}

function buildFallbackAnimeMedia(
    mediaId: number,
    info: DownloadedAnimeInfo | undefined,
    episodes: DownloadedEpisode[],
): AL_BaseAnime {
    const title = getAnimeFallbackTitle(mediaId, info)
    const bannerImage = info?.bannerImageUrl || episodes.find(episode => episode.thumbnailUrl)?.thumbnailUrl || info?.coverImageUrl
    const inferredEpisodeCount = episodes.filter(episode => episode.type === "main").length || episodes.length
    const totalEpisodes = info?.totalEpisodes ?? inferredEpisodeCount

    return {
        id: mediaId,
        type: "ANIME",
        title: {
            english: title,
            romaji: title,
            userPreferred: title,
        },
        coverImage: {
            extraLarge: info?.coverImageUrl,
            large: info?.coverImageUrl,
            medium: info?.coverImageUrl,
        },
        bannerImage,
        episodes: totalEpisodes,
    }
}

function buildFallbackAnimeEpisode(episode: DownloadedEpisode, media: AL_BaseAnime): Anime_Episode {
    const displayTitle = episode.displayTitle || `Episode ${episode.episodeNumber}`

    return {
        type: episode.type,
        displayTitle,
        episodeTitle: episode.episodeTitle,
        episodeNumber: episode.episodeNumber,
        aniDBEpisode: episode.aniDBEpisode,
        absoluteEpisodeNumber: episode.episodeNumber,
        progressNumber: episode.episodeNumber,
        localFile: {
            path: episode.serverFilePath,
            name: displayTitle,
            metadata: {
                episode: episode.episodeNumber,
                aniDBEpisode: episode.aniDBEpisode,
                type: episode.type,
            },
            locked: false,
            ignored: false,
            mediaId: episode.mediaId,
        },
        isDownloaded: episode.status === "completed",
        episodeMetadata: episode.thumbnailUrl || episode.episodeTitle
            ? {
                image: episode.thumbnailUrl,
                title: episode.episodeTitle || undefined,
            }
            : undefined,
        isInvalid: false,
        baseAnime: media,
        _isNakamaEpisode: false,
    }
}

function buildFallbackMangaMedia(
    mediaId: number,
    info: DownloadedMangaInfo | undefined,
    chapterCount: number,
): AL_BaseManga {
    const title = getMangaFallbackTitle(mediaId, info)

    return {
        id: mediaId,
        type: "MANGA",
        title: {
            english: title,
            romaji: title,
            userPreferred: title,
        },
        coverImage: {
            extraLarge: info?.coverImageUrl,
            large: info?.coverImageUrl,
            medium: info?.coverImageUrl,
        },
        bannerImage: info?.coverImageUrl,
        chapters: chapterCount || undefined,
    }
}

export function resolveOfflineAnimeEntry(mediaId: number | undefined): Anime_Entry | undefined {
    if (!mediaId || !Number.isFinite(mediaId)) return undefined

    const storedEntry = getStoredAnimeEntry(mediaId)
    if (storedEntry) {
        return storedEntry
    }

    const animeInfo = getAnimeInfo(mediaId)
    const downloadedEpisodes = getDownloadedEpisodesForMedia(mediaId)
    if (!animeInfo && downloadedEpisodes.length === 0) {
        return undefined
    }

    const media = buildFallbackAnimeMedia(mediaId, animeInfo, downloadedEpisodes)
    const episodes = downloadedEpisodes.map(episode => buildFallbackAnimeEpisode(episode, media))

    return {
        mediaId,
        media,
        episodes,
        nextEpisode: undefined,
        localFiles: episodes.flatMap(episode => episode.localFile ? [episode.localFile] : []),
        anidbId: 0,
        currentEpisodeCount: episodes.length,
        _isNakamaEntry: false,
    }
}

export function resolveOfflineMangaEntry(mediaId: number | undefined): Manga_Entry | undefined {
    if (!mediaId || !Number.isFinite(mediaId)) return undefined

    const storedEntry = getStoredMangaEntry(mediaId)
    if (storedEntry) {
        return storedEntry
    }

    const mangaInfo = getMangaInfo(mediaId)
    const downloadedChapters = getAllDownloadedChaptersForMediaAllProviders(mediaId)
    if (!mangaInfo && downloadedChapters.length === 0) {
        return undefined
    }

    return {
        mediaId,
        media: buildFallbackMangaMedia(mediaId, mangaInfo, downloadedChapters.length),
    }
}
