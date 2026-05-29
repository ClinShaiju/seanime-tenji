import { Anime_Episode } from "@/api/generated/types"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { animeEntryPlaybackIntentAtom, createAnimeEntryPlaybackIntent } from "@/atoms/anime-entry.atoms"
import { useServerStatus } from "@/atoms/server.atoms"
import { EpisodeCardList } from "@/components/features/anime/episode-card-list"
import { ContinueWatchingItem } from "@/hooks/use-anime-library-collection"
import { getContinueWatchingSpoilerActive } from "@/lib/anime-spoilers"
import { router } from "expo-router"
import { useSetAtom } from "jotai"
import * as React from "react"
import Animated from "react-native-reanimated"

type ContinueWatchingProps = {
    items: ContinueWatchingItem[]
    isLoading?: boolean
}

export function ContinueWatching(props: ContinueWatchingProps) {
    const {
        items,
        isLoading = false,
    } = props
    const { data: watchHistory } = useGetContinuityWatchHistory()
    const serverStatus = useServerStatus()
    const setPlaybackIntent = useSetAtom(animeEntryPlaybackIntentAtom)

    const episodes = React.useMemo(() => items.map(item => item.episode), [items])
    const continueWatchingSpoilerActive = getContinueWatchingSpoilerActive(serverStatus)

    const handleEpisodePress = React.useCallback((episode: Anime_Episode) => {
        const item = items.find(entry => (
            entry.episode.baseAnime?.id === episode.baseAnime?.id &&
            entry.episode.episodeNumber === episode.episodeNumber
        ))

        const mediaId = episode.baseAnime?.id
        if (!item || !mediaId) return

        if (item.sourceView === "library" && episode.localFile?.path) {
            setPlaybackIntent(createAnimeEntryPlaybackIntent({
                kind: "play-local-episode",
                mediaId,
                episodeNumber: episode.episodeNumber,
            }))
        }

        router.push({
            pathname: "/(app)/entry/anime/[id]",
            params: {
                id: String(mediaId),
                initialView: item.sourceView,
            },
        })
    }, [items, setPlaybackIntent])


    if (isLoading || !episodes?.length) return null

    return (
        <Animated.View
            className="space-y-4"
        >
            <EpisodeCardList
                title="Continue watching"
                episodes={episodes}
                onEpisodePress={handleEpisodePress}
                watchHistory={watchHistory}
                spoilerActive={continueWatchingSpoilerActive}
                showAnimeTitle
            />
        </Animated.View>
    )
}
