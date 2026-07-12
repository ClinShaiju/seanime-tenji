import { getClientHeaders, saveClientIdentityFromHeaders } from "@/api/client/client-identity"
import { getServerAuthHeaders } from "@/api/client/server-auth"
import { getServerBaseUrl } from "@/api/client/server-url"
import { getStoredServerAuthToken, useServerAuthToken, useServerUrl, useSetServerAuthToken } from "@/atoms/server.atoms"
import { isGlobalConnected, isManualOfflineModeEnabled, markServerReachable, markServerUnreachable } from "@/lib/connection-state"
import { logger } from "@/lib/utils/logger"
import { toast } from "@/lib/utils/toast"
import { useMutation, UseMutationOptions, useQuery, UseQueryOptions } from "@tanstack/react-query"
import { useEffect } from "react"


export type SeaError = Error & {
    error: string
    status?: number
    // Set when the rejection came from a request abort (timeout). Outer toast layers
    // (useServerMutation/useServerQuery) skip aborted rejections so a deliberate 45s
    // timeout doesn't surface a spurious "Server Error: Aborted" toast.
    aborted?: boolean
}

const log = logger("requests")

// Bound every request so a dying cellular connection can't hang a query forever (iOS lets
// fetch sit 60s+ before the OS gives up, and React Query's retry never fires on a request
// that never fails). Generous because debrid stream starts can legitimately take ~20s.
const REQUEST_TIMEOUT_MS = 45_000

type SeaQuery<D> = {
    serverUrl: string | null | undefined
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    data?: D
    params?: D
    authToken?: string | null
    muteError?: boolean
    // Force reading the response as binary instead of JSON/text. FormData request bodies
    // are auto-detected (no flag needed); this is only for binary *responses*.
    responseType?: "json" | "blob" | "arraybuffer"
}

function createSeaError(message: string, status?: number): SeaError {
    const error = new Error(message) as SeaError
    error.error = message
    error.status = status
    return error
}

function normalizeSeaError(error: unknown): SeaError {
    if (error instanceof Error && "error" in error && typeof error.error === "string") {
        return error as SeaError
    }

    if (error instanceof Error) {
        return createSeaError(error.message)
    }

    if (typeof error === "string") {
        return createSeaError(error)
    }

    if (typeof error === "object" && error !== null && "error" in error && typeof error.error === "string") {
        return createSeaError(error.error)
    }

    return createSeaError("Unknown error occurred")
}

function isConnectivityFailure(error: unknown, seaError: SeaError): boolean {
    if (seaError.status !== undefined) return false

    if (error instanceof Error && error.name === "AbortError") {
        return false
    }

    const message = seaError.error.toLowerCase()

    return error instanceof TypeError
        || message.includes("network request failed")
        || message.includes("failed to fetch")
        || message.includes("load failed")
        || message.includes("network error")
        || message.includes("internet connection appears to be offline")
}

export async function buildSeaQuery<T, D = unknown>(
    {
        serverUrl,
        endpoint,
        method,
        data,
        params,
        authToken,
        muteError,
        responseType,
    }: SeaQuery<D>): Promise<T | undefined> {
    const url = new URL(getServerBaseUrl(serverUrl) + endpoint)
    const resolvedAuthToken = authToken ?? getStoredServerAuthToken()

    // append params to the url if they exist and it's a GET request
    if (params && method === "GET") {
        Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                url.searchParams.append(key, String(value))
            }
        })
    }

    // For multipart uploads let fetch derive the Content-Type (incl. the boundary);
    // hard-coding application/json here breaks c.FormFile("file") on the server.
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData

    // Configure fetch options
    const options: RequestInit = {
        method,
        headers: {
            ...(isFormData ? {} : { "Content-Type": "application/json" }),
            ...getServerAuthHeaders(resolvedAuthToken),
            ...getClientHeaders(),
        },
    }

    if (data && method !== "GET") {
        options.body = isFormData ? (data as FormData) : JSON.stringify(data)
    }

    if (isManualOfflineModeEnabled()) {
        return Promise.reject(createSeaError("OFFLINE_MODE_ENABLED"))
    }

    // AbortController + setTimeout instead of AbortSignal.timeout (not available on Hermes)
    let timedOut = false
    const timeoutController = new AbortController()
    const timeoutId = setTimeout(() => {
        timedOut = true
        timeoutController.abort()
    }, REQUEST_TIMEOUT_MS)
    options.signal = timeoutController.signal

    try {
        const response = await fetch(url.toString(), options)
        markServerReachable()
        saveClientIdentityFromHeaders(response.headers)

        // Binary responses (e.g. the /report zip download) must not go through text()/JSON.parse
        // — that UTF-8-mangles the bytes. Honor an explicit responseType or a binary content-type.
        const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
        const wantsBinary = responseType === "blob" || responseType === "arraybuffer"
            || contentType.includes("application/zip")
            || contentType.includes("application/octet-stream")
        if (wantsBinary) {
            if (!response.ok) {
                throw createSeaError(`Request failed with status ${response.status}`, response.status)
            }
            const body = responseType === "arraybuffer" ? await response.arrayBuffer() : await response.blob()
            return body as T
        }

        const text = await response.text()
        let responseData: { data?: T; error?: string } | undefined

        if (text) {
            try {
                responseData = JSON.parse(text) as { data?: T; error?: string }
            }
            catch {
                if (!response.ok) {
                    throw createSeaError(`Request failed with status ${response.status}`, response.status)
                }

                return text as T
            }
        }

        if (!text) {
            if (!response.ok) {
                throw createSeaError(`Request failed with status ${response.status}`, response.status)
            }
            return undefined as T
        }

        if (!response.ok) {
            // Handle error by returning a rejected promise with the error message
            throw createSeaError(responseData?.error || "Unknown error occurred", response.status)
        }

        return responseData?.data as T
    }
    catch (error: unknown) {
        const seaError = normalizeSeaError(error)
        const wasAborted = error instanceof Error && error.name === "AbortError"
        // Mark aborted rejections so the outer hook toast layers can skip them.
        if (wasAborted) seaError.aborted = true
        // A timeout abort (not a user/navigation abort) is a bad-but-not-dead connection —
        // count it as a connectivity failure so the offline UX path engages (L6).
        const connectivityFailure = isConnectivityFailure(error, seaError) || (wasAborted && timedOut)

        if (connectivityFailure) {
            markServerUnreachable()
        }

        log.warning("Fetch error", seaError)
        // only show toast when we believe the device is online, avoids
        // spamming "Network request failed" toasts while offline
        if (!wasAborted && !muteError && isGlobalConnected()) {
            toast.error("An error occurred: " + seaError.error, {
                visibilityTime: 5000,
            })
        }
        // Return the error message as rejected promise to be handled by tsquery
        return Promise.reject(seaError)
    }
    finally {
        clearTimeout(timeoutId)
    }
}

type ServerMutationProps<R, V = void> = UseMutationOptions<R | undefined, SeaError, V, unknown> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    muteError?: boolean
}

export function useServerMutation<R = void, V = void>(
    {
        endpoint,
        method,
        muteError,
        onError: userOnError,
        ...options
    }: ServerMutationProps<R, V>) {

    const serverUrl = useServerUrl()
    const authToken = useServerAuthToken()
    const setServerAuthToken = useSetServerAuthToken()

    return useMutation<R | undefined, SeaError, V>({
        onError: (error, variables, onMutateResult, mutationContext) => {
            if (error.error === "UNAUTHENTICATED") {
                setServerAuthToken(null)
                userOnError?.(error, variables, onMutateResult, mutationContext)
                return
            }

            // This hook layer is the single toast owner (buildSeaQuery is muted below), so
            // suppress when offline, when muted, or when the request was aborted (timeout).
            if (!muteError && !error.aborted && isGlobalConnected()) {
                toast.error(_handleSeaError(error.error))
            }

            userOnError?.(error, variables, onMutateResult, mutationContext)
        },
        mutationFn: async (variables) => {
            return buildSeaQuery<R, V>({
                serverUrl: serverUrl,
                endpoint: endpoint,
                method: method,
                data: variables,
                authToken,
                // Mute the inner toast — the hook onError above is the single owner.
                muteError: true,
            })
        },
        ...options,
    })
}


type ServerQueryProps<R, V> = UseQueryOptions<R | undefined, SeaError, R | undefined> & {
    endpoint: string
    method: "POST" | "GET" | "PATCH" | "DELETE" | "PUT"
    params?: V
    data?: V
    muteError?: boolean
}

export function useServerQuery<R, V = any>(
    {
        endpoint,
        method,
        params,
        data,
        muteError,
        ...options
    }: ServerQueryProps<R | undefined, V>) {
    const serverUrl = useServerUrl()
    const authToken = useServerAuthToken()
    const setServerAuthToken = useSetServerAuthToken()

    const props = useQuery<R | undefined, SeaError>({
        queryFn: async () => {
            return buildSeaQuery<R, V>({
                serverUrl: serverUrl,
                endpoint: endpoint,
                method: method,
                params: params,
                data: data,
                authToken,
                // Mute the inner toast — the error effect below is the single owner.
                muteError: true,
            })
        },
        ...options,
        enabled: !!serverUrl && (options.enabled ?? true),
    })

    useEffect(() => {
        if (!props.isError) return

        if (props.error?.error === "UNAUTHENTICATED") {
            setServerAuthToken(null)
            return
        }

        // Single toast owner for the query path; skip aborted (timeout) rejections.
        if (!muteError && !props.error?.aborted && isGlobalConnected()) {
            log.warning("Server error", props.error)
            toast.error(_handleSeaError(props.error?.error))
        }
    }, [props.error, props.isError, muteError, setServerAuthToken])

    return props
}

//----------------------------------------------------------------------------------------------------------------------

function _handleSeaError(data: any): string {
    if (typeof data === "string") return "Server Error: " + data

    const err = data?.error as string

    if (!err) return "Unknown error"

    if (err.includes("Too many requests"))
        return "AniList: Too many requests, please wait a moment and try again."

    try {
        const graphqlErr = JSON.parse(err) as any
        log.warning("AniList error", graphqlErr)
        if (graphqlErr.graphqlErrors && graphqlErr.graphqlErrors.length > 0 && !!graphqlErr.graphqlErrors[0]?.message) {
            return "AniList error: " + graphqlErr.graphqlErrors[0]?.message
        }
        return "AniList error"
    }
    catch (e) {
        return "Error: " + err
    }
}

function _handleSeaResponse<T>(res: unknown): { data: T | undefined, error: string | undefined } {

    if (typeof res === "object" && !!res && "error" in res && typeof res.error === "string") {
        return { data: undefined, error: res.error }
    }
    if (typeof res === "object" && !!res && "data" in res) {
        return { data: res.data as T, error: undefined }
    }

    return { data: undefined, error: "No response from the server" }

}
