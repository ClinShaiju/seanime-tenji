import { removeDownloadEntrySnapshot } from "@/lib/offline/download-entry-snapshot-store"
import { Paths } from "expo-file-system"
import { createMMKV } from "react-native-mmkv"

const store = createMMKV({ id: "seanime-manga-downloads" })

export type MangaDownloadStatus = "pending" | "downloading" | "completed" | "failed"

export type DownloadedMangaPageDimensions = Record<number, {
    width: number
    height: number
}>

export type DownloadedMangaChapter = {
    mediaId: number
    provider: string
    chapterId: string
    chapterNumber: string
    title: string
    scanlator?: string
    totalPages: number
    pagesDownloaded: number
    localDir: string
    status: MangaDownloadStatus
    progress: number
    startedAt: number
    completedAt?: number
    errorMessage?: string
    // keeps local reader heights stable when the server is offline
    pageDimensions?: DownloadedMangaPageDimensions
}

export type DownloadedMangaInfo = {
    mediaId: number
    title: string
    coverImageUrl?: string
    downloadedCount: number
}

////////////////////////// Helpers

function chapterKey(mediaId: number, provider: string, chapterId: string): string {
    return `manga-ch:${mediaId}:${provider}:${chapterId}`
}

function chapterIndexKey(mediaId: number, provider: string): string {
    return `manga-ch-idx:${mediaId}:${provider}`
}

function mangaInfoKey(mediaId: number): string {
    return `manga-info:${mediaId}`
}

const GLOBAL_MEDIA_INDEX_KEY = "manga-media-idx"
const REVISION_KEY = "manga-rev"
let revisionBatchDepth = 0
let hasPendingRevision = false

function flushRevision(): void {
    if (!hasPendingRevision) return
    hasPendingRevision = false
    const rev = store.getNumber(REVISION_KEY) ?? 0
    store.set(REVISION_KEY, rev + 1)
}

////////////////////////// Revision-based reactivity

export function getMangaDownloadRevision(): number {
    return store.getNumber(REVISION_KEY) ?? 0
}

export function subscribeToMangaDownloadChanges(callback: () => void): () => void {
    const listener = store.addOnValueChangedListener((key) => {
        if (key === REVISION_KEY) callback()
    })
    return () => listener.remove()
}

function notifyChange(): void {
    hasPendingRevision = true
    if (revisionBatchDepth > 0) return
    flushRevision()
}

export function batchMangaDownloadStoreWrites<T>(write: () => T): T {
    revisionBatchDepth++
    try {
        return write()
    }
    finally {
        revisionBatchDepth = Math.max(0, revisionBatchDepth - 1)
        if (revisionBatchDepth === 0) {
            flushRevision()
        }
    }
}

////////////////////////// Internal index helpers

function readChapterIndex(mediaId: number, provider: string): string[] {
    const raw = store.getString(chapterIndexKey(mediaId, provider))
    if (!raw) return []
    try {
        return JSON.parse(raw) as string[]
    }
    catch {
        return []
    }
}

function writeChapterIndex(mediaId: number, provider: string, chapterIds: string[]): void {
    store.set(chapterIndexKey(mediaId, provider), JSON.stringify(chapterIds))
}

function readGlobalMediaIndex(): number[] {
    const raw = store.getString(GLOBAL_MEDIA_INDEX_KEY)
    if (!raw) return []
    try {
        return JSON.parse(raw) as number[]
    }
    catch {
        return []
    }
}

function writeGlobalMediaIndex(ids: number[]): void {
    store.set(GLOBAL_MEDIA_INDEX_KEY, JSON.stringify(ids))
}

////////////////////////// Path resolution

/**
 * iOS changes the Application UUID on reinstall, so re-root relative
 * paths under the current documents directory.
 */
function resolveLocalDir(storedPath: string): string {
    const marker = "/manga-downloads/"
    const idx = storedPath.lastIndexOf(marker)
    if (idx === -1) return storedPath
    const relativePart = storedPath.slice(idx + 1)
    return `${Paths.document.uri}/${relativePart}`
}

////////////////////////// API

export function saveDownloadedMangaChapter(chapter: DownloadedMangaChapter): void {
    store.set(chapterKey(chapter.mediaId, chapter.provider, chapter.chapterId), JSON.stringify(chapter))

    // update chapter index for this media+provider
    const idx = readChapterIndex(chapter.mediaId, chapter.provider)
    if (!idx.includes(chapter.chapterId)) {
        idx.push(chapter.chapterId)
        writeChapterIndex(chapter.mediaId, chapter.provider, idx)
    }

    // update global media index
    const global = readGlobalMediaIndex()
    if (!global.includes(chapter.mediaId)) {
        global.push(chapter.mediaId)
        writeGlobalMediaIndex(global)
    }

    notifyChange()
}

export function getDownloadedMangaChapter(
    mediaId: number,
    provider: string,
    chapterId: string,
): DownloadedMangaChapter | undefined {
    const raw = store.getString(chapterKey(mediaId, provider, chapterId))
    if (!raw) return undefined
    try {
        const ch = JSON.parse(raw) as DownloadedMangaChapter
        const rawStatus = (ch as { status?: string }).status
        if (rawStatus === "stopped") {
            ch.status = "pending"
            ch.progress = 0
            ch.pagesDownloaded = 0
            ch.totalPages = 0
            ch.errorMessage = undefined
            ch.completedAt = undefined
        }
        ch.localDir = resolveLocalDir(ch.localDir)
        return ch
    }
    catch {
        return undefined
    }
}

export function updateMangaChapterProgress(
    mediaId: number,
    provider: string,
    chapterId: string,
    pagesDownloaded: number,
    totalPages: number,
): void {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    if (!ch) return
    if (ch.status === "completed" || ch.status === "failed") return
    ch.pagesDownloaded = pagesDownloaded
    ch.totalPages = totalPages
    ch.progress = totalPages > 0 ? pagesDownloaded / totalPages : 0
    ch.status = "downloading"
    ch.errorMessage = undefined
    ch.completedAt = undefined
    store.set(chapterKey(mediaId, provider, chapterId), JSON.stringify(ch))
    notifyChange()
}

export function markMangaChapterPending(
    mediaId: number,
    provider: string,
    chapterId: string,
    options?: {
        pagesDownloaded?: number
        totalPages?: number
    },
): void {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    if (!ch) return

    ch.pagesDownloaded = options?.pagesDownloaded ?? ch.pagesDownloaded
    ch.totalPages = options?.totalPages ?? ch.totalPages
    ch.progress = ch.totalPages > 0 ? ch.pagesDownloaded / ch.totalPages : 0
    ch.status = "pending"
    ch.errorMessage = undefined
    ch.completedAt = undefined
    store.set(chapterKey(mediaId, provider, chapterId), JSON.stringify(ch))
    notifyChange()
}

export function markMangaChapterCompleted(
    mediaId: number,
    provider: string,
    chapterId: string,
    localDir: string,
    totalPages: number,
): void {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    if (!ch) return
    ch.status = "completed"
    ch.progress = 1
    ch.pagesDownloaded = totalPages
    ch.totalPages = totalPages
    ch.localDir = localDir
    ch.completedAt = Date.now()
    ch.errorMessage = undefined
    store.set(chapterKey(mediaId, provider, chapterId), JSON.stringify(ch))
    updateMangaInfoDownloadCount(mediaId, provider)
    notifyChange()
}

export function markMangaChapterFailed(
    mediaId: number,
    provider: string,
    chapterId: string,
    errorMessage: string,
): void {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    if (!ch) return
    ch.status = "failed"
    ch.errorMessage = errorMessage
    store.set(chapterKey(mediaId, provider, chapterId), JSON.stringify(ch))
    notifyChange()
}

export function isMangaChapterDownloaded(mediaId: number, provider: string, chapterId: string): boolean {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    return ch?.status === "completed"
}

export function getMangaChapterDownloadStatus(
    mediaId: number,
    provider: string,
    chapterId: string,
): MangaDownloadStatus | null {
    const ch = getDownloadedMangaChapter(mediaId, provider, chapterId)
    return ch?.status ?? null
}

////////////////////////// Enumeration

/**
 * Get all downloaded chapters for a media+provider combination.
 */
export function getDownloadedChaptersForMedia(mediaId: number, provider: string): DownloadedMangaChapter[] {
    const chapterIds = readChapterIndex(mediaId, provider)
    const chapters: DownloadedMangaChapter[] = []
    for (const id of chapterIds) {
        const ch = getDownloadedMangaChapter(mediaId, provider, id)
        if (ch) chapters.push(ch)
    }
    return chapters.sort((a, b) => parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber))
}


export function getCompletedChaptersForMedia(mediaId: number, provider: string): DownloadedMangaChapter[] {
    return getDownloadedChaptersForMedia(mediaId, provider).filter(ch => ch.status === "completed")
}

/**
 * Get all chapters across all providers for a media.
 * First finds all provider keys that match this media in the store.
 */
export function getAllDownloadedChaptersForMediaAllProviders(mediaId: number): DownloadedMangaChapter[] {
    const chapters: DownloadedMangaChapter[] = []
    // scan all keys for this media
    const allKeys = store.getAllKeys()
    const prefix = `manga-ch-idx:${mediaId}:`
    for (const key of allKeys) {
        if (key.startsWith(prefix)) {
            const provider = key.slice(prefix.length)
            chapters.push(...getDownloadedChaptersForMedia(mediaId, provider))
        }
    }
    return chapters.sort((a, b) => parseFloat(a.chapterNumber) - parseFloat(b.chapterNumber))
}

export function getActiveMangaDownloads(): DownloadedMangaChapter[] {
    const mediaIds = readGlobalMediaIndex()
    const active: DownloadedMangaChapter[] = []
    const allKeys = store.getAllKeys()
    for (const mId of mediaIds) {
        const prefix = `manga-ch-idx:${mId}:`
        for (const key of allKeys) {
            if (key.startsWith(prefix)) {
                const provider = key.slice(prefix.length)
                const chapters = getDownloadedChaptersForMedia(mId, provider)
                for (const ch of chapters) {
                    if (ch.status === "downloading" || ch.status === "pending") {
                        active.push(ch)
                    }
                }
            }
        }
    }
    return active
}

export function getFailedMangaDownloads(): DownloadedMangaChapter[] {
    const mediaIds = readGlobalMediaIndex()
    const failed: DownloadedMangaChapter[] = []
    const allKeys = store.getAllKeys()
    for (const mId of mediaIds) {
        const prefix = `manga-ch-idx:${mId}:`
        for (const key of allKeys) {
            if (key.startsWith(prefix)) {
                const provider = key.slice(prefix.length)
                const chapters = getDownloadedChaptersForMedia(mId, provider)
                for (const ch of chapters) {
                    if (ch.status === "failed") {
                        failed.push(ch)
                    }
                }
            }
        }
    }
    return failed
}

export function removeDownloadedMangaChapter(mediaId: number, provider: string, chapterId: string): void {
    store.remove(chapterKey(mediaId, provider, chapterId))

    const idx = readChapterIndex(mediaId, provider).filter(id => id !== chapterId)
    writeChapterIndex(mediaId, provider, idx)

    // check if this media still has chapters across all providers
    const hasChapters = getAllDownloadedChaptersForMediaAllProviders(mediaId).length > 0
    if (!hasChapters) {
        const global = readGlobalMediaIndex().filter(id => id !== mediaId)
        writeGlobalMediaIndex(global)
        store.remove(mangaInfoKey(mediaId))
        removeDownloadEntrySnapshot("manga", mediaId)
    } else {
        updateMangaInfoDownloadCount(mediaId, provider)
    }

    notifyChange()
}

export function removeAllMangaDownloadsForMedia(mediaId: number): void {
    const allKeys = store.getAllKeys()
    const prefix = `manga-ch-idx:${mediaId}:`
    for (const key of allKeys) {
        if (key.startsWith(prefix)) {
            const provider = key.slice(prefix.length)
            const chapterIds = readChapterIndex(mediaId, provider)
            for (const chId of chapterIds) {
                store.remove(chapterKey(mediaId, provider, chId))
            }
            store.remove(key)
        }
    }
    store.remove(mangaInfoKey(mediaId))
    removeDownloadEntrySnapshot("manga", mediaId)

    const global = readGlobalMediaIndex().filter(id => id !== mediaId)
    writeGlobalMediaIndex(global)

    notifyChange()
}

export function clearAllMangaDownloadRecords(): void {
    store.clearAll()
    notifyChange()
}

////////////////////////// Manga info tracking

export function saveMangaInfo(info: DownloadedMangaInfo): void {
    store.set(mangaInfoKey(info.mediaId), JSON.stringify(info))
    notifyChange()
}

export function getMangaInfo(mediaId: number): DownloadedMangaInfo | undefined {
    const raw = store.getString(mangaInfoKey(mediaId))
    if (!raw) return undefined
    try {
        return JSON.parse(raw) as DownloadedMangaInfo
    }
    catch {
        return undefined
    }
}

export function getAllDownloadedManga(): DownloadedMangaInfo[] {
    const mediaIds = readGlobalMediaIndex()
    const result: DownloadedMangaInfo[] = []
    for (const id of mediaIds) {
        const info = getMangaInfo(id)
        if (info && info.downloadedCount > 0) {
            result.push(info)
        }
    }
    return result
}

function updateMangaInfoDownloadCount(mediaId: number, provider: string): void {
    const info = getMangaInfo(mediaId)
    if (!info) return
    // count completed chapters across all providers
    info.downloadedCount = getAllDownloadedChaptersForMediaAllProviders(mediaId)
        .filter(ch => ch.status === "completed").length
    store.set(mangaInfoKey(mediaId), JSON.stringify(info))
}

export function getTotalMangaDownloadSize(): number {
    return 0
}
