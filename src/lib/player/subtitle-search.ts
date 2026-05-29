export type WyzieSubtitleResult = {
    url: string
    display: string
    language: string
    format: string
    isHearingImpaired: boolean
    source: string
    releaseName?: string
}

export type SubtitleSearchParams = {
    id: string
    season?: string
    episode?: string
    source?: WyzieSource
    key: string
    language?: string
    format?: string
}

export type WyzieSource =
    | "opensubtitles"
    | "subdl"
    | "subf2m"
    | "podnapisi"
    | "gestdown"

export const WYZIE_SOURCES: { label: string; value: WyzieSource }[] = [
    { label: "OpenSubtitles", value: "opensubtitles" },
    { label: "SubDL", value: "subdl" },
    { label: "Subf2m", value: "subf2m" },
    { label: "Podnapisi", value: "podnapisi" },
    { label: "Gestdown", value: "gestdown" },
]

export type AniZipMapping = {
    imdb_id?: string
    themoviedb_id?: string
    thetvdb_id?: number
    type?: string
}

///////////////////////////////////////////////////////////////////////////////
// Language helpers
///////////////////////////////////////////////////////////////////////////////

const LANGUAGE_META: Record<string, string> = {
    af: "Afrikaans", ar: "Arabic", bg: "Bulgarian", bn: "Bengali", bs: "Bosnian",
    ca: "Catalan", cs: "Czech", da: "Danish", de: "German", el: "Greek",
    en: "English", es: "Spanish", et: "Estonian", fa: "Persian", fi: "Finnish",
    fr: "French", he: "Hebrew", hi: "Hindi", hr: "Croatian", hu: "Hungarian",
    id: "Indonesian", is: "Icelandic", it: "Italian", ja: "Japanese", ko: "Korean",
    lt: "Lithuanian", lv: "Latvian", mk: "Macedonian", ml: "Malayalam",
    ms: "Malay", nl: "Dutch", no: "Norwegian", pl: "Polish", pt: "Portuguese",
    ro: "Romanian", ru: "Russian", sk: "Slovak", sl: "Slovenian", sq: "Albanian",
    sr: "Serbian", sv: "Swedish", th: "Thai", tl: "Tagalog", tr: "Turkish",
    uk: "Ukrainian", vi: "Vietnamese", zh: "Chinese",
    // regional variants wyzie may return
    pb: "Portuguese (BR)", ea: "Spanish (LA)", zt: "Chinese (Traditional)",
    ze: "Chinese (Simplified)",
}

export function getLanguageDisplayName(code: string): string {
    return LANGUAGE_META[code.toLowerCase()] ?? code.toUpperCase()
}

export const SUBTITLE_LANGUAGE_OPTIONS: { label: string; value: string }[] = [
    { label: "All", value: "all" },
    { label: "English", value: "en" },
    { label: "Spanish", value: "es" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Italian", value: "it" },
    { label: "Portuguese", value: "pt" },
    { label: "Portuguese (BR)", value: "pb" },
    { label: "Japanese", value: "ja" },
    { label: "Korean", value: "ko" },
    { label: "Chinese", value: "zh" },
    { label: "Russian", value: "ru" },
    { label: "Arabic", value: "ar" },
    { label: "Turkish", value: "tr" },
    { label: "Indonesian", value: "id" },
    { label: "Vietnamese", value: "vi" },
    { label: "Thai", value: "th" },
    { label: "Hindi", value: "hi" },
    { label: "Polish", value: "pl" },
    { label: "Dutch", value: "nl" },
    { label: "Romanian", value: "ro" },
    { label: "Swedish", value: "sv" },
    { label: "Czech", value: "cs" },
    { label: "Hungarian", value: "hu" },
    { label: "Greek", value: "el" },
    { label: "Danish", value: "da" },
    { label: "Finnish", value: "fi" },
    { label: "Norwegian", value: "no" },
    { label: "Ukrainian", value: "uk" },
    { label: "Bulgarian", value: "bg" },
    { label: "Croatian", value: "hr" },
    { label: "Serbian", value: "sr" },
    { label: "Slovak", value: "sk" },
    { label: "Slovenian", value: "sl" },
    { label: "Hebrew", value: "he" },
    { label: "Persian", value: "fa" },
    { label: "Malay", value: "ms" },
]

export const SUBTITLE_FORMAT_OPTIONS: { label: string; value: string }[] = [
    { label: "All", value: "all" },
    { label: "SRT", value: "srt" },
    { label: "ASS", value: "ass" },
    { label: "SSA", value: "ssa" },
    { label: "VTT", value: "vtt" },
]

export const WYZIE_REDEEM_URL = "https://sub.wyzie.io/redeem"

const mappingCache = new Map<number, AniZipMapping | null>()

/**
 * Resolve an AniList media ID to IMDB/TMDB IDs via the ani.zip mapping API.
 * Results are cached in-memory for the session.
 */
export async function fetchAniZipMapping(anilistId: number): Promise<AniZipMapping | null> {
    const cached = mappingCache.get(anilistId)
    if (cached !== undefined) return cached

    try {
        const res = await fetch(`https://api.ani.zip/v1/mappings?anilist_id=${anilistId}`)
        if (!res.ok) {
            mappingCache.set(anilistId, null)
            return null
        }
        const data = await res.json()
        const mapping: AniZipMapping = {
            imdb_id: data.imdb_id ?? undefined,
            themoviedb_id: data.themoviedb_id?.toString() ?? undefined,
            thetvdb_id: data.thetvdb_id ?? undefined,
            type: data.type ?? undefined,
        }
        mappingCache.set(anilistId, mapping)
        return mapping
    }
    catch {
        mappingCache.set(anilistId, null)
        return null
    }
}

export async function searchSubtitles(params: SubtitleSearchParams): Promise<WyzieSubtitleResult[]> {
    const { id, season, episode, source = "opensubtitles", key, language, format } = params

    const trimmedKey = key.trim()
    if (!trimmedKey) {
        throw new Error("Wyzie API key required")
    }

    const query = new URLSearchParams({
        id,
        key: trimmedKey,
    })

    if (season && episode) {
        query.set("season", season)
        query.set("episode", episode)
    }
    if (source !== "opensubtitles") {
        query.set("source", source)
    }
    if (language && language !== "all") {
        query.set("language", language)
    }
    if (format && format !== "all") {
        query.set("format", format)
    }

    const res = await fetch(`https://sub.wyzie.io/search?${query.toString()}`)
    if (!res.ok) {
        if (res.status === 401) {
            throw new Error("Wyzie API key is missing or invalid")
        }
        throw new Error(`Subtitle search failed: ${res.status}`)
    }

    const data: unknown[] = await res.json()
    if (!Array.isArray(data)) return []

    return data.map((item): WyzieSubtitleResult => {
        const rec = item as Record<string, unknown>
        return {
            url: String(rec.url ?? ""),
            display: String(rec.display ?? getLanguageDisplayName(String(rec.language ?? "en"))),
            language: String(rec.language ?? "en"),
            format: String(rec.format ?? "srt").toLowerCase(),
            isHearingImpaired: Boolean(rec.isHearingImpaired),
            source: String(rec.source ?? source),
            releaseName: rec.release ? String(rec.release) : undefined,
        }
    }).filter(s => s.url.length > 0)
}

export function filterSubtitles(
    results: WyzieSubtitleResult[],
    opts: { language?: string; format?: string; hearingImpaired?: boolean },
): WyzieSubtitleResult[] {
    let filtered = results

    if (opts.language && opts.language !== "all") {
        filtered = filtered.filter(s => s.language === opts.language)
    }
    if (opts.format && opts.format !== "all") {
        filtered = filtered.filter(s => s.format === opts.format)
    }
    if (opts.hearingImpaired) {
        filtered = filtered.filter(s => s.isHearingImpaired)
    }

    return filtered
}
