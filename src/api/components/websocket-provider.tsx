import { addClientQueryParams, onClientIdentityChange, saveClientIdentityFromEvent } from "@/api/client/client-identity"
import { getServerBaseUrl } from "@/api/client/server-url"
import { useWebsocketEventRouter } from "@/api/components/websocket-event-router"
import { useServerAuthToken, useServerUrl, useServerUrlProtocol, useSessionToken } from "@/atoms/server.atoms"
import { dispatchWsMessage, websocketAtom, WebsocketContext } from "@/atoms/websocket.atoms"
import { degradeServerReachability, markServerReachable } from "@/lib/connection-state"
import { manualOfflineModeAtom } from "@/lib/offline/manual-offline-mode"
import { logger } from "@/lib/utils/logger"
import { atom } from "jotai"
import { useAtomValue } from "jotai/react"
import { useAtom } from "jotai/react"
import React from "react"
import { AppState } from "react-native"

const CLIENT_IDENTITY_EVENT = "client-identity"

export const websocketConnectedAtom = atom(false)
export const websocketConnectionStateAtom = atom<"idle" | "connecting" | "connected" | "disconnected">("idle")

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    const serverUrl = useServerUrl()
    const serverAuthToken = useServerAuthToken()
    const sessionToken = useSessionToken()
    const serverUrlProtocol = useServerUrlProtocol()
    const manualOffline = useAtomValue(manualOfflineModeAtom)
    const [socket, setSocket] = useAtom(websocketAtom)
    const [isConnected, setIsConnected] = useAtom(websocketConnectedAtom)
    const [, setConnectionState] = useAtom(websocketConnectionStateAtom)

    useWebsocketEventRouter()

    const retryCount = React.useRef(0)
    const retryTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    // The client id THIS socket is registered under server-side (from the client-identity
    // event the server pushes on connect). Targeted events are routed by this id.
    const socketIdentityId = React.useRef("")
    const lastIdentityReconnect = React.useRef(0)

    React.useEffect(() => {
        if (!serverUrl || manualOffline) {
            setSocket(null)
            setIsConnected(false)
            setConnectionState(manualOffline ? "disconnected" : "idle")
            return
        }

        let currentSocket: WebSocket | null = null
        let cancelled = false

        function connectWebSocket() {
            if (cancelled) return

            setConnectionState("connecting")
            const searchParams = new URLSearchParams()
            addClientQueryParams(searchParams)

            if (serverAuthToken) {
                searchParams.set("token", serverAuthToken)
            }

            // Per-user event scoping + per-user streaming: tag this connection with the
            // logged-in user so the server routes their events (and only theirs) here.
            if (sessionToken) {
                searchParams.set("session", sessionToken)
            }

            const socketUrl = `${serverUrlProtocol === "https:" ? "wss" : "ws"}://${getServerBaseUrl(serverUrl,
                true)}/events?${searchParams.toString()}`
            const s = new WebSocket(socketUrl)
            currentSocket = s
            // Never log the credentialed URL: `token`/`session` are full-account bearers and
            // logger entries persist raw to MMKV (redaction only runs at export time).
            const redactedUrl = socketUrl.replace(/([?&](?:token|session)=)[^&]+/gi, "$1[redacted]")
            logger("websocket-provider").info("Connecting to WebSocket", redactedUrl)

            s.addEventListener("open", () => {
                logger("websocket-provider").info("WebSocket connection opened")
                setIsConnected(true)
                setConnectionState("connected")
                markServerReachable()
                retryCount.current = 0
            })

            s.addEventListener("close", () => {
                if (cancelled) return
                logger("websocket-provider").info("WebSocket connection closed")
                setIsConnected(false)
                setConnectionState("disconnected")
                degradeServerReachability()

                retryCount.current += 1

                // capped at 30s
                const delay = Math.min(1500 * Math.pow(2, retryCount.current - 1), 30_000)
                logger("websocket-provider").info(`Reconnecting in ${delay}ms (attempt ${retryCount.current})`)
                retryTimeout.current = setTimeout(connectWebSocket, delay)
            })

            // Parse each frame ONCE and fan out to the hub (router, player session,
            // watch rooms subscribe there instead of re-parsing per listener).
            s.addEventListener("message", event => {
                if (typeof event.data !== "string") {
                    return
                }

                let message: { type?: string; payload?: unknown }
                try {
                    message = JSON.parse(event.data) as { type?: string; payload?: unknown }
                }
                catch (err) {
                    // iOS has no console; surface parse failures via the offline logger.
                    logger("websocket-provider").warning("Failed to parse WebSocket message", err)
                    return
                }

                if (typeof message?.type !== "string") return

                try {
                    if (message.type === CLIENT_IDENTITY_EVENT) {
                        const payload = message.payload as { clientId?: string } | null
                        if (typeof payload?.clientId === "string" && payload.clientId) {
                            socketIdentityId.current = payload.clientId
                        }
                        saveClientIdentityFromEvent(message.payload)
                    }
                    dispatchWsMessage({ type: message.type, payload: message.payload })
                }
                catch (err) {
                    // A throwing subscriber must not silently kill the ingress; log and move on.
                    logger("websocket-provider").error("WebSocket message handler threw", message.type, err)
                }
            })

            setSocket(s)
            return s
        }

        // On any dependency change (login/logout session flip, serverUrl/authToken/protocol
        // edit) React runs the previous cleanup first — which calls close(), moving the old
        // socket to CLOSING *synchronously* — then this body in the same commit. The old
        // guard (`=== CLOSED`) saw a non-null CLOSING socket and skipped the reconnect, so
        // the whole event plane went silently dead until a background/foreground cycle.
        // Treat anything at/past CLOSING as reconnectable so a dep change always reconnects.
        if (!socket || socket.readyState >= WebSocket.CLOSING) {
            connectWebSocket()
        }

        // If the HTTP plane re-issues a DIFFERENT client id than the one this socket is
        // registered under (identity proof re-sync after a server restart), the socket is
        // orphaned: server events targeted at the settled id never reach it — debrid
        // playback silently "does nothing". Reconnect so the socket re-registers under
        // the settled id. Min 10s between identity-driven reconnects so a pathological
        // id fight can't storm.
        const unsubIdentity = onClientIdentityChange(identity => {
            if (cancelled || !identity.clientId) return
            if (!socketIdentityId.current || identity.clientId === socketIdentityId.current) return
            const now = Date.now()
            if (now - lastIdentityReconnect.current < 10_000) return
            lastIdentityReconnect.current = now
            logger("websocket-provider").info("Client identity changed; reconnecting WebSocket under the new id")
            socketIdentityId.current = ""
            const active = currentSocket ?? socket
            if (active && (active.readyState === WebSocket.OPEN || active.readyState === WebSocket.CONNECTING)) {
                active.close() // close handler schedules the reconnect
            }
        })

        // iOS kills the socket while backgrounded; on foreground, don't make the user
        // wait out the exponential backoff — reset it and reconnect immediately.
        const appStateSub = AppState.addEventListener("change", state => {
            if (state !== "active" || cancelled) return
            const active = currentSocket ?? socket
            if (active && (active.readyState === WebSocket.OPEN || active.readyState === WebSocket.CONNECTING)) return
            if (retryTimeout.current) {
                clearTimeout(retryTimeout.current)
                retryTimeout.current = null
            }
            retryCount.current = 0
            connectWebSocket()
        })

        return () => {
            cancelled = true
            unsubIdentity()
            appStateSub.remove()
            if (retryTimeout.current) {
                clearTimeout(retryTimeout.current)
            }
            if (currentSocket) {
                currentSocket.close()
            } else if (socket) {
                socket.close()
            }
            // The closing socket's close-listener no-ops (cancelled), so flip the connected
            // state here — otherwise websocketConnectedAtom keeps reporting "connected" while
            // the plane is dead, and the debrid reconnect-resume never re-arms.
            setIsConnected(false)
        }
    }, [manualOffline, serverAuthToken, sessionToken, serverUrl, serverUrlProtocol, setConnectionState, setIsConnected, setSocket])

    return (
        <>
            <WebsocketContext.Provider value={socket}>
                {children}
            </WebsocketContext.Provider>
        </>
    )
}
