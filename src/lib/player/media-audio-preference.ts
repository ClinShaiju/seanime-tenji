import { createMMKV } from "react-native-mmkv"

/**
 * Per-media audio-track preference with auto-capture.
 *
 * The global default (player-preferences `preferredAudioLanguages`) decides the
 * audio track when nothing media-specific is stored. When the user manually
 * switches audio track for a given title, we capture that track's language/title
 * here keyed by the AniList media id, so the same track re-selects on the next
 * open (across sessions) and wins over the global default.
 *
 * Matching is alias-based (language + title substring, via `findPreferredTrack`)
 * rather than by raw track id, so it survives track-id reshuffles between the
 * HLS manifests / releases of different episodes of the same show.
 */
const storage = createMMKV({ id: "seanime-media-audio-prefs" })

const STORAGE_KEY = "media-audio-track-prefs"

export type MediaAudioPreference = {
    language?: string
    title?: string
}

function readAll(): Record<string, MediaAudioPreference> {
    const raw = storage.getString(STORAGE_KEY)
    if (!raw) return {}
    try {
        return JSON.parse(raw) as Record<string, MediaAudioPreference>
    }
    catch {
        return {}
    }
}

export function getMediaAudioPreference(mediaId: number | undefined | null): MediaAudioPreference | null {
    if (!mediaId) return null
    return readAll()[String(mediaId)] ?? null
}

export function setMediaAudioPreference(mediaId: number | undefined | null, pref: MediaAudioPreference | null) {
    if (!mediaId) return
    const all = readAll()
    const key = String(mediaId)
    if (pref === null || (!pref.language && !pref.title)) {
        delete all[key]
    } else {
        all[key] = pref
    }
    storage.set(STORAGE_KEY, JSON.stringify(all))
}

/**
 * Build a preference string usable by `findPreferredTrack` from a captured
 * per-media preference. Returns null when there is nothing to match on.
 */
export function mediaAudioPreferenceToTags(pref: MediaAudioPreference | null): string | null {
    if (!pref) return null
    const tags = [pref.language, pref.title].map(v => v?.trim()).filter(Boolean)
    return tags.length ? tags.join(", ") : null
}
