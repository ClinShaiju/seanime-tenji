import { Anime_Episode } from "@/api/generated/types"
import { useServerStatus } from "@/atoms/server.atoms"
import { SeaImage } from "@/components/shared/sea-image"
import { Surface } from "@/components/shared/surface"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Text } from "@/components/ui/text"
import { getEpisodeSpoilerState, getSpoilerSafeAnimeImage } from "@/lib/anime-spoilers"
import { Ionicons } from "@/lib/icons/Ionicons"
import { LinearGradient } from "expo-linear-gradient"
import * as React from "react"
import { View } from "react-native"

type MediaEpisodeInfoSheetProps = {
    episode: Anime_Episode
    open: boolean
    onOpenChange: (open: boolean) => void
    imageOverride?: string
    watchedProgress?: number
}

function cleanEpisodeText(value?: string | null) {
    return value
        ?.replace(/<[^>]*>/g, "")
        ?.replace(/source:.*/gi, "")
        ?.replaceAll("`", "'")
        ?.trim()
}

export function MediaEpisodeInfoSheet({
    episode,
    open,
    onOpenChange,
    imageOverride,
    watchedProgress,
}: MediaEpisodeInfoSheetProps) {
    const serverStatus = useServerStatus()
    const spoiler = getEpisodeSpoilerState(serverStatus, {
        episodeNumber: episode.progressNumber || episode.episodeNumber,
        watchedProgress,
    })
    const sheetTitle = episode.displayTitle || `Episode ${episode.episodeNumber}`
    const episodeTitle = spoiler.hideTitle ? `Episode ${episode.episodeNumber}` : cleanEpisodeText(episode.episodeTitle) || sheetTitle
    const summary = spoiler.hideDescription ? null : cleanEpisodeText(episode.episodeMetadata?.summary || episode.episodeMetadata?.overview)
    const filename = spoiler.hideTitle ? null : episode.localFile?.name?.trim()
    const spoilerSafeImage = getSpoilerSafeAnimeImage(episode.baseAnime)
    const originalImageUri = imageOverride || episode.episodeMetadata?.image || episode.baseAnime?.bannerImage || undefined
    const imageUri = spoiler.hideThumbnail ? (spoilerSafeImage || originalImageUri) : originalImageUri
    const blurAdultContent = !!serverStatus?.settings?.anilist?.blurAdultContent && !!episode.baseAnime?.isAdult
    const airDate = episode.episodeMetadata?.airDate
    const length = episode.episodeMetadata?.length
    const hasMetadata = Boolean(airDate || length || summary || filename || episode.isInvalid)

    if (!hasMetadata && episodeTitle === sheetTitle) return null

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={summary ? ["58%", "82%"] : ["46%", "68%"]}
        >
            {imageUri ? (
                <View
                    className="mb-5 overflow-hidden rounded-2xl"
                    style={{ height: 132 }}
                >
                    <SeaImage
                        source={{ uri: imageUri }}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
                        contentFit="cover"
                        transition={120}
                        blurRadius={(spoiler.hideThumbnail && !spoilerSafeImage) || blurAdultContent ? 18 : 0}
                    />
                    <View className="absolute inset-0 bg-black/20" pointerEvents="none" />
                    <LinearGradient
                        colors={["transparent", "rgba(12,12,12,0.7)", "rgba(12,12,12,1)"]}
                        locations={[0, 0.6, 1]}
                        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                    />
                </View>
            ) : null}

            <View className="gap-4">
                <View className="gap-2">
                    <Text className="text-lg font-semibold leading-6 text-foreground">
                        {episodeTitle}
                    </Text>

                    {(airDate || length || episode.isInvalid) ? (
                        <View className="flex-row flex-wrap items-center gap-2">
                            {(airDate || length) ? (
                                <Text className="text-sm text-white/45">
                                    {airDate || "Unknown airing date"}
                                    {length ? ` • ${length} min` : ""}
                                </Text>
                            ) : null}

                            {episode.isInvalid ? (
                                <View className="flex-row items-center gap-1 rounded-full bg-red-500/10 px-2 py-1">
                                    <Ionicons name="warning-outline" size={12} colorClassName="text-red-300" />
                                    <Text className="text-xs font-medium text-red-200">Metadata mismatch</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </View>

                <Text className="text-sm leading-6 text-white/70">
                    {summary || "No summary available."}
                </Text>

                {filename ? (
                    <Surface variant="muted" className="px-3 py-3">
                        <Text className="text-xs leading-5 text-white/45">
                            {filename}
                        </Text>
                    </Surface>
                ) : null}
            </View>
        </SeaBottomSheet>
    )
}
