import { Anime_Entry, Manga_Entry } from "@/api/generated/types"
import { createMMKV } from "react-native-mmkv"

const store = createMMKV({ id: "seanime-download-entry-snapshots" })

export type DownloadEntrySnapshotType = "anime" | "manga"

type DownloadEntrySnapshot = {
    mediaId: number
    type: DownloadEntrySnapshotType
    title: string
    coverImageUrl?: string
    payload: string
    updatedAt: number
}

function snapshotKey(type: DownloadEntrySnapshotType, mediaId: number): string {
    return `snapshot:${type}:${mediaId}`
}

function saveSnapshot(snapshot: DownloadEntrySnapshot): void {
    store.set(snapshotKey(snapshot.type, snapshot.mediaId), JSON.stringify(snapshot))
}

function mutateSnapshotPayload<T>(
    type: DownloadEntrySnapshotType,
    mediaId: number,
    mutate: (payload: T) => T,
): void {
    const raw = store.getString(snapshotKey(type, mediaId))
    if (!raw) return

    try {
        const snapshot = JSON.parse(raw) as DownloadEntrySnapshot
        const payload = JSON.parse(snapshot.payload) as T
        const nextPayload = mutate(payload)

        saveSnapshot({
            ...snapshot,
            payload: JSON.stringify(nextPayload),
            updatedAt: Date.now(),
        })
    }
    catch {
    }
}

function parseSnapshot<T>(type: DownloadEntrySnapshotType, mediaId: number): T | undefined {
    const raw = store.getString(snapshotKey(type, mediaId))
    if (!raw) return undefined

    try {
        const snapshot = JSON.parse(raw) as DownloadEntrySnapshot
        return JSON.parse(snapshot.payload) as T
    }
    catch {
        return undefined
    }
}

function getAnimeSnapshotTitle(entry: Anime_Entry): string {
    return entry.media?.title?.english
        || entry.media?.title?.romaji
        || entry.media?.title?.userPreferred
        || `Anime #${entry.mediaId}`
}

function getMangaSnapshotTitle(entry: Manga_Entry): string {
    return entry.media?.title?.english
        || entry.media?.title?.romaji
        || entry.media?.title?.userPreferred
        || `Manga #${entry.mediaId}`
}

export function saveAnimeDownloadEntrySnapshot(entry: Anime_Entry): void {
    saveSnapshot({
        mediaId: entry.mediaId,
        type: "anime",
        title: getAnimeSnapshotTitle(entry),
        coverImageUrl: entry.media?.coverImage?.large ?? entry.media?.coverImage?.extraLarge,
        payload: JSON.stringify(entry),
        updatedAt: Date.now(),
    })
}

export function saveMangaDownloadEntrySnapshot(entry: Manga_Entry): void {
    saveSnapshot({
        mediaId: entry.mediaId,
        type: "manga",
        title: getMangaSnapshotTitle(entry),
        coverImageUrl: entry.media?.coverImage?.large ?? entry.media?.coverImage?.extraLarge,
        payload: JSON.stringify(entry),
        updatedAt: Date.now(),
    })
}

export function getAnimeDownloadEntrySnapshot(mediaId: number): Anime_Entry | undefined {
    return parseSnapshot<Anime_Entry>("anime", mediaId)
}

export function getMangaDownloadEntrySnapshot(mediaId: number): Manga_Entry | undefined {
    return parseSnapshot<Manga_Entry>("manga", mediaId)
}

export function updateAnimeDownloadEntrySnapshotProgress(mediaId: number, episodeNumber: number): void {
    mutateSnapshotPayload<Anime_Entry>("anime", mediaId, (entry) => ({
        ...entry,
        listData: {
            ...(entry.listData ?? {}),
            progress: Math.max(entry.listData?.progress ?? 0, episodeNumber),
        },
    }))
}

export function removeDownloadEntrySnapshot(type: DownloadEntrySnapshotType, mediaId: number): void {
    store.remove(snapshotKey(type, mediaId))
}
