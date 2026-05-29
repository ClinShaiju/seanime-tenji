import { createMMKV } from "react-native-mmkv"

const store = createMMKV({ id: "seanime-offline-entries" })

export type OfflineEntryType = "anime" | "manga"

export type SavedOfflineEntry = {
    anilistId: number
    type: OfflineEntryType
    title: string
    coverImageUrl: string | undefined
    /** Full serialized entry payload (Anime_Entry or Manga_Entry JSON) */
    payload: string
    savedAt: number
}

//////////////////////////

function entryKey(type: OfflineEntryType, anilistId: number): string {
    return `entry:${type}:${anilistId}`
}

function indexKey(type: OfflineEntryType): string {
    return `index:${type}`
}

function readIndex(type: OfflineEntryType): number[] {
    const raw = store.getString(indexKey(type))
    if (!raw) return []
    try {
        return JSON.parse(raw) as number[]
    }
    catch {
        return []
    }
}

function writeIndex(type: OfflineEntryType, ids: number[]): void {
    store.set(indexKey(type), JSON.stringify(ids))
}

////////////////////////// API

export function saveEntryOffline(entry: SavedOfflineEntry): void {
    store.set(entryKey(entry.type, entry.anilistId), JSON.stringify(entry))

    const ids = readIndex(entry.type)
    if (!ids.includes(entry.anilistId)) {
        ids.push(entry.anilistId)
        writeIndex(entry.type, ids)
    }
}

export function removeOfflineEntry(type: OfflineEntryType, anilistId: number): void {
    store.remove(entryKey(type, anilistId))

    const ids = readIndex(type).filter(id => id !== anilistId)
    writeIndex(type, ids)
}

export function getOfflineEntry(type: OfflineEntryType, anilistId: number): SavedOfflineEntry | undefined {
    const raw = store.getString(entryKey(type, anilistId))
    if (!raw) return undefined
    try {
        return JSON.parse(raw) as SavedOfflineEntry
    }
    catch {
        return undefined
    }
}

export function isEntrySavedOffline(type: OfflineEntryType, anilistId: number): boolean {
    return store.contains(entryKey(type, anilistId))
}

export function getAllOfflineEntries(type: OfflineEntryType): SavedOfflineEntry[] {
    const ids = readIndex(type)
    const entries: SavedOfflineEntry[] = []
    for (const id of ids) {
        const entry = getOfflineEntry(type, id)
        if (entry) {
            entries.push(entry)
        }
    }
    return entries
}

export function getOfflineEntryCount(type: OfflineEntryType): number {
    return readIndex(type).length
}

/**
 * Update the cached payload for an existing offline entry.
 * Call this when fresh data arrives from the server so the offline snapshot stays current.
 */
export function refreshOfflineEntry(
    type: OfflineEntryType,
    anilistId: number,
    freshPayload: string,
    title?: string,
    coverImageUrl?: string,
): void {
    const existing = getOfflineEntry(type, anilistId)
    if (!existing) return

    const updated: SavedOfflineEntry = {
        ...existing,
        payload: freshPayload,
        ...(title !== undefined && { title }),
        ...(coverImageUrl !== undefined && { coverImageUrl }),
    }
    store.set(entryKey(type, anilistId), JSON.stringify(updated))
}

export function clearAllOfflineEntries(type: OfflineEntryType): void {
    const ids = readIndex(type)
    for (const id of ids) {
        store.remove(entryKey(type, id))
    }
    writeIndex(type, [])
}
