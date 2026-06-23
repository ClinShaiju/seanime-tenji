import { getClientIdentity } from "@/api/client/client-identity"
import type { Nakama_WatchRoom } from "@/api/generated/types"
import { websocketAtom } from "@/atoms/websocket.atoms"
import { atom, useAtomValue, useSetAtom } from "jotai"
import React from "react"

// Same-instance watch rooms (pool + multi-room model). Mirrors seanime-web's
// nakama-manager + nakama-room-sync, against Tenji's raw WebSocket (no per-component
// pub/sub layer exists, so this is the minimal bridge).

export const NAKAMA_ROOM_EVENTS = {
    ROOMS_UPDATED: "nakama-rooms-updated", // server->client: discovery list changed
    WATCH_ROOM_STATE: "nakama-watch-room-state", // server->client: a room's full state to its members
    ROOM_PLAYBACK_STATUS: "nakama-room-playback-status", // client->server: report a control action
    ROOM_PLAYBACK_SYNC: "nakama-room-playback-sync", // server->client: apply a controller's action
} as const

// The room this client is currently in (null = not in a room). Lifted to a global atom
// so the player layer can read it while the rooms sheet is closed.
export const currentWatchRoomAtom = atom<Nakama_WatchRoom | null>(null)

export function getClientId(): string {
    return getClientIdentity().clientId
}

// useRoomWsListener fires `onMessage` for every WS message of `type`. The callback is
// kept in a ref so it always sees fresh state without re-subscribing.
export function useRoomWsListener<T = unknown>(type: string, onMessage: (payload: T | null) => void) {
    const socket = useAtomValue(websocketAtom)
    const cb = React.useRef(onMessage)
    cb.current = onMessage
    React.useEffect(() => {
        if (!socket) return
        const handler = (event: WebSocketMessageEvent) => {
            if (typeof event.data !== "string") return
            try {
                const msg = JSON.parse(event.data) as { type?: string; payload?: unknown }
                if (msg?.type === type) cb.current((msg.payload ?? null) as T)
            } catch {
                // ignore non-JSON frames
            }
        }
        socket.addEventListener("message", handler)
        return () => socket.removeEventListener("message", handler)
    }, [socket, type])
}

// useRoomWsSender returns a send(type, payload) that writes a {type, payload} frame — the
// same shape the server's UnmarshalWebsocketClientEvent expects (it tags ClientID itself).
export function useRoomWsSender() {
    const socket = useAtomValue(websocketAtom)
    return React.useCallback((type: string, payload: unknown) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type, payload }))
        }
    }, [socket])
}

// useWatchRoomLiveState keeps currentWatchRoomAtom fresh from server room-state pushes.
// Mount once, app-wide (so the atom stays current while the player is open and the sheet
// is closed). Only accepts state for a room this client is actually a participant of, so a
// stray push after leaving can't repopulate the atom.
export function useWatchRoomLiveState() {
    const setRoom = useSetAtom(currentWatchRoomAtom)
    const clientId = getClientId()
    useRoomWsListener<Nakama_WatchRoom>(NAKAMA_ROOM_EVENTS.WATCH_ROOM_STATE, room => {
        if (!room) return
        const amMember = room.participants
            ? Object.values(room.participants).some(p => p.clientId === clientId)
            : false
        if (amMember) setRoom(room)
    })
}
