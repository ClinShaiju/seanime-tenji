import { Status } from "@/api/generated/types"
import { createAtomStorage, getStoredJsonValue } from "@/atoms/storage"
import { useAtomValue, useSetAtom } from "jotai"
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
