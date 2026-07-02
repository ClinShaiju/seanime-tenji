import { getClientIdentity } from "@/api/client/client-identity"
import { useDebridStartStream } from "@/api/hooks/debrid.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import React from "react"

/**
 * useDebridPrewarm resolves & caches a debrid stream URL ahead of an explicit play, so playback
 * starts instantly. It reuses the auto-select preload path (`preload: true`); the server caches the
 * resolved URL and the real start consumes it.
 *
 * Guards (so it never wastes debrid quota):
 *  - debrid enabled + `preloadNextStream` setting on
 *  - de-dupes the same target within a mount (backend also de-dupes in-flight/cached keys)
 *
 * It never influences which torrent is selected — auto-select ranking is unchanged. No debounce:
 * mobile has no hover firehose, callers fire one-shot (entry mount / in-playback next episode).
 */
export function useDebridPrewarm() {
    const serverStatus = useServerStatus()
    const { mutate: startDebridStream } = useDebridStartStream()

    const enabled = !!serverStatus?.debridSettings?.enabled
        && !!serverStatus?.debridSettings?.preloadNextStream

    const firedRef = React.useRef<Set<string>>(new Set())

    const prewarm = React.useCallback((
        params: { mediaId?: number, episodeNumber?: number, aniDBEpisode?: string | null, prewarmMetadata?: boolean },
    ) => {
        if (!enabled) return
        const { mediaId, episodeNumber, aniDBEpisode, prewarmMetadata } = params
        if (!mediaId || !episodeNumber || !aniDBEpisode) return

        const key = `${mediaId}|${episodeNumber}|${aniDBEpisode}`
        if (firedRef.current.has(key)) return
        firedRef.current.add(key)

        startDebridStream({
            mediaId,
            episodeNumber,
            aniDBEpisode,
            autoSelect: true,
            fileId: "",
            playbackType: "externalPlayerLink",
            clientId: getClientIdentity().clientId,
            preload: true,
            // Tier-1 target: also warm the MKV metadata/CDN for an instant first frame
            // (server bounds CDN load via cdnWarmLimiter).
            prewarmMetadata: !!prewarmMetadata,
        })
    }, [enabled, startDebridStream])

    return { prewarm, enabled }
}
