import type { DebridStartStream_Variables } from "@/api/generated/endpoint.types"
import { websocketConnectedAtom } from "@/api/components/websocket-provider"
import { useDebridStartStream } from "@/api/hooks/debrid.hooks"
import { activeStreamSessionAtom } from "@/lib/player"
import { logger } from "@/lib/utils/logger"
import { atom, useAtomValue } from "jotai"
import React from "react"

const log = logger("debrid-reconnect")

// lastDebridStreamStartAtom holds the vars of the last ACTIVE (non-preload) debrid stream, so
// it can be re-issued if the server restarts mid-playback. Set at the controller's debrid
// start sites; never set for preloads.
export const lastDebridStreamStartAtom = atom<DebridStartStream_Variables | null>(null)

// useDebridReconnectResume re-establishes a debrid stream after the server restarts
// (deploy/crash) mid-playback. When the websocket reconnects after dropping while a debrid
// stream was active, it re-issues the last start once. The server reuses the already-resolved
// selection (deduped/added torrent — no new createtorrent) and the player resumes at the saved
// position via continuity (kept fresh by useContinuitySync's ~15s flush).
//
// The re-issue is idempotent at the source level (the external-player handler in session.ts
// skips the MPV reload when the resolved URL is unchanged), so a transient mobile WS blip
// (app backgrounding / network switch) re-establishes the server session without disturbing
// playback; only an aged/expired URL actually reloads + resumes. Mount once in the player.
export function useDebridReconnectResume() {
    const wsConnected = useAtomValue(websocketConnectedAtom)
    const activeSession = useAtomValue(activeStreamSessionAtom)
    const lastStart = useAtomValue(lastDebridStreamStartAtom)
    const { mutate: startStream } = useDebridStartStream()

    // Armed once the websocket drops while a debrid stream is active; fires the re-issue when it
    // returns. Prevents re-issuing on a normal reconnect (no drop during playback).
    const droppedWhileActiveRef = React.useRef(false)

    React.useEffect(() => {
        const streamActive = activeSession?.streamMode === "debrid"

        if (!streamActive) {
            // No debrid stream playing → never re-issue something the user closed.
            droppedWhileActiveRef.current = false
            return
        }
        if (!wsConnected) {
            // Server/connection went away while a debrid stream was playing — arm the resume.
            droppedWhileActiveRef.current = true
            return
        }
        if (droppedWhileActiveRef.current && lastStart) {
            droppedWhileActiveRef.current = false
            log.info("Connection back mid-stream — re-issuing debrid stream to resume", lastStart.mediaId, lastStart.episodeNumber)
            startStream({ ...lastStart, preload: false })
        }
    }, [wsConnected, activeSession?.streamMode, lastStart, startStream])
}
