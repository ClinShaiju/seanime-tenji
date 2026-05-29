import { AL_MediaSeason } from "@/api/generated/types"
import { useAnilistListAnime, useAnilistListMissedSequels } from "@/api/hooks/anilist.hooks"
import { useAnilistListManga } from "@/api/hooks/manga.hooks"

/**
 * Returns the current AniList season and year based on the current month.
 */
function getCurrentSeason(): { season: AL_MediaSeason; year: number } {
    const month = new Date().getMonth() + 1
    const year = new Date().getFullYear()
    let season: AL_MediaSeason = "WINTER"
    if (month >= 4 && month <= 6) season = "SPRING"
    else if (month >= 7 && month <= 9) season = "SUMMER"
    else if (month >= 10 && month <= 12) season = "FALL"
    return { season, year }
}

/**
 * Returns the previous season and its corresponding year.
 */
function getPreviousSeason(): { season: AL_MediaSeason; year: number } {
    const { season, year } = getCurrentSeason()
    const map: Record<AL_MediaSeason, { season: AL_MediaSeason; yearOffset: number }> = {
        WINTER: { season: "FALL", yearOffset: -1 },
        SPRING: { season: "WINTER", yearOffset: 0 },
        SUMMER: { season: "SPRING", yearOffset: 0 },
        FALL: { season: "SUMMER", yearOffset: 0 },
    }
    const prev = map[season]
    return { season: prev.season, year: year + prev.yearOffset }
}

///////////////////////////////////////////////////////////////////////////////
// Discover queries
///////////////////////////////////////////////////////////////////////////////

export function useDiscoverTrendingAnime(enabled: boolean = true, genres?: string[]) {
    return useAnilistListAnime({
        page: 1,
        perPage: 20,
        sort: ["TRENDING_DESC"],
        genres: genres && genres.length > 0 ? genres : undefined,
    }, enabled)
}

export function useDiscoverCurrentSeasonAnime(enabled: boolean = true) {
    const { season, year } = getCurrentSeason()
    return useAnilistListAnime({
        page: 1,
        perPage: 20,
        sort: ["SCORE_DESC"],
        season,
        seasonYear: year,
    }, enabled)
}

export function useDiscoverPastSeasonAnime(enabled: boolean = true) {
    const { season, year } = getPreviousSeason()
    return useAnilistListAnime({
        page: 1,
        perPage: 20,
        sort: ["SCORE_DESC"],
        season,
        seasonYear: year,
    }, enabled)
}

export function useDiscoverUpcomingAnime(enabled: boolean = true) {
    return useAnilistListAnime({
        page: 1,
        perPage: 20,
        sort: ["TRENDING_DESC"],
        status: ["NOT_YET_RELEASED"],
    }, enabled)
}

export function useDiscoverTrendingMovies(enabled: boolean = true) {
    return useAnilistListAnime({
        page: 1,
        perPage: 20,
        format: "MOVIE",
        sort: ["TRENDING_DESC"],
        status: ["RELEASING", "FINISHED"],
    }, enabled)
}

export function useDiscoverMissedSequels(enabled: boolean = true) {
    return useAnilistListMissedSequels(enabled)
}

///////////////////////////////////////////////////////////////////////////////
// Manga queries, one per country of origin
///////////////////////////////////////////////////////////////////////////////

export function useDiscoverTrendingManga(country: string, enabled: boolean = true) {
    return useAnilistListManga({
        page: 1,
        perPage: 20,
        sort: ["TRENDING_DESC"],
        countryOfOrigin: country,
    }, enabled)
}

///////////////////////////////////////////////////////////////////////////////
// Season label helpers
///////////////////////////////////////////////////////////////////////////////

export function getCurrentSeasonLabel(): string {
    const { season, year } = getCurrentSeason()
    return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`
}

export function getPreviousSeasonLabel(): string {
    const { season, year } = getPreviousSeason()
    return `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`
}
