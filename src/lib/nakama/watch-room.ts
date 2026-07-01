import { getClientIdentity } from "@/api/client/client-identity"
import type { Nakama_RoomPlaybackStatusPayload, Nakama_WatchRoom } from "@/api/generated/types"
import { useNakamaJoinWatchRoom, useNakamaJoinWatchRoomStream } from "@/api/hooks/nakama.hooks"
import { animeEntryPlaybackIntentAtom, createAnimeEntryPlaybackIntent } from "@/atoms/anime-entry.atoms"
import { websocketAtom } from "@/atoms/websocket.atoms"
import { currentPlaybackSourceAtom } from "@/lib/player"
import { toast } from "@/lib/utils/toast"
import { useRouter } from "expo-router"
import { atom, useAtomValue, useSetAtom } from "jotai"
import React from "react"
import { recordRtt } from "./ws-latency"

// Same-instance watch rooms (pool + multi-room model). Mirrors seanime-web's
// nakama-manager + nakama-room-sync, against Tenji's raw WebSocket (no per-component
// pub/sub layer exists, so this is the minimal bridge).

export const NAKAMA_ROOM_EVENTS = {
    ROOMS_UPDATED: "nakama-rooms-updated", // server->client: discovery list changed
    WATCH_ROOM_STATE: "nakama-watch-room-state", // server->client: a room's full state to its members
    WATCH_ROOM_CLOSED: "nakama-watch-room-closed", // server->client: host closed the room; members stop
    ROOM_PLAYBACK_STATUS: "nakama-room-playback-status", // client->server: report a control action
    ROOM_PLAYBACK_SYNC: "nakama-room-playback-sync", // server->client: apply a controller's action
    ROOM_DEBUG: "nakama-room-debug", // client->server: diagnostic line, logged server-side (no console on iOS)
} as const

// useRoomDebug returns a function that sends a diagnostic line to the server (logged there),
// so iOS behaviour — which has no devtools — is visible in the VPS log. Temporary.
export function useRoomDebug() {
    const send = useRoomWsSender()
    return React.useCallback((msg: string) => send(NAKAMA_ROOM_EVENTS.ROOM_DEBUG, msg), [send])
}

// The room this client is currently in (null = not in a room). Lifted to a global atom
// so the player layer can read it while the rooms sheet is closed.
export const currentWatchRoomAtom = atom<Nakama_WatchRoom | null>(null)

// Bumped to ask the player to tear down (the controller stopped the episode, or the host
// closed the room). The player screen watches this and runs its normal back/stop path.
export const watchRoomTerminateSignalAtom = atom(0)

// The roomId whose active stream this client has opted OUT of (closed/late-joined). While set,
// the room's playback sync won't auto-open the player — a "Join room stream" button does.
export const optedOutStreamRoomIdAtom = atom<string | null>(null)

// isRoomDriver: is this client the active driver (can control AND is the controller)? The
// driver feeds the room and never follows / never needs the join button.
export function isRoomDriver(room: Nakama_WatchRoom | null, clientId: string): boolean {
    if (!room?.participants || !room.controllerKey) return false
    const e = Object.entries(room.participants).find(([, p]) => p.clientId === clientId)
    if (!e) return false
    const [key, me] = e
    return (!!me.isHost || !!me.canControl) && key === room.controllerKey
}

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

// useWsLatencyProbe pings the server every few seconds and records the round-trip (the server echoes
// the ping's timestamp in its pong) so the watch-room sync can lead positions by the network lag.
// Tenji has no other ping loop. Mount once app-wide (alongside useWatchRoomLiveState).
export function useWsLatencyProbe() {
    const send = useRoomWsSender()
    useRoomWsListener<{ timestamp?: number }>("pong", p => {
        if (p && typeof p.timestamp === "number") recordRtt(Date.now() - p.timestamp)
    })
    React.useEffect(() => {
        const id = setInterval(() => send("ping", { timestamp: Date.now() }), 5000)
        return () => clearInterval(id)
    }, [send])
}

// useWatchRoomFollow drives the cross-screen room reactions the player sync (which only runs
// while the player is open) can't: FOLLOW the controller into an episode (a peer who isn't
// watching yet has no player to adjust), STOP/CLOSE teardown, and reconnect re-join. Mount
// once app-wide (alongside useWatchRoomLiveState).
export function useWatchRoomFollow() {
    const room = useAtomValue(currentWatchRoomAtom)
    const setRoom = useSetAtom(currentWatchRoomAtom)
    const setPlaybackIntent = useSetAtom(animeEntryPlaybackIntentAtom)
    const bumpTerminate = useSetAtom(watchRoomTerminateSignalAtom)
    const activeSource = useAtomValue(currentPlaybackSourceAtom)
    const socket = useAtomValue(websocketAtom)
    const router = useRouter()
    const clientId = getClientId()
    const { mutate: joinRoom } = useNakamaJoinWatchRoom()
    const { mutate: joinStream } = useNakamaJoinWatchRoomStream()
    const optedOutRoomId = useAtomValue(optedOutStreamRoomIdAtom)
    const roomDebug = useRoomDebug()

    const driverGuard = isRoomDriver(room, clientId)

    // The media+episode we last followed, so a burst of syncs doesn't relaunch it.
    const followedKeyRef = React.useRef("")

    const maybeFollow = React.useCallback((p: Nakama_RoomPlaybackStatusPayload | null) => {
        if (!p) return
        // The active driver never follows its own action.
        if (driverGuard) return
        // Controller ended the episode → stop ours too.
        if (p.stopped) {
            roomDebug(`follow: STOP received (activeSource=${!!activeSource}) -> ${activeSource ? "terminate" : "noop"}`)
            followedKeyRef.current = ""
            if (activeSource) bumpTerminate(c => c + 1)
            return
        }
        if (!p.mediaId || !p.episodeNumber) return
        if (p.streamType !== "debrid" && p.streamType !== "torrent") return
        // Opted out of this room's stream (closed it, or joined while it was already live)?
        // Don't auto-open — the "Join room stream" button does.
        if (optedOutRoomId === p.roomId) return
        // Already playing this exact media+episode? The player sync handles position.
        if (activeSource?.mediaId === p.mediaId && activeSource?.episodeNumber === p.episodeNumber) {
            followedKeyRef.current = ""
            return
        }
        const key = `${p.mediaId}:${p.episodeNumber}:${p.streamType}`
        if (followedKeyRef.current === key) return
        followedKeyRef.current = key
        if (p.streamType === "debrid") {
            // Reuse the host's already-resolved link (no re-selection). The server starts the
            // stream and emits the external-player URL, which session.ts navigates the player to.
            roomDebug(`follow: START debrid join-stream media=${p.mediaId} ep=${p.episodeNumber}`)
            joinStream({ roomId: p.roomId, clientId, playbackType: "externalPlayerLink" })
        } else {
            // Torrent: auto-select via the entry screen (link sharing is debrid-only).
            setPlaybackIntent(createAnimeEntryPlaybackIntent({
                kind: "torrentstream-auto-select", mediaId: p.mediaId, episodeNumber: p.episodeNumber,
            }))
            router.push({ pathname: "/(app)/entry/anime/[id]", params: { id: String(p.mediaId), initialView: "torrentstream" } })
        }
    }, [driverGuard, optedOutRoomId, activeSource, bumpTerminate, router, setPlaybackIntent, joinStream, clientId, roomDebug])

    // Live control actions from the controller.
    useRoomWsListener<Nakama_RoomPlaybackStatusPayload>(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_SYNC, maybeFollow)

    // NOTE: no late-join auto-open. Joining a room with a live stream is button-only (the
    // "Join room stream" button) — only a live start while you're present auto-opens you.

    // Host closed the room → leave + stop playback.
    useRoomWsListener<string>(NAKAMA_ROOM_EVENTS.WATCH_ROOM_CLOSED, roomId => {
        if (room && (!roomId || room.id === roomId)) {
            roomDebug("ROOM CLOSED received -> terminate + leave")
            followedKeyRef.current = ""
            setRoom(null)
            bumpTerminate(c => c + 1)
            toast.info("The host closed the room")
        }
    })

    // Reconnect: the provider makes a NEW WebSocket on every reconnect (the clientId is stable).
    // A brief drop made the server promote control away; re-join the current room on the new
    // socket to reclaim control for the host (and resync after any events lost while down).
    // Empty password is fine — we're already a member, so it isn't re-checked.
    const rejoinedSocketRef = React.useRef<WebSocket | null>(null)
    React.useEffect(() => {
        if (!socket || rejoinedSocketRef.current === socket || !room) return
        rejoinedSocketRef.current = socket
        joinRoom({ roomId: room.id, password: "", clientId }, {
            onSuccess: (updated) => { if (updated) setRoom(updated) },
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket, room?.id])
}

// useRoomStreamJoin powers the "Join room stream" button. canJoin is true when the room has a
// live stream this client isn't already watching (and isn't driving). join() clears the opt-out
// and starts — debrid reuses the host's shared link; torrent auto-selects via the entry screen.
export function useRoomStreamJoin() {
    const room = useAtomValue(currentWatchRoomAtom)
    const activeSource = useAtomValue(currentPlaybackSourceAtom)
    const setOptedOut = useSetAtom(optedOutStreamRoomIdAtom)
    const setPlaybackIntent = useSetAtom(animeEntryPlaybackIntentAtom)
    const { mutate: joinStream, isPending } = useNakamaJoinWatchRoomStream()
    const router = useRouter()
    const clientId = getClientId()

    const mi = room?.currentMediaInfo
    const watchingThis = activeSource?.mediaId === mi?.mediaId && activeSource?.episodeNumber === mi?.episodeNumber
    // No driver exclusion (parity with seanime-web): an actively-driving controller is already
    // watching the room's media, so watchingThis hides the button for them anyway. Excluding the
    // driver wedged a non-host driver who closed their player — they keep controllerKey (nothing
    // hands it back on close), so the Join button never appeared until someone else acted.
    const canJoin = !!room?.playbackActive && !!mi && !watchingThis

    const join = React.useCallback(() => {
        if (!room?.id || !mi) return
        setOptedOut(null)
        if (mi.streamType === "torrent") {
            setPlaybackIntent(createAnimeEntryPlaybackIntent({
                kind: "torrentstream-auto-select", mediaId: mi.mediaId, episodeNumber: mi.episodeNumber,
            }))
            router.push({ pathname: "/(app)/entry/anime/[id]", params: { id: String(mi.mediaId), initialView: "torrentstream" } })
        } else {
            joinStream({ roomId: room.id, clientId, playbackType: "externalPlayerLink" })
        }
    }, [room, mi, clientId, setOptedOut, setPlaybackIntent, router, joinStream])

    return { canJoin, join, isPending }
}
