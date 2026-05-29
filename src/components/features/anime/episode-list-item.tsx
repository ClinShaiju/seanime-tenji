import { Anime_Episode } from "@/api/generated/types"
import { useServerStatus } from "@/atoms/server.atoms"
import { MediaEpisodeInfoSheet } from "@/components/features/media/media-episode-info-sheet"
import { SeaImage } from "@/components/shared/sea-image"
import { getEpisodeSpoilerState } from "@/lib/anime-spoilers"
import { useEpisodeDownloadStatus } from "@/lib/downloads"
import { Ionicons } from "@/lib/icons/Ionicons"
import { cn } from "@/lib/utils"
import React from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"

type EpisodeListItemProps = {
    episode: Anime_Episode
    fallbackImage?: string
    mediaId?: number
    onEpisodePress?: (episode: Anime_Episode) => void
    onEpisodeLongPress?: (episode: Anime_Episode) => void
    isWatched?: boolean
    thumbnailWidth: number
    isFirst?: boolean
    isLast?: boolean
    rowPressable?: boolean
    disableDetailsButton?: boolean
    /** show a play button overlay on the thumbnail (e.g. for streaming) */
    showPlayOverlay?: boolean
    /** show a loading spinner overlay on the thumbnail (e.g. fetching stream source) */
    isLoadingOverlay?: boolean
    /** show a filler badge on the thumbnail */
    isFiller?: boolean
    /** override episode image (e.g. from Onlinestream_Episode.image) */
    imageOverride?: string
    /** continuity progress 0-100, renders a thin bar at the bottom of the thumbnail */
    progressPercent?: number
    /** current AniList progress used to decide if episode metadata is spoiler-sensitive */
    watchedProgress?: number
    /** override the description copy; pass null to hide it entirely */
    descriptionOverride?: string | null
    /** suppress the default "No description" fallback */
    hideMissingDescription?: boolean
    /** small metadata line shown below the description */
    footnoteText?: string | null
    footnoteClassName?: string
    /** right-aligned control or status accessory */
    action?: React.ReactNode
    /** custom thumbnail overlay for non-standard states */
    thumbnailOverlay?: React.ReactNode
    /** blur adult content **/
    blurAdultContent?: boolean
}

function useHasEpisodeDetails(episode: Anime_Episode) {
    return Boolean(
        episode.isInvalid
        || episode.episodeMetadata?.airDate
        || episode.episodeMetadata?.length
        || episode.episodeMetadata?.summary
        || episode.episodeMetadata?.overview
        || episode.localFile?.name
        || (episode.episodeTitle && episode.episodeTitle !== episode.displayTitle),
    )
}

function EpisodeDetailsButton({
    episode,
    imageOverride,
    watchedProgress,
}: {
    episode: Anime_Episode
    imageOverride?: string
    watchedProgress?: number
}) {
    const [open, setOpen] = React.useState(false)

    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                hitSlop={8}
                className="h-8 w-8 items-center justify-center rounded-full"
            >
                <Ionicons name="information-circle-outline" size={18} color="gray" />
            </Pressable>

            <MediaEpisodeInfoSheet
                episode={episode}
                open={open}
                onOpenChange={setOpen}
                imageOverride={imageOverride}
                watchedProgress={watchedProgress}
            />
        </>
    )
}

function EpisodeListItemInner({
    episode,
    mediaId,
    onEpisodePress,
    onEpisodeLongPress,
    isWatched,
    thumbnailWidth,
    isFirst,
    isLast,
    rowPressable,
    disableDetailsButton,
    showPlayOverlay,
    isLoadingOverlay,
    isFiller,
    imageOverride,
    progressPercent,
    watchedProgress,
    fallbackImage,
    descriptionOverride,
    hideMissingDescription,
    footnoteText,
    footnoteClassName,
    action,
    thumbnailOverlay,
    blurAdultContent,
}: EpisodeListItemProps) {
    const serverStatus = useServerStatus()
    const downloadStatus = useEpisodeDownloadStatus(mediaId, episode)
    const spoiler = getEpisodeSpoilerState(serverStatus, {
        episodeNumber: episode.progressNumber || episode.episodeNumber,
        watchedProgress,
    })
    const imageUrl = imageOverride || episode.episodeMetadata?.image || episode.baseAnime?.bannerImage || fallbackImage
    // const spoilerSafeImage = getSpoilerSafeAnimeImage(episode.baseAnime)
    const blurImage = (spoiler.hideThumbnail) || blurAdultContent
    const hasEpisodeDetails = useHasEpisodeDetails(episode)
    const showDetailsButton = !disableDetailsButton && hasEpisodeDetails
    const descriptionText = descriptionOverride !== undefined
        ? descriptionOverride
        : spoiler.hideDescription ? null : episode.episodeMetadata?.summary?.replace(/<[^>]*>/g, "") || (hideMissingDescription
            ? null
            : "No description")
    const finalFootnoteText = footnoteText !== undefined ? footnoteText : spoiler.hideTitle ? null : episode.localFile?.name
    const displayEpisodeTitle = spoiler.hideTitle ? `Episode ${episode.episodeNumber}` : episode.episodeTitle || episode.displayTitle

    const thumbnail = (
        <>
            <SeaImage
                source={{ uri: imageUrl }}
                style={{ width: "100%", height: "100%", opacity: isWatched ? 0.5 : 1 }}
                contentFit="cover"
                transition={120}
                blurRadius={blurImage ? 18 : 0}
            />
            {isWatched && <View className="absolute z-10 rounded-full bg-gray-800/50 bottom-2 left-2 px-1.5 flex flex-row items-center gap-1">
                <Ionicons name="checkmark" size={12} colorClassName="accent-foreground" />
                <Text className="text-white text-xs font-medium">Completed</Text>
            </View>}
            {downloadStatus === "completed" && (
                <View className="absolute bottom-1.5 right-1.5 rounded-full p-0.5 bg-black/60">
                    <Ionicons name="arrow-down-circle" size={16} color="rgba(120,200,120,0.9)" />
                </View>
            )}
            {downloadStatus === "downloading" && (
                <View className="absolute bottom-1.5 right-1.5 rounded-full p-0.5 bg-black/60">
                    <Ionicons name="cloud-download-outline" size={16} color="rgba(97,82,223,0.9)" />
                </View>
            )}
            {isLoadingOverlay ? (
                <View className="absolute inset-0 items-center justify-center bg-black/40">
                    <ActivityIndicator size="small" color="white" />
                </View>
            ) : showPlayOverlay ? (
                <View className="absolute inset-0 items-center justify-center">
                    <View className="w-8 h-8 rounded-full bg-black/50 items-center justify-center">
                        <Ionicons name="play" size={16} color="white" />
                    </View>
                </View>
            ) : null}
            {thumbnailOverlay}
            {isFiller && (
                <View className="absolute top-1 left-1 bg-yellow-500/80 rounded px-1.5 py-0.5">
                    <Text className="text-xs font-bold text-black">FILLER</Text>
                </View>
            )}
            {progressPercent !== undefined && progressPercent > 0 && !isWatched && (
                <View className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-xl bg-white/10">
                    <View
                        className="h-full bg-brand-400 rounded-bl-xl"
                        style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                </View>
            )}
        </>
    )

    const rowContent = (
        <>
            {rowPressable ? (
                <View
                    className={cn("relative mr-3 rounded-xl overflow-hidden bg-background flex-none")}
                    style={{ width: thumbnailWidth, height: (9 / 16) * thumbnailWidth }}
                >
                    {thumbnail}
                </View>
            ) : (
                <Pressable
                    onPress={onEpisodePress ? () => onEpisodePress(episode) : undefined}
                    onLongPress={onEpisodeLongPress ? () => onEpisodeLongPress(episode) : undefined}
                    className={cn("relative mr-3 rounded-xl overflow-hidden bg-background flex-none")}
                    style={{ width: thumbnailWidth, height: (9 / 16) * thumbnailWidth }}
                >
                    {thumbnail}
                </Pressable>
            )}

            <View className="flex-1 justify-start pt-0.5">
                <View className="flex-row items-center gap-2 mb-1">
                    <Text className="text-foreground font-bold text-base">
                        Episode {episode.episodeNumber}
                    </Text>
                    {!!episode.episodeMetadata?.length && (
                        <Text className="text-muted-foreground text-sm">
                            {episode.episodeMetadata.length}m
                        </Text>
                    )}
                </View>

                <Text className="text-gray-100 font-bold text-lg leading-tight mb-1" numberOfLines={1}>
                    {displayEpisodeTitle}
                </Text>

                {descriptionText ? (
                    <Text className="text-muted-foreground text-sm leading-snug mb-1" numberOfLines={2}>
                        {descriptionText}
                    </Text>
                ) : null}

                {finalFootnoteText ? (
                    <Text
                        className={cn(
                            "text-xs text-muted-foreground/50",
                            footnoteText === undefined && "font-mono",
                            footnoteClassName,
                        )}
                        numberOfLines={1}
                        ellipsizeMode={footnoteText === undefined ? "middle" : "tail"}
                    >
                        {finalFootnoteText}
                    </Text>
                ) : null}
            </View>

            {showDetailsButton ? (
                <View className="ml-2 py-1">
                    <EpisodeDetailsButton episode={episode} imageOverride={imageOverride} watchedProgress={watchedProgress} />

                    {action ? (
                        <View className="">
                            {action}
                        </View>
                    ) : null}
                </View>
            ) : null}


        </>
    )

    const sharedProps = {
        className: cn(
            "bg-card/30 border-x border-border/50 flex-row items-stretch px-3 py-3",
            rowPressable && "active:opacity-80",
        ),
        style: [
            isFirst ? styles.firstRow : styles.middleRow,
            isLast ? styles.lastRow : styles.notLastRow,
        ],
    }

    if (rowPressable) {
        return (
            <Pressable
                {...sharedProps}
                onPress={onEpisodePress ? () => onEpisodePress(episode) : undefined}
                onLongPress={onEpisodeLongPress ? () => onEpisodeLongPress(episode) : undefined}
            >
                {rowContent}
            </Pressable>
        )
    }

    return (
        <View {...sharedProps}>
            {rowContent}
        </View>
    )
}

export const EpisodeListItem = React.memo(EpisodeListItemInner)

const styles = StyleSheet.create({
    firstRow: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
    middleRow: {
        marginTop: -StyleSheet.hairlineWidth,
    },
    lastRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
    },
    notLastRow: {
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
})
