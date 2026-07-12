import type { ExtensionRepo_OnlinestreamProviderExtensionItem, Onlinestream_Episode, Onlinestream_VideoSource } from "@/api/generated/types"
import { getPlayerPreferences, playerErrorAtom } from "@/lib/player"
import { nativePlaybackErrorAtom, nativePlaybackReachedAtom } from "@/lib/player/onlinestream-playback-signal"
import { logger } from "@/lib/utils/logger"
import { toast } from "@/lib/utils/toast"
import { useAtomValue, useSetAtom } from "jotai"
import * as React from "react"

const log = logger("ONLINESTREAM-CYCLER")

// Mirror seanime-web's use-onlinestream-auto-provider-cycler timeouts.
const PROVIDER_TIMEOUT_MS = 15_000
const PLAYBACK_TIMEOUT_MS = 20_000

type TrialState = {
    providers: string[]
    providerIndex: number
    serverIndex: number
}

/**
 * Native/mobile port of seanime-web's `useOnlinestreamAutoProviderCycler`.
 *
 * The web version wires directly to the inline `<video>` element on the same page;
 * on Tenji the selection UI lives on the anime-entry screen while playback runs on
 * the pushed player route, so the cycler drives the existing controller selection
 * state (provider/server/quality + play request) and observes the native player via
 * the shared `nativePlayback*` atoms (>=1s played = success; native error = failure).
 *
 * Failure classes handled, cycling servers-then-providers (same as web):
 *  - episode-list error / empty / episode-not-found / list load timeout   -> next provider
 *  - episode-source error / no servers / source load timeout              -> next provider
 *  - playback error / playback (>=20s w/o >=1s played) timeout            -> next server, then next provider
 * Stops on the first attempt that reaches >= 1s of real playback.
 */
export type UseOnlinestreamAutoCyclerProps = {
    mediaId: number | undefined
    provider: string
    setProvider: (provider: string) => void
    dubbed: boolean
    providerExtensions: ExtensionRepo_OnlinestreamProviderExtensionItem[]

    episodes: Onlinestream_Episode[]
    isLoadingEpisodes: boolean
    episodeListIsError: boolean
    episodeListIsFetched: boolean

    availableServers: string[]
    selectedServer: string | null
    setSelectedServer: (server: string | null) => void
    setSelectedQuality: (quality: string | null) => void
    selectedVideoSource: Onlinestream_VideoSource | null
    isLoadingSource: boolean
    episodeSourceIsError: boolean
    episodeSourceIsFetched: boolean

    requestPlay: (episodeNumber: number) => void
    cancelPlayRequest: () => void
    playRequestedEpisode: number | null

    /** Episode the current playback attempt targets (last one the user launched). */
    currentEpisodeNumber: number | null
    /** Whether the full-screen player route is currently open. */
    playerIsOpen: boolean
    /** Load a resolved source into the player (in-place reload when already open). */
    playVideoSource: (videoSource: Onlinestream_VideoSource, episodeNumber: number) => void
}

function orderProviders(providers: ExtensionRepo_OnlinestreamProviderExtensionItem[], current: string | null) {
    const ids = providers.map(p => p.id)
    if (!current || !ids.includes(current)) return ids
    return [current, ...ids.filter(id => id !== current)]
}

export function useOnlinestreamAutoCycler(props: UseOnlinestreamAutoCyclerProps) {
    const {
        mediaId,
        provider,
        setProvider,
        dubbed,
        providerExtensions,
        episodes,
        isLoadingEpisodes,
        episodeListIsError,
        episodeListIsFetched,
        availableServers,
        selectedServer,
        setSelectedServer,
        setSelectedQuality,
        selectedVideoSource,
        isLoadingSource,
        episodeSourceIsError,
        episodeSourceIsFetched,
        requestPlay,
        cancelPlayRequest,
        playRequestedEpisode,
        currentEpisodeNumber,
        playerIsOpen,
        playVideoSource,
    } = props

    const [trial, setTrial] = React.useState<TrialState | null>(null)
    const trialRef = React.useRef<TrialState | null>(null)
    const firedKeyRef = React.useRef<string | null>(null)
    const attemptStartRef = React.useRef(0)
    // Set once every provider/server has been tried and failed; blocks auto-restart
    // until the user changes episode or manually retries.
    const exhaustedRef = React.useRef(false)

    const playbackError = useAtomValue(nativePlaybackErrorAtom)
    const playbackReached = useAtomValue(nativePlaybackReachedAtom)
    const setPlaybackError = useSetAtom(nativePlaybackErrorAtom)
    const setPlaybackReached = useSetAtom(nativePlaybackReachedAtom)
    const setPlayerError = useSetAtom(playerErrorAtom)

    const availableProviders = React.useMemo(() => {
        return providerExtensions
            .filter(p => !dubbed || p.supportsDub)
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [providerExtensions, dubbed])

    // -------------------------------------------------------------------------
    // Derived failure detection (declared before the effects that consume it).
    // -------------------------------------------------------------------------
    const hasResolutionFailure = episodeListIsError
        || (episodeListIsFetched && episodes.length === 0)
        || episodeSourceIsError
        || (episodeSourceIsFetched && !isLoadingSource && availableServers.length === 0 && playRequestedEpisode !== null)
    const hasFailure = hasResolutionFailure || !!playbackError
    const canTry = !!mediaId && currentEpisodeNumber !== null && availableProviders.length > 0

    const setTrialState = React.useCallback((next: TrialState | null) => {
        trialRef.current = next
        firedKeyRef.current = null
        setTrial(next)
    }, [])

    const resetPlaybackSignals = React.useCallback(() => {
        setPlaybackError(null)
        setPlaybackReached(false)
    }, [setPlaybackError, setPlaybackReached])

    // End a trial and clear the controller's pending play request so the section's
    // own auto-fire effect (re-enabled once !isTrying) does not re-launch playback.
    const endTrial = React.useCallback(() => {
        setTrialState(null)
        cancelPlayRequest()
    }, [setTrialState, cancelPlayRequest])

    const stopWithFailure = React.useCallback((reason: string) => {
        log.warning("No working source found", reason)
        exhaustedRef.current = true
        endTrial()
        // Surface via the player's existing error screen (if it's open) + a toast.
        setPlayerError("No working sources found")
        toast.error("No working sources found")
    }, [endTrial, setPlayerError])

    const advanceProvider = React.useCallback((reason: string) => {
        const current = trialRef.current
        if (!current) return
        const nextProviderIndex = current.providerIndex + 1
        if (nextProviderIndex >= current.providers.length) {
            stopWithFailure(reason)
            return
        }
        log.info("Trying next provider", reason)
        resetPlaybackSignals()
        setTrialState({ ...current, providerIndex: nextProviderIndex, serverIndex: 0 })
    }, [resetPlaybackSignals, setTrialState, stopWithFailure])

    const onPlaybackFail = React.useCallback((reason: string) => {
        const current = trialRef.current
        if (!current) return
        const nextServerIndex = current.serverIndex + 1
        if (nextServerIndex < availableServers.length) {
            log.info("Trying next server", reason)
            resetPlaybackSignals()
            setTrialState({ ...current, serverIndex: nextServerIndex })
            return
        }
        advanceProvider(reason)
    }, [availableServers.length, advanceProvider, resetPlaybackSignals, setTrialState])

    // -------------------------------------------------------------------------
    // Trigger: start cycling through the remaining combos after a failure.
    // -------------------------------------------------------------------------
    const tryAll = React.useCallback(() => {
        if (!mediaId || currentEpisodeNumber === null) return
        if (!availableProviders.length) {
            toast.warning(dubbed ? "No dubbed providers available" : "No providers available")
            return
        }

        const providers = orderProviders(availableProviders, provider)
        let providerIndex = 0
        let serverIndex = 0

        // If the current provider just produced a playback failure, try its next
        // server first; otherwise jump to the next provider (matches web).
        const isPlaybackFailure = !!playbackError
        if (providers[0] === provider) {
            const currentServerIndex = availableServers.findIndex(s => s === selectedServer)
            if (isPlaybackFailure && currentServerIndex >= 0 && currentServerIndex + 1 < availableServers.length) {
                serverIndex = currentServerIndex + 1
            } else if (providers.length > 1) {
                providerIndex = 1
            }
        }

        log.info("Cycling providers", { providers, providerIndex, serverIndex, dubbed })
        resetPlaybackSignals()
        setTrialState({ providers, providerIndex, serverIndex })
    }, [
        mediaId,
        currentEpisodeNumber,
        availableProviders,
        dubbed,
        provider,
        playbackError,
        availableServers,
        selectedServer,
        resetPlaybackSignals,
        setTrialState,
    ])

    const cancel = React.useCallback(() => {
        if (!trialRef.current) return
        exhaustedRef.current = true
        endTrial()
        toast.info("Stopped trying sources")
    }, [endTrial])

    // Manual retry (from the entry-screen button): clear the exhausted guard and
    // start a fresh cycle from the current selection.
    const retry = React.useCallback(() => {
        exhaustedRef.current = false
        resetPlaybackSignals()
        tryAll()
    }, [resetPlaybackSignals, tryAll])

    // Abort any active trial + reset guards when the user changes episode/media.
    React.useEffect(() => {
        exhaustedRef.current = false
        setTrialState(null)
    }, [mediaId, currentEpisodeNumber, setTrialState])

    // Auto-start cycling on a detected failure (there is no inline video on mobile —
    // the player is a separate route, so a stuck/failed stream self-heals by trying
    // the next server/provider in place). Gated so it never loops after exhaustion.
    React.useEffect(() => {
        if (trial || exhaustedRef.current) return
        if (!canTry || !hasFailure) return
        tryAll()
    }, [trial, canTry, hasFailure, tryAll])

    // Non-trial playback timeout (web E10): the initial, section-fired attempt has no
    // trial-armed timer, so a silent stall (autoplay on, no native error, never reaches
    // 1s) would otherwise never be detected. Promote it to a synthetic failure that the
    // auto-start effect above then acts on. Gated on autoplay so a deliberately paused
    // player is never hijacked.
    React.useEffect(() => {
        if (trial || exhaustedRef.current) return
        if (!playerIsOpen || !canTry) return
        if (playbackReached || playbackError) return
        if (!getPlayerPreferences().autoPlay) return
        const timer = setTimeout(() => {
            if (trialRef.current || exhaustedRef.current) return
            setPlaybackError("playback timeout")
        }, PLAYBACK_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [trial, playerIsOpen, canTry, playbackReached, playbackError, setPlaybackError])

    // -------------------------------------------------------------------------
    // Machine: only runs while a trial is active.
    // -------------------------------------------------------------------------
    const targetProvider = trial ? trial.providers[trial.providerIndex] : null

    // 1) Switch provider to the trial's target.
    React.useEffect(() => {
        if (!trial || !targetProvider) return
        if (provider === targetProvider) return
        setSelectedQuality(null)
        setProvider(targetProvider)
    }, [trial, targetProvider, provider, setProvider, setSelectedQuality])

    // 2) Resolve the episode list for the target provider.
    React.useEffect(() => {
        if (!trial || currentEpisodeNumber === null) return
        if (provider !== targetProvider) return
        if (isLoadingEpisodes) return

        if (episodeListIsError) {
            advanceProvider("episode list error")
            return
        }
        if (episodeListIsFetched && episodes.length === 0) {
            advanceProvider("no episodes")
            return
        }
        if (episodeListIsFetched && !episodes.some(e => e.number === currentEpisodeNumber)) {
            advanceProvider("episode not found")
            return
        }
        if (episodeListIsFetched && playRequestedEpisode !== currentEpisodeNumber) {
            requestPlay(currentEpisodeNumber)
        }
    }, [
        trial,
        targetProvider,
        provider,
        currentEpisodeNumber,
        isLoadingEpisodes,
        episodeListIsError,
        episodeListIsFetched,
        episodes,
        playRequestedEpisode,
        requestPlay,
        advanceProvider,
    ])

    // 3) Resolve the source + pick the trial's target server.
    React.useEffect(() => {
        if (!trial || currentEpisodeNumber === null) return
        if (provider !== targetProvider) return
        if (playRequestedEpisode !== currentEpisodeNumber) return
        if (isLoadingSource || !episodeSourceIsFetched) return

        if (episodeSourceIsError) {
            advanceProvider("episode source error")
            return
        }
        if (availableServers.length === 0) {
            advanceProvider("no video sources")
            return
        }
        const server = availableServers[trial.serverIndex]
        if (!server) {
            advanceProvider("servers exhausted")
            return
        }
        if (selectedServer !== server) {
            setSelectedServer(server)
        }
    }, [
        trial,
        targetProvider,
        provider,
        currentEpisodeNumber,
        playRequestedEpisode,
        isLoadingSource,
        episodeSourceIsFetched,
        episodeSourceIsError,
        availableServers,
        selectedServer,
        setSelectedServer,
        advanceProvider,
    ])

    // 4) Fire playback for the resolved (provider, server) combo.
    React.useEffect(() => {
        if (!trial || currentEpisodeNumber === null) return
        if (provider !== targetProvider) return
        if (playRequestedEpisode !== currentEpisodeNumber) return
        if (isLoadingSource) return

        const server = availableServers[trial.serverIndex]
        if (!server || selectedServer !== server) return
        if (!selectedVideoSource || selectedVideoSource.server !== server) return

        const key = `${trial.providerIndex}-${trial.serverIndex}`
        if (firedKeyRef.current === key) return
        firedKeyRef.current = key

        log.info("Attempting playback", { provider: targetProvider, server })
        resetPlaybackSignals()
        attemptStartRef.current = Date.now()
        playVideoSource(selectedVideoSource, currentEpisodeNumber)
    }, [
        trial,
        targetProvider,
        provider,
        currentEpisodeNumber,
        playRequestedEpisode,
        isLoadingSource,
        availableServers,
        selectedServer,
        selectedVideoSource,
        resetPlaybackSignals,
        playVideoSource,
    ])

    // 5) Playback outcome: success (>=1s) stops; native error advances.
    React.useEffect(() => {
        if (!trial || firedKeyRef.current === null) return
        if (playbackReached) {
            log.success("Found working source")
            exhaustedRef.current = false
            endTrial()
            return
        }
        if (playbackError) {
            onPlaybackFail("playback error")
        }
    }, [trial, playbackReached, playbackError, endTrial, onPlaybackFail])

    // Timeout: episode list / source stuck loading -> next provider.
    React.useEffect(() => {
        if (!trial || provider !== targetProvider) return
        if (!isLoadingEpisodes && !isLoadingSource) return
        const timer = setTimeout(() => advanceProvider("resolution timeout"), PROVIDER_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [trial, targetProvider, provider, isLoadingEpisodes, isLoadingSource, advanceProvider])

    // Timeout: playback never reached >=1s -> next server/provider.
    React.useEffect(() => {
        if (!trial || firedKeyRef.current === null) return
        if (playbackReached || playbackError) return
        const timer = setTimeout(() => {
            if (!trialRef.current) return
            if (Date.now() - attemptStartRef.current >= PLAYBACK_TIMEOUT_MS) {
                onPlaybackFail("playback timeout")
            }
        }, PLAYBACK_TIMEOUT_MS)
        return () => clearTimeout(timer)
    }, [trial, playbackReached, playbackError, onPlaybackFail])

    return {
        isTrying: !!trial,
        showButton: canTry && (!!trial || hasFailure),
        tryAll: retry,
        cancel,
    }
}
