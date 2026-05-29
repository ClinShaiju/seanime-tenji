import type { AL_BaseAnime, Status } from "@/api/generated/types"
import { getThemeSetting } from "@/lib/theme-settings"

export type EpisodeSpoilerState = {
    isSpoiler: boolean
    hideThumbnail: boolean
    hideTitle: boolean
    hideDescription: boolean
}

type EpisodeSpoilerOptions = {
    episodeNumber?: number | null
    watchedProgress?: number | null
    spoilerActive?: boolean
}

export function getEpisodeSpoilerState(
    serverStatus: Status | null | undefined,
    options: EpisodeSpoilerOptions,
): EpisodeSpoilerState {
    const hideAnimeSpoilers = getThemeSetting(serverStatus, "hideAnimeSpoilers")
    const skipNextEpisode = getThemeSetting(serverStatus, "hideAnimeSpoilerSkipNextEpisode")
    const watchedProgress = options.watchedProgress ?? 0
    const episodeNumber = options.episodeNumber ?? null
    // skip next episode keeps the immediate next watchable episode visible
    const adjustedProgress = watchedProgress + (skipNextEpisode ? 1 : 0)
    const isSpoiler = hideAnimeSpoilers && (options.spoilerActive ?? (episodeNumber !== null && episodeNumber > adjustedProgress))

    return {
        isSpoiler,
        hideThumbnail: isSpoiler && getThemeSetting(serverStatus, "hideAnimeSpoilerThumbnails"),
        hideTitle: isSpoiler && getThemeSetting(serverStatus, "hideAnimeSpoilerTitles"),
        hideDescription: isSpoiler && getThemeSetting(serverStatus, "hideAnimeSpoilerDescriptions"),
    }
}

export function getContinueWatchingSpoilerActive(serverStatus: Status | null | undefined): boolean {
    return getThemeSetting(serverStatus, "hideAnimeSpoilers")
        && !getThemeSetting(serverStatus, "hideAnimeSpoilerSkipNextEpisode")
}

export function getSequentialContinueWatchingSpoilerActive(serverStatus: Status | null | undefined): boolean | undefined {
    if (!getThemeSetting(serverStatus, "hideAnimeSpoilers")) return false

    // entry carousels contain future episodes for one title, so skip-next should only reveal the immediate next episode
    return getThemeSetting(serverStatus, "hideAnimeSpoilerSkipNextEpisode") ? undefined : true
}

export function getSpoilerSafeAnimeImage(anime?: Pick<AL_BaseAnime, "bannerImage" | "coverImage"> | null): string | undefined {
    // fallback art avoids episode-specific thumbnails when spoilers are hidden
    return anime?.bannerImage || anime?.coverImage?.extraLarge || anime?.coverImage?.large || anime?.coverImage?.medium
}
