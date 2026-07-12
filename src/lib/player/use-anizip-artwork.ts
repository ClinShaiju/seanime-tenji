import { AniZipArtwork, useAnizipArtwork } from "@/api/hooks/anizip.hooks"
import { Image } from "expo-image"
import React from "react"

export type ResolvedAnizipArtwork = {
    artwork?: AniZipArtwork
    /** ani.zip fanart backdrop URL, if any. */
    fanart?: string
    /** ani.zip clearlogo URL, if any. */
    logo?: string
    /** ani.zip English/romaji title, if any. */
    title?: string
}

/**
 * Fetches ani.zip artwork for a media id and prefetches the backdrop + logo image files into
 * expo-image's disk cache, so the in-player loading screen can reveal them instantly instead of
 * loading over the network at stream start.
 *
 * Call once on the anime entry page mount (mirrors web's `anime-entry-page.tsx` placement). The
 * loading screen itself re-reads the (now cached) query, so the resolved URIs are also returned
 * here for callers that want them directly.
 */
export function useAnizipArtworkPrefetch(mediaId: number | null | undefined): ResolvedAnizipArtwork {
    const { data: artwork } = useAnizipArtwork(mediaId)

    React.useEffect(() => {
        if (!artwork) return
        const urls = [artwork.fanart, artwork.logo].filter((u): u is string => !!u)
        if (urls.length > 0) {
            void Image.prefetch(urls, "disk")
        }
    }, [artwork])

    return {
        artwork: artwork ?? undefined,
        fanart: artwork?.fanart,
        logo: artwork?.logo,
        title: artwork?.title,
    }
}
