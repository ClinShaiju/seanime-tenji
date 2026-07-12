import type { Anime_Entry, ExtensionRepo_OnlinestreamProviderExtensionItem, Onlinestream_VideoSource } from "@/api/generated/types"
import { useListOnlinestreamProviderExtensions } from "@/api/hooks/extensions.hooks"
import { useGetOnlineStreamEpisodeList, useGetOnlineStreamEpisodeSource, useOnlineStreamEmptyCache } from "@/api/hooks/onlinestream.hooks"
import { createAtomStorage } from "@/atoms/storage"
import { useAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import * as React from "react"

function normalizeLabel(value: string | null | undefined): string | null {
    return value?.trim().toLowerCase() ?? null
}

function getQualityResolution(value: string | null | undefined): string | null {
    const normalized = normalizeLabel(value)

    return normalized?.match(/\b(\d{3,4}p|auto|default)\b/i)?.[1]?.toLowerCase() ?? null
}

function dedupeVideoSources(sources: Onlinestream_VideoSource[]): Onlinestream_VideoSource[] {
    const seen = new Set<string>()
    const deduped: Onlinestream_VideoSource[] = []

    for (const source of sources) {
        const key = `${source.url}|${source.quality}|${source.server}`
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(source)
    }

    return deduped
}

////////////////////////// Persisted atoms

const selectedProviderAtom = atomWithStorage<string | null>(
    "sea-onlinestream-provider",
    null,
    createAtomStorage<string | null>(),
)

const selectedServerAtom = atomWithStorage<string | null>(
    "sea-onlinestream-server",
    null,
    createAtomStorage<string | null>(),
)

export const selectedQualityAtom = atomWithStorage<string | null>(
    "sea-onlinestream-quality",
    null,
    createAtomStorage<string | null>(),
)

// Per-media dub/sub preference (mirrors seanime-web's __onlinestream_dubbedPreferenceByMediaAtom)
// — unlike provider/server/quality, dub is a per-title choice, so it's keyed by mediaId instead
// of a single global value.
const dubbedPreferenceByMediaAtom = atomWithStorage<Record<string, boolean>>(
    "sea-onlinestream-dubbed-preference-by-media",
    {},
    createAtomStorage<Record<string, boolean>>(),
)

export type OnlinestreamControllerState = {
    provider: string
    dubbed: boolean
    selectedServer: string | null
}

type UseOnlinestreamControllerParams = {
    entry: Anime_Entry
}

export function useOnlinestreamController({ entry }: UseOnlinestreamControllerParams) {
    const mediaId = entry.media?.id
    const progress = entry.listData?.progress ?? 0

    // provider extensions
    const { data: providerExtensions, isLoading: isLoadingProviders } = useListOnlinestreamProviderExtensions()

    // persisted selection state
    const [provider, setProvider] = useAtom(selectedProviderAtom)
    const [dubbedPreferenceByMedia, setDubbedPreferenceByMedia] = useAtom(dubbedPreferenceByMediaAtom)
    const dubbedPreferenceKey = mediaId ? String(mediaId) : null
    const dubbed = dubbedPreferenceKey ? dubbedPreferenceByMedia[dubbedPreferenceKey] ?? false : false
    const setDubbed = React.useCallback((value: boolean) => {
        if (!dubbedPreferenceKey) return
        setDubbedPreferenceByMedia(prev => {
            if ((prev[dubbedPreferenceKey] ?? false) === value) return prev
            return { ...prev, [dubbedPreferenceKey]: value }
        })
    }, [dubbedPreferenceKey, setDubbedPreferenceByMedia])
    const [selectedServer, setSelectedServer] = useAtom(selectedServerAtom)

    const [playRequestedEpisode, setPlayRequestedEpisode] = React.useState<number | null>(null)

    const sortedProviderExtensions = React.useMemo(() => {
        return [...(providerExtensions ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    }, [providerExtensions])

    // auto-select provider: use stored preference if valid, otherwise first available
    React.useEffect(() => {
        if (!providerExtensions || providerExtensions.length === 0) return
        if (provider && providerExtensions.some(p => p.id === provider)) return
        setProvider(providerExtensions[0].id)
    }, [provider, providerExtensions, setProvider])

    // episode list, always fetched so the episodes are visible
    const {
        data: episodeListResponse,
        isLoading: isLoadingEpisodes,
        isFetching: isFetchingEpisodes,
    } = useGetOnlineStreamEpisodeList(mediaId, provider ?? "", dubbed)

    const episodes = React.useMemo(
        () => episodeListResponse?.episodes ?? [],
        [episodeListResponse?.episodes],
    )

    // episode source, ONLY fetched when user explicitly requests playback
    const {
        data: episodeSource,
        isLoading: isLoadingSource,
        isFetching: isFetchingSource,
    } = useGetOnlineStreamEpisodeSource(
        mediaId,
        provider ?? "",
        playRequestedEpisode ?? 0,
        dubbed,
        playRequestedEpisode !== null && !!provider, // only enabled when a play was requested
    )

    const allVideoSources = React.useMemo(
        () => episodeSource?.videoSources ?? [],
        [episodeSource?.videoSources],
    )

    // persisted quality preference
    const [selectedQuality, setSelectedQuality] = useAtom(selectedQualityAtom)

    // available servers derived from sources
    const availableServers = React.useMemo(() => {
        const servers = new Set<string>()
        for (const s of allVideoSources) {
            if (s.server) servers.add(s.server)
        }
        return Array.from(servers)
    }, [allVideoSources])

    // auto-select server when sources arrive
    React.useEffect(() => {
        if (availableServers.length === 0) {
            setSelectedServer(null)
            return
        }
        if (selectedServer && availableServers.includes(selectedServer)) return
        setSelectedServer(availableServers[0])
    }, [availableServers, selectedServer, setSelectedServer])

    // available qualities derived from server-filtered sources
    const serverFilteredSources = React.useMemo(() => {
        if (!selectedServer) return dedupeVideoSources(allVideoSources)
        return dedupeVideoSources(allVideoSources.filter(v => v.server === selectedServer))
    }, [allVideoSources, selectedServer])

    const availableQualities = React.useMemo(() => {
        const quals = new Set<string>()
        for (const s of serverFilteredSources) {
            if (s.quality) quals.add(s.quality)
        }
        return Array.from(quals)
    }, [serverFilteredSources])

    // selected video source, filtered by server then quality
    const selectedVideoSource = React.useMemo<Onlinestream_VideoSource | null>(() => {
        let filtered = [...serverFilteredSources]
        if (filtered.length === 0) return null

        const normalizedQuality = normalizeLabel(selectedQuality)
        const preferredResolution = getQualityResolution(selectedQuality)
        const hasExactQuality = normalizedQuality && filtered.some(s => normalizeLabel(s.quality) === normalizedQuality)
        const hasPreferredResolution = preferredResolution && filtered.some(s => getQualityResolution(s.quality) === preferredResolution)
        const hasAuto = filtered.some(s => s.quality === "auto")

        if (normalizedQuality && hasExactQuality) {
            filtered = filtered.filter(s => normalizeLabel(s.quality) === normalizedQuality)
        } else if (preferredResolution && hasPreferredResolution) {
            filtered = filtered.filter(s => getQualityResolution(s.quality) === preferredResolution)
        } else if (hasAuto) {
            filtered = filtered.filter(s => s.quality.toLowerCase() === "auto" || s.quality.toLowerCase().includes("default"))
        } else {
            if (filtered.some(s => s.quality.includes("1080p"))) {
                filtered = filtered.filter(s => s.quality.includes("1080p"))
            } else if (filtered.some(s => s.quality.includes("720p"))) {
                filtered = filtered.filter(s => s.quality.includes("720p"))
            } else if (filtered.some(s => s.quality.includes("480p"))) {
                filtered = filtered.filter(s => s.quality.includes("480p"))
            } else if (filtered.some(s => s.quality.includes("360p"))) {
                filtered = filtered.filter(s => s.quality.includes("360p"))
            }

            if (filtered.some(s => s.quality.includes("default"))) {
                filtered = filtered.filter(s => s.quality.includes("default"))
            }
        }

        return filtered[0] ?? serverFilteredSources[0] ?? null
    }, [serverFilteredSources, selectedQuality])

    // current provider extension
    const currentProvider = React.useMemo<ExtensionRepo_OnlinestreamProviderExtensionItem | null>(
        () => providerExtensions?.find(p => p.id === provider) ?? null,
        [providerExtensions, provider],
    )

    // cache clearing
    const { mutate: emptyCache, isPending: isEmptyingCache } = useOnlineStreamEmptyCache()
    const handleEmptyCache = React.useCallback(() => {
        if (!mediaId) return
        emptyCache({ mediaId })
    }, [mediaId, emptyCache])

    // reset state when provider or dubbed changes
    const handleProviderChange = React.useCallback((newProvider: string) => {
        setProvider(newProvider)
        setPlayRequestedEpisode(null)
        setSelectedServer(null)
    }, [setProvider, setSelectedServer])

    const handleDubbedChange = React.useCallback((newDubbed: boolean) => {
        setDubbed(newDubbed)
        setPlayRequestedEpisode(null)
        setSelectedServer(null)
    }, [setSelectedServer])

    // user taps an episode, start fetching sources for it
    const requestPlay = React.useCallback((episodeNumber: number) => {
        setPlayRequestedEpisode(episodeNumber)
    }, [])

    // cancel the current play request (e.g. user taps same episode again)
    const cancelPlayRequest = React.useCallback(() => {
        setPlayRequestedEpisode(null)
    }, [])

    return {
        mediaId,
        progress,
        provider: provider ?? "",
        setProvider: handleProviderChange,
        dubbed,
        setDubbed: handleDubbedChange,
        selectedServer,
        setSelectedServer,
        selectedQuality,
        setSelectedQuality,
        availableQualities,
        episodes,
        episodeListResponse,
        videoSources: serverFilteredSources,
        availableServers,
        selectedVideoSource,
        currentProvider,
        providerExtensions: sortedProviderExtensions,
        isLoadingProviders,
        isLoadingEpisodes: isLoadingEpisodes || isFetchingEpisodes,
        isLoadingSource: isLoadingSource || isFetchingSource,
        handleEmptyCache,
        isEmptyingCache,
        // play flow
        playRequestedEpisode,
        requestPlay,
        cancelPlayRequest,
    }
}
