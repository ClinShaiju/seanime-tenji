import { atom } from "jotai"

export type AnimeEntryPlaybackIntentKind =
    | "play-local-episode"
    | "torrentstream-auto-select"
    | "torrentstream-previous-batch"
    | "debridstream-auto-select"
    | "debridstream-previous-batch"
    | "onlinestream-play"

export type AnimeEntryPlaybackIntent = {
    id: string
    mediaId: number
    episodeNumber: number
    kind: AnimeEntryPlaybackIntentKind
}

export const animeEntryPlaybackIntentAtom = atom<AnimeEntryPlaybackIntent | null>(null)

export function createAnimeEntryPlaybackIntent(intent: Omit<AnimeEntryPlaybackIntent, "id">): AnimeEntryPlaybackIntent {
    return {
        ...intent,
        id: `${intent.kind}-${intent.mediaId}-${intent.episodeNumber}-${Date.now()}`,
    }
}