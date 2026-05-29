import { Anime_Episode, Continuity_WatchHistory } from "@/api/generated/types"
import { getEpisodePercentageComplete } from "@/api/hooks/continuity.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { EpisodeCard } from "@/components/features/anime/episode-card"
import { getEpisodeSpoilerState } from "@/lib/anime-spoilers"
import React from "react"
import { ActivityIndicator, Dimensions, FlatList, ListRenderItemInfo, Text, View } from "react-native"

const { width } = Dimensions.get("screen")
const CARD_WIDTH = (3.5 / 5) * width
const SPACING = 20
const CARD_ROW_HEIGHT = Math.ceil(CARD_WIDTH * (9 / 16) + 60)
const ITEM_FULL_WIDTH = CARD_WIDTH + SPACING
const CONTENT_CONTAINER_STYLE = { paddingHorizontal: SPACING }
const ITEM_SEPARATOR_STYLE = { width: SPACING }
const INITIAL_EPISODE_CARD_RENDER = 3

type EpisodeCardListProps = {
    title?: string
    episodes: Anime_Episode[]
    onEpisodePress?: (episode: Anime_Episode) => void
    mediaId?: number
    watchHistory?: Continuity_WatchHistory
    watchedProgress?: number
    spoilerActive?: boolean
    blurAdultContent?: boolean
    disabled?: boolean
    loadingEpisodeNumber?: number | null
    showAnimeTitle?: boolean
}

function EpisodeLoadingBadge() {
    return (
        <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-black/70">
            <ActivityIndicator size="small" color="rgba(255,255,255,0.92)" />
        </View>
    )
}

function EpisodeCardSeparator() {
    return <View style={ITEM_SEPARATOR_STYLE} />
}

export function EpisodeCardList(props: EpisodeCardListProps) {
    const {
        title,
        episodes,
        onEpisodePress,
        mediaId,
        watchHistory,
        watchedProgress,
        spoilerActive,
        blurAdultContent,
        disabled,
        loadingEpisodeNumber,
        showAnimeTitle,
    } = props
    const serverStatus = useServerStatus()

    const keyExtractor = React.useCallback((item: Anime_Episode, index: number) => {
        return item.localFile?.path || `${item.baseAnime?.id ?? "episode"}-${item.episodeNumber}-${index}`
    }, [])

    const renderEpisodeCard = React.useCallback(({ item }: ListRenderItemInfo<Anime_Episode>) => {
        const spoiler = getEpisodeSpoilerState(serverStatus, {
            episodeNumber: item.progressNumber || item.episodeNumber,
            watchedProgress,
            spoilerActive,
        })
        const image = item.episodeMetadata?.image || item.baseAnime?.bannerImage || item.baseAnime?.coverImage?.large || ""
        const isLoading = loadingEpisodeNumber === item.episodeNumber
        const animeTitle = showAnimeTitle
            ? (item.baseAnime?.title?.userPreferred || item.baseAnime?.title?.english || item.baseAnime?.title?.romaji || undefined)
            : undefined

        return (
            <EpisodeCard
                cardWidth={CARD_WIDTH}
                image={image}
                imageBlurred={spoiler.hideThumbnail || blurAdultContent}
                title={spoiler.hideTitle ? `Episode ${item.episodeNumber}` : item.episodeTitle}
                episodeNumber={item.episodeNumber}
                totalEpisodes={item.baseAnime?.episodes}
                length={item.episodeMetadata?.length}
                progressPercent={(item.baseAnime?.id ?? mediaId)
                    ? getEpisodePercentageComplete(watchHistory, item.baseAnime?.id ?? mediaId ?? 0, item.progressNumber)
                    : 0}
                onPress={() => {
                    onEpisodePress?.(item)
                }}
                disabled={disabled}
                thumbnailOverlay={isLoading ? <EpisodeLoadingBadge /> : undefined}
                animeTitle={animeTitle}
            />
        )
    }, [disabled, loadingEpisodeNumber, mediaId, onEpisodePress, serverStatus, spoilerActive, watchedProgress, watchHistory, showAnimeTitle])

    const getItemLayout = React.useCallback((_: ArrayLike<Anime_Episode> | null | undefined, index: number) => ({
        length: ITEM_FULL_WIDTH,
        offset: ITEM_FULL_WIDTH * index,
        index,
    }), [])

    return (
        <View>
            {!!title && <View className="p-4">
                <Text className="text-2xl font-bold text-foreground">{title}</Text>
            </View>}
            <View style={{ height: CARD_ROW_HEIGHT }}>
                <FlatList
                    data={episodes}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={keyExtractor}
                    renderItem={renderEpisodeCard}
                    contentContainerStyle={CONTENT_CONTAINER_STYLE}
                    ItemSeparatorComponent={EpisodeCardSeparator}
                    getItemLayout={getItemLayout}
                    initialNumToRender={Math.min(episodes.length, INITIAL_EPISODE_CARD_RENDER)}
                    maxToRenderPerBatch={INITIAL_EPISODE_CARD_RENDER}
                    windowSize={5}
                    removeClippedSubviews
                    snapToInterval={ITEM_FULL_WIDTH}
                    snapToAlignment="start"
                    decelerationRate="fast"
                    directionalLockEnabled
                    disableIntervalMomentum
                />
            </View>
        </View>
    )
}
