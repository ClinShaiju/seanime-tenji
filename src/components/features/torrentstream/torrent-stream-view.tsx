import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { useServerStatus } from "@/atoms/server.atoms"
import { EpisodeCardList } from "@/components/features/anime/episode-card-list"
import { AnimeEpisodeSection } from "@/components/features/media/anime-entry-library-view"
import { LabeledSwitch } from "@/components/shared/labeled-switch"
import { SegmentedControl } from "@/components/shared/segmented-control"
import { Surface } from "@/components/shared/surface"
import { getSequentialContinueWatchingSpoilerActive } from "@/lib/anime-spoilers"
import * as React from "react"
import { Text, View } from "react-native"
import type { StreamMode } from "./use-torrent-stream-controller"

type TorrentStreamViewProps = {
    entry: Anime_Entry,
    progress: number
    episodes: Anime_Episode[]
    selectedEpisodeNumber: number
    continueEpisodes: Anime_Episode[]
    availableModes: StreamMode[]
    onEpisodePress: (episode: Anime_Episode) => void
    isEpisodeSelectionLocked: boolean
    loadingEpisodeNumber: number | null
    autoSelect: boolean
    autoSelectFile: boolean
    streamMode: StreamMode
    onSelectStreamMode: (mode: StreamMode) => void
    onToggleAutoSelect: () => void
    onToggleAutoSelectFile: () => void
    onToggleUsePreviousBatch: () => void
    usePreviousBatch: boolean
    hasMappingError: boolean
}

export function TorrentStreamView({
    entry,
    progress,
    episodes,
    selectedEpisodeNumber,
    continueEpisodes,
    availableModes,
    onEpisodePress,
    isEpisodeSelectionLocked,
    loadingEpisodeNumber,
    autoSelect,
    autoSelectFile,
    streamMode,
    onSelectStreamMode,
    onToggleAutoSelect,
    onToggleAutoSelectFile,
    onToggleUsePreviousBatch,
    usePreviousBatch,
    hasMappingError,
}: TorrentStreamViewProps) {
    const serverStatus = useServerStatus()
    const continueWatchingSpoilerActive = getSequentialContinueWatchingSpoilerActive(serverStatus)

    const initialActiveEpisodeNumber = React.useMemo(() => {
        if (selectedEpisodeNumber > 0) return selectedEpisodeNumber
        const nextUp = episodes.find(ep => ep.episodeNumber > progress)
        return nextUp?.episodeNumber ?? episodes[0]?.episodeNumber ?? 0
    }, [selectedEpisodeNumber, episodes, progress])
    const handleAvailableEpisodePress = React.useMemo(() => {
        return isEpisodeSelectionLocked ? undefined : onEpisodePress
    }, [isEpisodeSelectionLocked, onEpisodePress])

    return (
        <>

            <View className="px-4 mb-5">
                <Surface variant="muted" className="p-3.5 gap-3.5">
                    {availableModes.length > 1 && (
                        <SegmentedControl
                            options={[
                                { value: "torrent", label: "Torrent" },
                                { value: "debrid", label: "Debrid" },
                            ]}
                            value={streamMode}
                            onChange={onSelectStreamMode}
                        />
                    )}

                    {hasMappingError && (
                        <Text className="text-yellow-200 text-xs leading-relaxed">
                            AniDB mapping is missing for this title. Manual release selection may be required.
                        </Text>
                    )}

                    <LabeledSwitch
                        label={streamMode === "debrid" ? "Auto-select debrid stream" : "Auto-select torrent"}
                        checked={autoSelect}
                        onToggle={onToggleAutoSelect}
                        helper={streamMode === "debrid"
                            ? "Automatically pick the best torrent and debrid file for the episode."
                            : "Automatically pick the best torrent and file for the episode."}
                    />

                    {!autoSelect && usePreviousBatch && (
                        <LabeledSwitch
                            label="Reuse previous batch"
                            checked={usePreviousBatch}
                            onToggle={onToggleUsePreviousBatch}
                            helper="Reuse the previously selected batch torrent for subsequent episodes when possible."
                        />
                    )}

                    {!autoSelect && !usePreviousBatch && (
                        <LabeledSwitch
                            label="Auto-select file"
                            checked={autoSelectFile}
                            onToggle={onToggleAutoSelectFile}
                            helper={"Automatically select the matching file from batch torrents."}
                        />
                    )}
                </Surface>
            </View>

            {continueEpisodes.length > 0 && (
                <View className="mb-6">
                    <EpisodeCardList
                        title="Continue Watching"
                        episodes={continueEpisodes}
                        onEpisodePress={handleAvailableEpisodePress}
                        watchedProgress={progress}
                        spoilerActive={continueWatchingSpoilerActive}
                        disabled={isEpisodeSelectionLocked}
                        loadingEpisodeNumber={loadingEpisodeNumber}
                    />
                </View>
            )}

            <View className="px-4 gap-6">
                <AnimeEpisodeSection
                    title={`Episodes`}
                    episodes={episodes}
                    progress={progress}
                    entry={entry}
                    onEpisodePress={handleAvailableEpisodePress}
                    initialActiveEpisodeNumber={initialActiveEpisodeNumber}
                    disableEpisodePresses={isEpisodeSelectionLocked}
                    loadingEpisodeNumber={loadingEpisodeNumber}
                />
            </View>
        </>
    )
}
