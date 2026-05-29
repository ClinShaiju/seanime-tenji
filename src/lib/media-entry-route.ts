import { AL_BaseAnime, AL_BaseManga, AL_MediaFormat, AL_MediaType } from "@/api/generated/types"
import type { Href } from "expo-router"

type MediaEntryKind = "anime" | "manga"

type RoutableMedia = Pick<AL_BaseAnime, "id" | "type" | "format"> | Pick<AL_BaseManga, "id" | "type" | "format">

const MANGA_FORMATS: AL_MediaFormat[] = ["MANGA", "NOVEL", "ONE_SHOT"]

function isMangaType(type?: AL_MediaType) {
    return type === "MANGA"
}

function isAnimeType(type?: AL_MediaType) {
    return type === "ANIME"
}

export function getMediaEntryKind(media: RoutableMedia, fallbackType: MediaEntryKind): MediaEntryKind {
    if (isMangaType(media.type)) return "manga"
    if (isAnimeType(media.type)) return "anime"
    if (media.format && MANGA_FORMATS.includes(media.format)) return "manga"
    return fallbackType
}

export function buildMediaEntryHref(media: RoutableMedia, fallbackType: MediaEntryKind): Href {
    const entryType = getMediaEntryKind(media, fallbackType)

    if (entryType === "manga") {
        return `/(app)/entry/manga/${String(media.id)}` as Href
    }

    return `/(app)/entry/anime/${String(media.id)}` as Href
}