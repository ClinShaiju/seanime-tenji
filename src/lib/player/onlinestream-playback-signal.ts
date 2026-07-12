import { atom } from "jotai"

/**
 * Cross-route playback signals for the online-stream auto-cycler.
 *
 * The provider/server selection UI lives on the anime-entry screen while playback
 * happens on the pushed full-screen player route, so the cycler (mounted on the
 * entry screen) can only observe the native player through shared atoms. The
 * player hook (`use-mpv-player`) writes these; the cycler reads them. They are
 * scoped to the currently-loaded source and reset whenever the source changes.
 */

/** Last native playback error message for the active source. null = no error. */
export const nativePlaybackErrorAtom = atom<string | null>(null)

/** True once the active source has produced >= 1s of real playback (success). */
export const nativePlaybackReachedAtom = atom<boolean>(false)
