import { getClientIdentity } from "@/api/client/client-identity"
import type { Nakama_RoomPlaybackStatusPayload, Nakama_WatchRoom } from "@/api/generated/types"
import { useNakamaJoinWatchRoom } from "@/api/hooks/nakama.hooks"
import { animeEntryPlaybackIntentAtom, createAnimeEntryPlaybackIntent } from "@/atoms/anime-entry.atoms"
import { websocketAtom } from "@/atoms/websocket.atoms"
import { currentPlaybackSourceAtom } from "@/lib/player"
import { toast } from "@/lib/utils/toast"
import { useRouter } from "expo-router"
import { atom, useAtomValue, useSetAtom } from "jotai"
import React from "react"

// Same-instance watch rooms (pool + multi-room model). Mirrors seanime-web's
// nakama-manager + nakama-room-sync, against Tenji's raw WebSocket (no per-component
// pub/sub layer exists, so this is the minimal bridge).

export const NAKAMA_ROOM_EVENTS = {
    ROOMS_UPDATED: "nakama-rooms-updated", // server->client: discovery list changed
    WATCH_ROOM_STATE: "nakama-watch-room-state", // server->client: a room's full state to its members
    WATCH_ROOM_CLOSED: "nakama-watch-room-closed", // server->client: host closed the room; members stop
    ROOM_PLAYBACK_STATUS: "nakama-room-playback-status", // client->server: report a control action
    ROOM_PLAYBACK_SYNC: "nakama-room-playback-sync", // server->client: apply a controller's action
} as const

// The room this client is currently in (null = not in a room). Lifted to a global atom
// so the player layer can read it while the rooms sheet is closed.
export const currentWatchRoomAtom = atom<Nakama_WatchRoom | null>(null)

// Bumped to ask the player to tear down (the controller stopped the episode, or the host
// closed the room). The player screen watches this and runs its normal back/stop path.
export const watchRoomTerminateSignalAtom = atom(0)

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

    // Am I the effective controller (the one driving)? The controller must NEVER follow its
    // own action — it would re-launch the stream it just started (room.lastPlayback reflects
    // the controller's own start), flashing the screen + hammering the CDN with restarts.
    const amController = React.useMemo(() => {
        if (!room?.participants || !room.controllerKey) return false
        const myEntry = Object.entries(room.participants).find(([, p]) => p.clientId === clientId)
        return !!myEntry && myEntry[0] === room.controllerKey
    }, [room, clientId])

    // The media+episode we last followed, so a burst of syncs doesn't relaunch it.
    const followedKeyRef = React.useRef("")

    const maybeFollow = React.useCallback((p: Nakama_RoomPlaybackStatusPayload | null) => {
        if (!p) return
        // The controller drives — never follow our own action.
        if (amController) return
        // Controller ended the episode → stop ours too.
        if (p.stopped) {
            followedKeyRef.current = ""
            if (activeSource) bumpTerminate(c => c + 1)
            return
        }
        if (!p.mediaId || !p.episodeNumber) return
        // Cross-instance rooms can only share debrid/torrent (not local files / online streams).
        if (p.streamType !== "debrid" && p.streamType !== "torrent") return
        // Already playing this exact media+episode? The player sync handles position.
        if (activeSource?.mediaId === p.mediaId && activeSource?.episodeNumber === p.episodeNumber) {
            followedKeyRef.current = ""
            return
        }
        const key = `${p.mediaId}:${p.episodeNumber}:${p.streamType}`
        if (followedKeyRef.current === key) return
        followedKeyRef.current = key
        // Launch the same source: set the entry's playback intent + navigate to the entry
        // screen, which auto-selects + opens the player (same path as next-episode autoplay).
        setPlaybackIntent(createAnimeEntryPlaybackIntent({
            kind: p.streamType === "debrid" ? "debridstream-auto-select" : "torrentstream-auto-select",
            mediaId: p.mediaId,
            episodeNumber: p.episodeNumber,
        }))
        router.push({
            pathname: "/(app)/entry/anime/[id]",
            params: { id: String(p.mediaId), initialView: "torrentstream" },
        })
    }, [amController, activeSource, bumpTerminate, router, setPlaybackIntent])

    // Live control actions from the controller.
    useRoomWsListener<Nakama_RoomPlaybackStatusPayload>(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_SYNC, maybeFollow)

    // Late join / room-state refresh: follow the room's last action.
    React.useEffect(() => {
        if (room?.lastPlayback) maybeFollow(room.lastPlayback)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [room?.id, room?.lastPlayback?.mediaId, room?.lastPlayback?.episodeNumber, room?.lastPlayback?.stopped])

    // Host closed the room → leave + stop playback.
    useRoomWsListener<string>(NAKAMA_ROOM_EVENTS.WATCH_ROOM_CLOSED, roomId => {
        if (room && (!roomId || room.id === roomId)) {
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
