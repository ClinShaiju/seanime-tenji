import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { DownloadEpisodesModal } from "@/components/features/media/download-episodes-modal"
import { Button } from "@/components/ui/button"
import { useCompletedEpisodesForMedia } from "@/lib/downloads"
import { useIsServerConnected } from "@/lib/offline"
import { Ionicons } from "@expo/vector-icons"
import React, { useMemo, useState } from "react"
import { Text, View } from "react-native"

type AnimeEntryActionBarProps = {
    entry: Anime_Entry
    nextEpisode?: Anime_Episode
    onContinueWatching?: () => void
}

export function AnimeEntryActionBar({
    entry,
    nextEpisode,
    onContinueWatching,
}: AnimeEntryActionBarProps) {
    const [downloadModalOpen, setDownloadModalOpen] = useState(false)
    const downloadedEpisodes = useCompletedEpisodesForMedia(entry.mediaId)
    const isConnected = useIsServerConnected()

    const allEpisodes = useMemo(() => {
        return entry.episodes?.filter(ep => ep.localFile?.path) ?? []
    }, [entry.episodes])

    const hasDownloads = downloadedEpisodes.length > 0
    const hasDownloadableEpisodes = allEpisodes.length > 0 && isConnected

    return (
        <>
            <View className="flex-row items-center gap-2.5 px-4 pb-4 pt-1">
                {nextEpisode && onContinueWatching && (
                    <Button
                        className="flex-1 rounded-xl h-11"
                        onPress={onContinueWatching}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="play" size={15} color="black" />
                            <Text className="text-sm font-semibold text-primary-foreground" numberOfLines={1}>
                                {nextEpisode.displayTitle}
                            </Text>
                        </View>
                    </Button>
                )}

                {hasDownloadableEpisodes && (
                    <Button
                        variant="secondary"
                        className="rounded-xl h-11"
                        style={nextEpisode ? { paddingHorizontal: 14 } : { flex: 1 }}
                        onPress={() => setDownloadModalOpen(true)}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="download-outline" size={17} color="white" />
                            {hasDownloads ? (
                                <Text className="text-sm font-medium text-secondary-foreground">
                                    {downloadedEpisodes.length}
                                </Text>
                            ) : !nextEpisode ? (
                                <Text className="text-sm font-medium text-secondary-foreground">
                                    Download
                                </Text>
                            ) : null}
                        </View>
                    </Button>
                )}
            </View>

            <DownloadEpisodesModal
                entry={entry}
                episodes={allEpisodes}
                open={downloadModalOpen}
                onOpenChange={setDownloadModalOpen}
            />
        </>
    )
}
