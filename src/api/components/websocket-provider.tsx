import { addClientQueryParams, saveClientIdentityFromEvent } from "@/api/client/client-identity"
import { getServerBaseUrl } from "@/api/client/server-url"
import { useWebsocketEventRouter } from "@/api/components/websocket-event-router"
import { useServerAuthToken, useServerUrl, useServerUrlProtocol } from "@/atoms/server.atoms"
import { websocketAtom, WebsocketContext } from "@/atoms/websocket.atoms"
import { degradeServerReachability, markServerReachable } from "@/lib/connection-state"
import { manualOfflineModeAtom } from "@/lib/offline/manual-offline-mode"
import { logger } from "@/lib/utils/logger"
import { atom } from "jotai"
import { useAtomValue } from "jotai/react"
import { useAtom } from "jotai/react"
import React from "react"

const CLIENT_IDENTITY_EVENT = "client-identity"

export const websocketConnectedAtom = atom(false)
export const websocketConnectionStateAtom = atom<"idle" | "connecting" | "connected" | "disconnected">("idle")

export function WebsocketProvider({ children }: { children: React.ReactNode }) {
    const serverUrl = useServerUrl()
    const serverAuthToken = useServerAuthToken()
    const serverUrlProtocol = useServerUrlProtocol()
    const manualOffline = useAtomValue(manualOfflineModeAtom)
    const [socket, setSocket] = useAtom(websocketAtom)
    const [isConnected, setIsConnected] = useAtom(websocketConnectedAtom)
    const [, setConnectionState] = useAtom(websocketConnectionStateAtom)

    useWebsocketEventRouter(socket)

    const retryCount = React.useRef(0)
    const retryTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null)

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

            const socketUrl = `${serverUrlProtocol === "https:" ? "wss" : "ws"}://${getServerBaseUrl(serverUrl,
                true)}/events?${searchParams.toString()}`
            const s = new WebSocket(socketUrl)
            currentSocket = s
            logger("websocket-provider").info("Connecting to WebSocket", socketUrl)

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

            s.addEventListener("message", event => {
                if (typeof event.data !== "string") {
                    return
                }

                try {
                    const message = JSON.parse(event.data) as { type?: string; payload?: unknown }
                    if (message.type === CLIENT_IDENTITY_EVENT) {
                        saveClientIdentityFromEvent(message.payload)
                    }
                }
                catch {
                }
            })

            setSocket(s)
            return s
        }

        if (!socket || socket.readyState === WebSocket.CLOSED) {
            connectWebSocket()
        }

        return () => {
            cancelled = true
            if (retryTimeout.current) {
                clearTimeout(retryTimeout.current)
            }
            if (currentSocket) {
                currentSocket.close()
            } else if (socket) {
                socket.close()
            }
        }
    }, [manualOffline, serverAuthToken, serverUrl, serverUrlProtocol, setConnectionState, setIsConnected, setSocket])

    return (
        <>
            <WebsocketContext.Provider value={socket}>
                {children}
            </WebsocketContext.Provider>
        </>
    )
}
