import { Status } from "@/api/generated/types"
import { getSecureStoredString, secureStringStorage } from "@/atoms/secure-tokens"
import { createAtomStorage } from "@/atoms/storage"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"

// The two bearer credentials live in the iOS Keychain (via secure-tokens.ts), not the
// plaintext MMKV store. JSON-encoded so the format matches the previous MMKV storage,
// letting hydrateSecureTokens() migrate existing tokens verbatim.
function createSecureTokenStorage() {
    return createJSONStorage<string | null>(() => secureStringStorage)
}

function readSecureToken(key: string): string | null {
    const raw = getSecureStoredString(key)
    if (raw == null) return null
    try {
        return JSON.parse(raw) as string | null
    } catch {
        return null
    }
}

/**
 * Server URL
 */

const serverUrlAtom = atomWithStorage<string | null>("sea-server-url", null, createAtomStorage<string | null>(), { getOnInit: true })
export const SERVER_AUTH_TOKEN_STORAGE_KEY = "sea-server-auth-token"
const serverAuthTokenAtom = atomWithStorage<string | null>(SERVER_AUTH_TOKEN_STORAGE_KEY,
    null,
    createSecureTokenStorage(),
    { getOnInit: true })

export function useServerUrl() {
    return useAtomValue(serverUrlAtom)
}

export function useServerUrlProtocol() {
    const serverUrl = useServerUrl()
    return serverUrl ? new URL(serverUrl).protocol : null
}

export function useSetServerUrl() {
    return useSetAtom(serverUrlAtom)
}

export function useServerAuthToken() {
    return useAtomValue(serverAuthTokenAtom)
}

export function useSetServerAuthToken() {
    return useSetAtom(serverAuthTokenAtom)
}

export function getStoredServerAuthToken() {
    return readSecureToken(SERVER_AUTH_TOKEN_STORAGE_KEY)
}

/**
 * Session token (multi-user profiles)
 *
 * Distinct from the server-password auth token above: this is the per-user session
 * issued by POST /api/v1/user/login, sent as `Authorization: Bearer <token>`. With
 * the server's anon-data hardening, a client that only knows the server password
 * gets an empty session — it must present this to act as a user.
 */
export const SESSION_TOKEN_STORAGE_KEY = "sea-session-token"
const sessionTokenAtom = atomWithStorage<string | null>(SESSION_TOKEN_STORAGE_KEY,
    null,
    createSecureTokenStorage(),
    { getOnInit: true })

export function useSessionToken() {
    return useAtomValue(sessionTokenAtom)
}

export function useSetSessionToken() {
    return useSetAtom(sessionTokenAtom)
}

export function getStoredSessionToken() {
    return readSecureToken(SESSION_TOKEN_STORAGE_KEY)
}

/**
 * Server Status
 */

export const serverStatusAtom = atomWithStorage<Status | null>("sea-server-status", null, createAtomStorage<Status | null>(), { getOnInit: true })

export function useServerStatus() {
    return useAtomValue(serverStatusAtom)
}

export function useCurrentUser() {
    const serverStatus = useAtomValue(serverStatusAtom)

    // React.useEffect(() => {
    //     logger("useCurrentUser").info(serverStatus)
    // }, [serverStatus])

    return serverStatus?.user
}

export function useSetServerStatus() {
    return useSetAtom(serverStatusAtom)
}

// Narrow per-field selectors for components rendered many times per screen (media cards).
// Each derived atom holds a primitive, so subscribers only re-render when that specific
// setting flips — not whenever the whole Status object is replaced.
const hideAudienceScoreAtom = atom(get => !!get(serverStatusAtom)?.settings?.anilist?.hideAudienceScore)
const blurAdultContentAtom = atom(get => !!get(serverStatusAtom)?.settings?.anilist?.blurAdultContent)
const showAnimeUnwatchedCountAtom = atom(get => get(serverStatusAtom)?.themeSettings?.showAnimeUnwatchedCount ?? true)

export function useMediaCardDisplaySettings() {
    return {
        hideAudienceScore: useAtomValue(hideAudienceScoreAtom),
        blurAdultContent: useAtomValue(blurAdultContentAtom),
        showAnimeUnwatchedCount: useAtomValue(showAnimeUnwatchedCountAtom),
    }
}

// Narrow selectors for the episode-spoiler themeSettings fields, used by per-item episode
// components (episode-list-item, episode-card-list) so they only re-render when a spoiler
// setting actually flips, not on every serverStatusAtom write.
const hideAnimeSpoilersAtom = atom(get => get(serverStatusAtom)?.themeSettings?.hideAnimeSpoilers)
const hideAnimeSpoilerSkipNextEpisodeAtom = atom(get => get(serverStatusAtom)?.themeSettings?.hideAnimeSpoilerSkipNextEpisode)
const hideAnimeSpoilerThumbnailsAtom = atom(get => get(serverStatusAtom)?.themeSettings?.hideAnimeSpoilerThumbnails)
const hideAnimeSpoilerTitlesAtom = atom(get => get(serverStatusAtom)?.themeSettings?.hideAnimeSpoilerTitles)
const hideAnimeSpoilerDescriptionsAtom = atom(get => get(serverStatusAtom)?.themeSettings?.hideAnimeSpoilerDescriptions)

export function useEpisodeSpoilerThemeSettings() {
    return {
        hideAnimeSpoilers: useAtomValue(hideAnimeSpoilersAtom),
        hideAnimeSpoilerSkipNextEpisode: useAtomValue(hideAnimeSpoilerSkipNextEpisodeAtom),
        hideAnimeSpoilerThumbnails: useAtomValue(hideAnimeSpoilerThumbnailsAtom),
        hideAnimeSpoilerTitles: useAtomValue(hideAnimeSpoilerTitlesAtom),
        hideAnimeSpoilerDescriptions: useAtomValue(hideAnimeSpoilerDescriptionsAtom),
    }
}

// Narrow selectors for the two debrid settings fields per-item prewarm indicators need.
const debridEnabledAtom = atom(get => !!get(serverStatusAtom)?.debridSettings?.enabled)
const debridPreloadNextStreamAtom = atom(get => !!get(serverStatusAtom)?.debridSettings?.preloadNextStream)

export function useDebridPrewarmSettings() {
    return {
        enabled: useAtomValue(debridEnabledAtom),
        preloadNextStream: useAtomValue(debridPreloadNextStreamAtom),
    }
}
