import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { getAllDownloadedAnime } from "@/lib/downloads/download-store"
import { QueryClient } from "@tanstack/react-query"
import { createMMKV } from "react-native-mmkv"
import { getAllDownloadedManga } from "./downloads"

/**
 * - On each successful query, the response JSON is written to MMKV under a stable key
 * - On app launch, cached responses are restored into the QueryClient so the UI
 *   renders immediately with stale data
 * - Background refetches then update both the in-memory cache and MMKV
 * - If the device is offline, the stale cached data is shown with no error
 */

const cacheStorage = createMMKV({ id: "seanime-query-cache" })

const CACHE_KEY_PREFIX = "qc:"
const CACHE_VERSION_KEY = "qc:__version__"
const CURRENT_CACHE_VERSION = 1

/**
 * Query keys that should be hydrated from cache on app startup.
 * These power the main screens so they render instantly even when offline.
 */
export const OFFLINE_QUERY_KEYS: readonly (readonly string[])[] = [
    [API_ENDPOINTS.STATUS.GetStatus.key],
    [API_ENDPOINTS.ANILIST.GetAnimeCollection.key],
    [API_ENDPOINTS.ANILIST.GetRawAnimeCollection.key],
    [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key],
    [API_ENDPOINTS.MANGA.GetAnilistMangaCollection.key],
    [API_ENDPOINTS.MANGA.GetRawAnilistMangaCollection.key],
    [API_ENDPOINTS.MANGA.GetMangaCollection.key],
    [API_ENDPOINTS.ANIME_COLLECTION.GetAnimeCollectionSchedule.key],
    [API_ENDPOINTS.ANIME_ENTRIES.GetMissingEpisodes.key],
    [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key],
]

/**
 * Persist a single query result to MMKV.
 * Call this from the QueryClient's onSuccess global callback or from individual hooks.
 */
export function persistQueryData(queryKey: readonly unknown[], data: unknown): void {
    const key = serializeQueryKey(queryKey)
    try {
        cacheStorage.set(CACHE_KEY_PREFIX + key, JSON.stringify(data))
    }
    catch {

    }
}

/**
 * Restore a single cached query result from MMKV.
 * Returns undefined if no cached data exists.
 */
export function restoreQueryData<T = unknown>(queryKey: readonly unknown[]): T | undefined {
    const key = serializeQueryKey(queryKey)
    const raw = cacheStorage.getString(CACHE_KEY_PREFIX + key)
    if (raw === undefined) return undefined
    try {
        return JSON.parse(raw) as T
    }
    catch {
        return undefined
    }
}

/**
 * Hydrate a QueryClient from MMKV cache for a set of known query keys.
 * Call this once at app startup before rendering.
 *
 * Only restores queries listed in `queryKeys`, not the entire cache.
 * This keeps hydration fast.
 */
export function hydrateQueryClient(
    queryClient: QueryClient,
    queryKeys: readonly (readonly unknown[])[],
): void {
    // version gate, if the cache was written by a different version, wipe it
    const storedVersion = cacheStorage.getNumber(CACHE_VERSION_KEY)
    if (storedVersion !== CURRENT_CACHE_VERSION) {
        clearQueryCache()
        cacheStorage.set(CACHE_VERSION_KEY, CURRENT_CACHE_VERSION)
        return
    }

    for (const queryKey of queryKeys) {
        const data = restoreQueryData(queryKey)
        if (data !== undefined) {
            queryClient.setQueryData(queryKey, data)
        }
    }

    // also hydrate anime entry data for any downloaded anime so
    // the entry page works offline after a cold start
    try {
        const downloadedAnime = getAllDownloadedAnime()
        const entryKey = API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key
        for (const anime of downloadedAnime) {
            const qk = [entryKey, String(anime.mediaId)]
            const data = restoreQueryData(qk)
            if (data !== undefined) {
                queryClient.setQueryData(qk, data)
            }
        }
    }
    catch {

    }

    // also hydrate manga entry data for any downloaded manga
    try {
        const downloadedManga = getAllDownloadedManga()
        const entryKey = API_ENDPOINTS.MANGA.GetMangaEntry.key
        for (const manga of downloadedManga) {
            const qk = [entryKey, String(manga.mediaId)]
            const data = restoreQueryData(qk)
            if (data !== undefined) {
                queryClient.setQueryData(qk, data)
            }
        }
    }
    catch {

    }
}

export function clearQueryCache(): void {
    const keys = cacheStorage.getAllKeys()
    for (const key of keys) {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            cacheStorage.remove(key)
        }
    }
}

export function setupQueryPersistence(queryClient: QueryClient): void {
    const cache = queryClient.getQueryCache()

    cache.subscribe((event) => {
        if (
            event.type === "updated" &&
            event.action.type === "success" &&
            event.query.state.data !== undefined
        ) {
            persistQueryData(event.query.queryKey, event.query.state.data)
        }
    })
}

function serializeQueryKey(queryKey: readonly unknown[]): string {
    return JSON.stringify(queryKey)
}
