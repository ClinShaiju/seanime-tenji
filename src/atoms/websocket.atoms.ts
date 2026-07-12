import { logger } from "@/lib/utils/logger"
import { atom } from "jotai"
import React from "react"

export const websocketAtom = atom<WebSocket | null>(null)

export const WebsocketContext = React.createContext<WebSocket | null>(null)

// Parse-once message hub. The provider JSON.parses each server frame a single time and
// fans the parsed object out here, instead of every feature (router, player session,
// watch rooms) attaching its own socket listener and re-parsing the same string —
// nakama room sync emits ~1 frame/s while a watch room is live.
export type WsServerMessage = { type: string; payload?: unknown }

const wsMessageHandlers = new Set<(message: WsServerMessage) => void>()

/** Subscribe to parsed server messages. Returns an unsubscribe function. */
export function addWsMessageHandler(handler: (message: WsServerMessage) => void): () => void {
    wsMessageHandlers.add(handler)
    return () => {
        wsMessageHandlers.delete(handler)
    }
}

export function dispatchWsMessage(message: WsServerMessage) {
    // Isolate subscribers: one handler throwing must not drop the frame for the others
    // (iOS has no console, so surface it via the logger instead of swallowing).
    for (const handler of [...wsMessageHandlers]) {
        try {
            handler(message)
        } catch (e) {
            logger("websocket.atoms").error("ws message handler threw", e)
        }
    }
}

/** Fires `onMessage` with the payload of every server frame of `type`. The callback is
 * kept in a ref so it always sees fresh state without re-subscribing. */
export function useWsMessageListener<T = unknown>(type: string, onMessage: (payload: T | null) => void) {
    const cb = React.useRef(onMessage)
    cb.current = onMessage
    React.useEffect(() => addWsMessageHandler(message => {
        if (message.type === type) cb.current((message.payload ?? null) as T)
    }), [type])
}
