import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { useGetMergedSeason } from "@/api/hooks/anime_franchise.hooks"
import { AnimeEntryPlaybackIntentKind, animeEntryPlaybackIntentAtom, createAnimeEntryPlaybackIntent } from "@/atoms/anime-entry.atoms"
import { useServerStatus } from "@/atoms/server.atoms"
import { AnimeEpisodeSection } from "@/components/features/media/anime-entry-library-view"
import { CenteredSpinner } from "@/components/shared/centered-spinner"
import { router } from "expo-router"
import { atom } from "jotai"
import { useSetAtom } from "jotai/react"
import React from "react"
import { Text, View } from "react-native"

// Selected merged season on the entry screen (null = normal single-entry view).
// Carries the TMDB id to distinguish real cours from same-season mislabeled siblings.
export type MergedSeasonSelection = { season: number, tmdb: string }
export const __entry_mergedSeasonAtom = atom<MergedSeasonSelection | null>(null)

// MergedSeasonSection renders a split-cour season as one continuous episode list.
// Each merged episode keeps its source cour (baseAnime.id + cour-relative number) for
// per-cour AniList tracking + torrent matching; we remap the *display* numbers to a
// continuous 1..N so the standard episode grid marks watched correctly (cours are
// watched in order, so the summed totalProgress lines up with continuous numbering).
export function MergedSeasonSection({ entry, rootId, seasonNumber, tmdb }: {
    entry: Anime_Entry
    rootId: number
    seasonNumber: number
    tmdb: string
}) {
    const serverStatus = useServerStatus()
    const setPlaybackIntent = useSetAtom(animeEntryPlaybackIntentAtom)
    const { data, isLoading } = useGetMergedSeason(rootId, seasonNumber, tmdb)

    const { displayEpisodes, courInfo, totalProgress, totalEpisodes, courCount } = React.useMemo(() => {
        const eps = data?.episodes ?? []
        const display = eps.map((ep, i) => ({
            ...ep,
            episodeNumber: i + 1,
            progressNumber: i + 1,
            displayTitle: `Episode ${i + 1}`,
        })) as Anime_Episode[]
        const info = eps.map(ep => ({ courMediaId: ep.baseAnime?.id ?? rootId, courEpisodeNumber: ep.episodeNumber }))
        return {
            displayEpisodes: display,
            courInfo: info,
            totalProgress: data?.totalProgress ?? 0,
            totalEpisodes: data?.totalEpisodes ?? eps.length,
            courCount: data?.cours?.length ?? 0,
        }
    }, [data, rootId])

    // Play a merged episode, routed to its source cour. Debrid users auto-select; the
    // target cour's stream section consumes the intent and plays. When the episode
    // belongs to the current entry there's no navigation — the intent plays in place.
    const playEpisode = React.useCallback((displayEp: Anime_Episode) => {
        const info = courInfo[displayEp.episodeNumber - 1]
        if (!info?.courMediaId) return

        const debrid = !!serverStatus?.debridSettings?.enabled && !!serverStatus?.debridSettings?.provider
        const torrent = !!serverStatus?.torrentstreamSettings?.enabled
        const kind: AnimeEntryPlaybackIntentKind = debrid
            ? "debridstream-auto-select"
            : torrent ? "torrentstream-auto-select" : "play-local-episode"

        setPlaybackIntent(createAnimeEntryPlaybackIntent({
            mediaId: info.courMediaId,
            episodeNumber: info.courEpisodeNumber,
            kind,
        }))

        if (info.courMediaId !== entry.mediaId) {
            const initialView = kind === "play-local-episode" ? "library" : "torrentstream"
            router.push({ pathname: "/(app)/entry/anime/[id]", params: { id: String(info.courMediaId), initialView } })
        }
    }, [courInfo, entry.mediaId, serverStatus, setPlaybackIntent])

    if (isLoading) return <View className="py-16"><CenteredSpinner /></View>
    if (!displayEpisodes.length) {
        return <Text className="text-center text-muted-foreground py-16">No episodes found for this season.</Text>
    }

    return (
        <View className="px-4 gap-3">
            <View className="flex-row items-center gap-2">
                <Text className="text-muted-foreground text-sm">{totalProgress} / {totalEpisodes}</Text>
                {courCount > 1 && <Text className="text-muted-foreground text-xs">({courCount} cours merged)</Text>}
            </View>
            <AnimeEpisodeSection
                title={`Season ${seasonNumber}`}
                episodes={displayEpisodes}
                progress={totalProgress}
                entry={entry}
                mediaId={entry.mediaId}
                onEpisodePress={playEpisode}
                initialActiveEpisodeNumber={Math.min(totalProgress + 1, totalEpisodes)}
            />
        </View>
    )
}
