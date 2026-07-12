import { useServerQuery } from "@/api/client/requests"

/**
 * Shape of `GET /api/v1/anizip-artwork/{id}` (server: `anizip.Artwork`, all fields `omitempty`).
 * Many entries have no ani.zip artwork, so every field can be absent.
 */
export type AniZipArtwork = {
    fanart?: string
    logo?: string
    title?: string
}

/**
 * Server-cached (7-day filecache) ani.zip artwork for the stream loading screen.
 *
 * The endpoint is hand-authored on the server (mirrors seanime-web) and is deliberately
 * NOT part of the generated API surface — codegen will never surface it — so this is a
 * small hand-rolled typed fetch over the shared authed request client.
 */
export function useAnizipArtwork(mediaId: number | null | undefined) {
    return useServerQuery<AniZipArtwork>({
        endpoint: `/api/v1/anizip-artwork/${mediaId}`,
        method: "GET",
        queryKey: ["anizip-artwork", mediaId],
        enabled: !!mediaId,
        staleTime: Infinity,
        // Purely decorative; a missing/failed fetch must never toast or block playback.
        muteError: true,
    })
}
