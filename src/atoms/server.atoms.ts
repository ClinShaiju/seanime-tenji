import { Status } from "@/api/generated/types"
import { createAtomStorage, getStoredJsonValue } from "@/atoms/storage"
import { atom, useAtomValue, useSetAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"

/**
 * Server URL
 */

const serverUrlAtom = atomWithStorage<string | null>("sea-server-url", null, createAtomStorage<string | null>(), { getOnInit: true })
export const SERVER_AUTH_TOKEN_STORAGE_KEY = "sea-server-auth-token"
const serverAuthTokenAtom = atomWithStorage<string | null>(SERVER_AUTH_TOKEN_STORAGE_KEY,
    null,
    createAtomStorage<string | null>(),
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
    return getStoredJsonValue<string | null>(SERVER_AUTH_TOKEN_STORAGE_KEY)
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
    createAtomStorage<string | null>(),
    { getOnInit: true })

export function useSessionToken() {
    return useAtomValue(sessionTokenAtom)
}

export function useSetSessionToken() {
    return useSetAtom(sessionTokenAtom)
}

export function getStoredSessionToken() {
    return getStoredJsonValue<string | null>(SESSION_TOKEN_STORAGE_KEY)
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
