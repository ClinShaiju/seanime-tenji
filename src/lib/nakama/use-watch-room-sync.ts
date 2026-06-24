import type { PlayerState } from "@/lib/player"
import type { MobilePlaybackSource, MobileStreamKind } from "@/lib/player/types"
import { useAtomValue } from "jotai"
import React from "react"
import { currentWatchRoomAtom, getClientId, NAKAMA_ROOM_EVENTS, useRoomDebug, useRoomWsListener, useRoomWsSender } from "./watch-room"

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

const APPLY_ECHO_WINDOW_MS = 2500 // window after applying a remote state in which a matching local event is treated as its echo
const APPLY_SEEK_THRESHOLD = 0.75 // apply a remote seek only when off by more than this (avoids jitter)
const LOCAL_SEEK_THRESHOLD = 1.5  // a position jump exceeding wall-time + this = a local seek
const HEARTBEAT_MS = 2000 // how often the active driver re-broadcasts its position
// Smooth-convergence tuning (followers only): instead of hard-seeking on every bit of drift
// (which stutters), nudge MPV's speed a few percent to GLIDE back into sync. |drift|<DEADBAND =
// normal; DEADBAND..HARD = speed 1+clamp(drift*GAIN, ±MAX) (eases in, never jumps); >HARD = snap.
// MAX 0.05 = ±5% ≈ barely-perceptible pitch shift; the server fans fresh positions every 500ms so
// steady-state drift stays small and the nudge is usually <2%.
const SYNC_DEADBAND = 0.15
const HARD_SEEK_DRIFT = 0.6
const NUDGE_GAIN = 0.12
const NUDGE_MAX = 0.05

type RoomPlaybackSync = {
    roomId: string
    paused: boolean
    currentTime: number
    duration: number
    mediaId: number
    episodeNumber: number
    stopped?: boolean
    heartbeat?: boolean
    audioTrack?: number | null
    subtitleTrack?: number | null
}

type SyncPlayer = {
    state: PlayerState
    source: MobilePlaybackSource | null
    play: () => void
    pause: () => void
    seekTo: (sec: number) => void
    setSpeed: (speed: number) => void
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
    emitStop: () => void
}

export function useWatchRoomSync(player: SyncPlayer): WatchRoomGating {
    const room = useAtomValue(currentWatchRoomAtom)
    const send = useRoomWsSender()
    const roomDebug = useRoomDebug()
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

    // The last play/pause/seek state we applied from the controller — used to recognize and
    // drop the echo events the apply itself fires (state-matched, not a blind time window, so
    // a late event from buffering doesn't leak back out and a genuine action passes through).
    const lastAppliedRef = React.useRef<{ paused: boolean, currentTime: number, at: number } | null>(null)
    // After we emit a stop, the player teardown flips paused/position and would emit a stray
    // status that makes followers re-follow (reopen). Suppress emits briefly after a stop.
    const suppressEmitUntilRef = React.useRef(0)

    // ---- Emit local control actions ----
    const emitNow = React.useCallback(() => {
        if (!room || !inRoom || !canControl) return
        if (Date.now() < suppressEmitUntilRef.current) return
        // Drop the echo of a state we were just told to be in; a genuine local action diverges.
        const la = lastAppliedRef.current
        if (la && (Date.now() - la.at) < APPLY_ECHO_WINDOW_MS
            && la.paused === state.paused
            && Math.abs(state.currentTime - la.currentTime) < LOCAL_SEEK_THRESHOLD) {
            return
        }

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

    // Emit a stop when the controller ends the episode (player teardown). Followers tear
    // theirs down too (handled app-wide in useWatchRoomFollow). Mirror of the start emit.
    const emitStop = React.useCallback(() => {
        if (!room || !inRoom || !canControl) return
        // Block the stray play/pause emit the teardown is about to fire — otherwise followers
        // get a non-stop status AFTER the stop and re-follow (reopen the stream).
        suppressEmitUntilRef.current = Date.now() + 2000
        send(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_STATUS, {
            roomId: room.id,
            stopped: true,
            paused: true,
            currentTime: 0,
            duration: 0,
            mediaId: 0,
            episodeNumber: 0,
            aniDbEpisode: "",
            streamType: "",
        })
    }, [room, inRoom, canControl, send])

    // Heartbeat: the active driver re-broadcasts its position every couple seconds so followers
    // reconcile drift and stay in sync during steady playback. A ref keeps the latest state so
    // the interval stays stable (no reset every tick).
    const heartbeatRef = React.useRef<() => void>(() => {})
    heartbeatRef.current = () => {
        if (!room || !inRoom || !(canControl && amController)) return
        if (Date.now() < suppressEmitUntilRef.current) return
        send(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_STATUS, {
            roomId: room.id,
            paused: state.paused,
            currentTime: state.currentTime,
            duration: isFinite(state.duration) ? state.duration : 0,
            mediaId: source?.mediaId ?? 0,
            episodeNumber: source?.episodeNumber ?? 0,
            aniDbEpisode: source?.episode?.aniDBEpisode ?? "",
            streamType: streamTypeFromKind(source?.streamKind),
            heartbeat: true,
        })
    }
    React.useEffect(() => {
        if (!(canControl && amController)) return
        const id = setInterval(() => heartbeatRef.current(), HEARTBEAT_MS)
        return () => clearInterval(id)
    }, [canControl, amController])

    // Only a FOLLOWER nudges MPV speed; the driver plays at normal speed. The driver returns early
    // in apply, so when this client BECOMES the driver (control handoff) clear any leftover nudge.
    React.useEffect(() => {
        if (canControl && amController) player.setSpeed(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canControl, amController])

    // ---- Apply incoming sync ----
    useRoomWsListener<RoomPlaybackSync>(NAKAMA_ROOM_EVENTS.ROOM_PLAYBACK_SYNC, p => {
        if (!p || !inRoom) return
        // A stop is handled app-wide (useWatchRoomFollow tears the player down); ignore it here
        // so we don't seek to 0 / pause an about-to-close player.
        if (p.stopped) return
        // The active driver is the SOURCE of truth (it feeds the server) — it must not
        // reconcile to its own echoed-back state.
        if (canControl && amController) return

        // Record the state we're applying so the play/pause/seek it triggers is recognized as
        // an echo and not re-broadcast (state-matched, robust to late events from buffering).
        lastAppliedRef.current = { paused: p.paused, currentTime: p.currentTime, at: Date.now() }

        // Discrete actions snap precisely; heartbeats converge SMOOTHLY via MPV speed (see tuning
        // constants) so steady playback doesn't stutter from constant re-seeks.
        let action = "none"
        const drift = isFinite(p.currentTime) ? p.currentTime - state.currentTime : 0
        const ad = Math.abs(drift)
        const setSpeedSafe = (s: number) => { if (Math.abs(state.speed - s) > 0.005) player.setSpeed(s) }
        if (!p.heartbeat) {
            if (ad > APPLY_SEEK_THRESHOLD) {
                action = `seek->${p.currentTime.toFixed(1)}`
                player.seekTo(p.currentTime)
            }
            setSpeedSafe(1) // a real action -> normal speed
        } else if (ad > HARD_SEEK_DRIFT) {
            action = `seek->${p.currentTime.toFixed(1)}`
            player.seekTo(p.currentTime)
            setSpeedSafe(1)
        } else if (ad > SYNC_DEADBAND) {
            const off = Math.max(-NUDGE_MAX, Math.min(NUDGE_MAX, drift * NUDGE_GAIN))
            setSpeedSafe(1 + off) // glide toward the controller
        } else {
            setSpeedSafe(1) // converged
        }
        if (p.paused && !state.paused) {
            action += " pause"
            player.pause()
        } else if (!p.paused && state.paused) {
            action += " play"
            player.play()
        }
        // DIAGNOSTIC (temporary): received vs local state + action (visible in VPS log).
        roomDebug(`apply recv{paused:${p.paused},t:${p.currentTime.toFixed(1)},hb:${!!p.heartbeat}} `
            + `local{paused:${state.paused},t:${state.currentTime.toFixed(1)}} action=[${action.trim()}]`)

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

    return { inRoom, amController, isRoomFollower: inRoom && !amController, effectiveAutoSkip, emitStop }
}
