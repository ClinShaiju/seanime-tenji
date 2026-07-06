import type { Models_Theme, Status } from "@/api/generated/types"

export type ContinueWatchingSorting =
    | "AIRDATE"
    | "AIRDATE_DESC"
    | "EPISODE_NUMBER"
    | "EPISODE_NUMBER_DESC"
    | "UNWATCHED_EPISODES"
    | "UNWATCHED_EPISODES_DESC"
    | "SCORE"
    | "SCORE_DESC"
    | "START_DATE"
    | "START_DATE_DESC"
    | "LAST_WATCHED"
    | "LAST_WATCHED_DESC"
    | "UP_NEXT_DESC"

export type AnimeCollectionSorting =
    | "AIRDATE"
    | "AIRDATE_DESC"
    | "UNWATCHED_EPISODES"
    | "UNWATCHED_EPISODES_DESC"
    | "LAST_WATCHED"
    | "LAST_WATCHED_DESC"
    | CollectionSorting

export type MangaCollectionSorting =
    | "UNREAD_CHAPTERS"
    | "UNREAD_CHAPTERS_DESC"
    | CollectionSorting

export type CollectionSorting =
    | "START_DATE"
    | "START_DATE_DESC"
    | "END_DATE"
    | "END_DATE_DESC"
    | "SCORE"
    | "SCORE_DESC"
    | "AUDIENCE_SCORE"
    | "AUDIENCE_SCORE_DESC"
    | "RELEASE_DATE"
    | "RELEASE_DATE_DESC"
    | "PROGRESS"
    | "PROGRESS_DESC"
    | "TITLE"
    | "TITLE_DESC"

export const THEME_SETTING_DEFAULTS = {
    continueWatchingDefaultSorting: "AIRDATE_DESC" as ContinueWatchingSorting,
    animeLibraryCollectionDefaultSorting: "TITLE" as AnimeCollectionSorting,
    mangaLibraryCollectionDefaultSorting: "TITLE" as MangaCollectionSorting,
    hideAnimeSpoilers: false,
    hideAnimeSpoilerThumbnails: true,
    hideAnimeSpoilerTitles: true,
    hideAnimeSpoilerDescriptions: true,
    hideAnimeSpoilerSkipNextEpisode: false,
}

export function getThemeSettings(serverStatus: Status | null | undefined): Models_Theme | undefined {
    return serverStatus?.themeSettings as Models_Theme | undefined
}

function resolveThemeSettingValue<TKey extends keyof typeof THEME_SETTING_DEFAULTS>(
    value: unknown,
    defaultValue: (typeof THEME_SETTING_DEFAULTS)[TKey],
): (typeof THEME_SETTING_DEFAULTS)[TKey] {
    if (value === null || value === undefined) return defaultValue

    if (typeof defaultValue === "boolean") {
        return (typeof value === "boolean" ? value : defaultValue) as (typeof THEME_SETTING_DEFAULTS)[TKey]
    }

    if (typeof defaultValue === "string") {
        return (typeof value === "string" && value !== "" ? value : defaultValue) as (typeof THEME_SETTING_DEFAULTS)[TKey]
    }

    return defaultValue
}

export function getThemeSetting<TKey extends keyof typeof THEME_SETTING_DEFAULTS>(
    serverStatus: Status | null | undefined,
    key: TKey,
): (typeof THEME_SETTING_DEFAULTS)[TKey] {
    const themeSettings = getThemeSettings(serverStatus)
    const value = themeSettings?.[key] as unknown

    return resolveThemeSettingValue(value, THEME_SETTING_DEFAULTS[key])
}
