import type { PlayerState } from "@/lib/player"
import type { MobilePlaybackSource, MobileStreamKind } from "@/lib/player/types"
import { useAtomValue } from "jotai"
import React from "react"
import { currentWatchRoomAtom, getClientId, NAKAMA_ROOM_EVENTS, useRoomWsListener, useRoomWsSender } from "./watch-room"

// Watch-room player sync for the native MPV player.
//
// Each member plays in their own player; the server relays control ACTIONS between members
// (position + play/pause only — never tracks, so everyone keeps their own audio/subtitle).
//   - emit ROOM_PLAYBACK_STATUS on local play/pause/seek (only when allowed to control)
//   - apply ROOM_PLAYBACK_SYNC from the server to the local player
//
// MPV has no discrete "seeked" event, so a seek is detected by diffing onProgress position
// jumps against wall-clock progression. Echo guard: applying a remote action makes the
// player report play/pause/seek, which would re-broadcast and loop — emits are suppressed
// for a short window after applying.

const ECHO_GUARD_MS = 800
const APPLY_SEEK_THRESHOLD = 0.75 // apply a remote seek only when off by more than this (avoids jitter)
const LOCAL_SEEK_THRESHOLD = 1.5  // a position jump exceeding wall-time + this = a local seek

type RoomPlaybackSync = {
    roomId: string
    paused: boolean
    currentTime: number
    duration: number
    mediaId: number
    episodeNumber: number
    audioTrack?: number | null
    subtitleTrack?: number | null
}

type SyncPlayer = {
    state: PlayerState
    source: MobilePlaybackSource | null
    play: () => void
    pause: () => void
    seekTo: (sec: number) => void
    setAudioTrack: (trackId: number) => void
    setSubtitleTrack: (trackId: number) => void
}

function streamTypeFromKind(kind: MobileStreamKind | undefined): string {
    if (kind === "file") return "file"
    if (kind === "hls") return "onlinestream"
    return "debrid" // http — followers resolve their own stream, exact value is informational
}

export type WatchRoomGating = {
    inRoom: boolean
    amController: boolean
    isRoomFollower: boolean
    effectiveAutoSkip: boolean
}

export function useWatchRoomSync(player: SyncPlayer): WatchRoomGating {
    const room = useAtomValue(currentWatchRoomAtom)
    const send = useRoomWsSender()
    const clientId = getClientId()
    const { state, source } = player

    // Resolve "me" in the room. controllerKey is a pool key (e.g. "local:alice"), not a
    // clientId, so match my participant entry by clientId then compare its key.
    const { myKey, me } = React.useMemo(() => {
        const entry = room?.participants
            ? Object.entries(room.participants).find(([, p]) => p.clientId === clientId)
            : undefined
        return { myKey: entry?.[0], me: entry?.[1] }
    }, [room, clientId])

    const inRoom = !!room && !!me
    const canControl = !!me && (!!me.isHost || !!me.canControl)
    const amHost = !!me?.isHost
    const amController = !!room && !!myKey && room.controllerKey === myKey
    const forceHostTracks = !!room?.forceHostTracks
    const effectiveAutoSkip = !!room?.effectiveAutoSkip

    const applyingRemoteUntil = React.useRef(0)

    // ---- Emit local control actions ----
    const emitNow = React.useCallback(() => {
        if (!room || !inRoom || !canControl) return
        if (Date.now() < applyingRemoteUntil.current) return

        const payload: RoomPlaybackSync & { aniDbEpisode: string; streamType: string } = {
            roomId: room.id,
            paused: state.paused,
            currentTime: state.currentTime,
            duration: isFinite(state.duration) ? state.duration : 0,
            mediaId: source?.mediaId ?? 0,
            episodeNumber: source?.episodeNumber ?? 0,
            aniDbEpisode: source?.episode?.aniDBEpisode ?? "",
            streamType: streamTypeFromKind(source?.streamKind),
        }

        // When the host forces tracks, the host (and only the host) carries their current
        // audio/subtitle selection so members can mirror it. -1 subtitle = off.
        if (forceHostTracks && amHost) {
            payload.audioTrack = state.activeAudioTrackId ?? null
            payload.subtitleTrack = state.activeSubtitleTrackId ?? -1
        }

        send(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_STATUS, payload)
    }, [room, inRoom, canControl, state.paused, state.currentTime, state.duration,
        state.activeAudioTrackId, state.activeSubtitleTrackId, source, forceHostTracks, amHost, send])

    // Emit on pause/play toggle.
    const prevPaused = React.useRef(state.paused)
    React.useEffect(() => {
        if (prevPaused.current === state.paused) return
        prevPaused.current = state.paused
        emitNow()
    }, [state.paused, emitNow])

    // Emit on seek: detect a position jump that exceeds wall-clock progression.
    const lastTick = React.useRef({ pos: state.currentTime, wall: Date.now() })
    React.useEffect(() => {
        const now = Date.now()
        const { pos, wall } = lastTick.current
        const expected = pos + (now - wall) / 1000
        lastTick.current = { pos: state.currentTime, wall: now }
        if (Math.abs(state.currentTime - expected) > LOCAL_SEEK_THRESHOLD) {
            emitNow()
        }
    }, [state.currentTime, emitNow])

    // ---- Apply incoming sync ----
    useRoomWsListener<RoomPlaybackSync>(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_SYNC, p => {
        if (!p || !inRoom) return

        // Suppress the play/pause/seek our own changes are about to report.
        applyingRemoteUntil.current = Date.now() + ECHO_GUARD_MS

        if (isFinite(p.currentTime) && Math.abs(state.currentTime - p.currentTime) > APPLY_SEEK_THRESHOLD) {
            player.seekTo(p.currentTime)
        }
        if (p.paused && !state.paused) {
            player.pause()
        } else if (!p.paused && state.paused) {
            player.play()
        }

        // Force-host-tracks: mirror the host's audio/subtitle selection (followers only).
        if (forceHostTracks && !amHost) {
            if (typeof p.audioTrack === "number" && p.audioTrack >= 0) {
                player.setAudioTrack(p.audioTrack)
            }
            if (typeof p.subtitleTrack === "number") {
                player.setSubtitleTrack(p.subtitleTrack) // -1 => disable (the player hook handles it)
            }
        }
    })

    return { inRoom, amController, isRoomFollower: inRoom && !amController, effectiveAutoSkip }
}
