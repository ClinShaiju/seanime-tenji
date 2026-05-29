import { Anime_Entry, Anime_Episode } from "@/api/generated/types"
import { useServerStatus } from "@/atoms/server.atoms"
import { SeaImage } from "@/components/shared/sea-image"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { getEpisodeSpoilerState, getSpoilerSafeAnimeImage } from "@/lib/anime-spoilers"
import { type DownloadStatus, getDownloadEpisodeId, useDownloadedEpisodesForMedia, useStartAnimeBatchDownload } from "@/lib/downloads"
import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"

const MODAL_PAGE_SIZE = 40

function isEpisodeSelectionLocked(status: DownloadStatus | null | undefined): boolean {
    return status === "completed" || status === "downloading" || status === "pending"
}

function getEpisodeDownloadId(episode: Anime_Episode): string {
    return getDownloadEpisodeId(episode.aniDBEpisode, episode.type, episode.episodeNumber, episode.localFile?.path)
}

type DownloadEpisodesModalProps = {
    entry: Anime_Entry
    episodes: Anime_Episode[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DownloadEpisodesModal({
    entry,
    episodes,
    open,
    onOpenChange,
}: DownloadEpisodesModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [page, setPage] = useState(0)
    const startBatch = useStartAnimeBatchDownload(entry)

    const [showWatched, setShowWatched] = useState(false)
    const [showNonMain, setShowNonMain] = useState(false)

    const downloadedEpisodes = useDownloadedEpisodesForMedia(entry.mediaId)
    const downloadStatusById = useMemo(() => {
        return new Map(downloadedEpisodes.map(episode => [episode.aniDBEpisode, episode.status]))
    }, [downloadedEpisodes])

    // only show episodes that have a local file on the server
    const _downloadableEpisodes = useMemo(() => {
        const localFileEpisodes = episodes.filter(ep => ep.localFile?.path)

        if (showNonMain) return localFileEpisodes

        return localFileEpisodes.filter(ep => ep.type === "main")
    }, [episodes, showNonMain])

    const hasNonMainEpisodes = useMemo(() => {
        return episodes.some(ep => ep.localFile?.path && ep.type !== "main")
    }, [episodes])

    const downloadableEpisodes = showWatched ? _downloadableEpisodes : _downloadableEpisodes.filter(ep => {
        const episodeId = getEpisodeDownloadId(ep)
        if (isEpisodeSelectionLocked(downloadStatusById.get(episodeId))) return false
        if (ep.type !== "main") return true
        const progressNumber = entry.listData?.progress ?? 0
        return ep.progressNumber > progressNumber
    })

    // pagination
    const totalPages = Math.max(1, Math.ceil(downloadableEpisodes.length / MODAL_PAGE_SIZE))
    const pagedEpisodes = downloadableEpisodes.slice(page * MODAL_PAGE_SIZE, (page + 1) * MODAL_PAGE_SIZE)
    const downloadableEpisodeIds = useMemo(() => {
        return new Set(downloadableEpisodes.map(getEpisodeDownloadId))
    }, [downloadableEpisodes])

    React.useEffect(() => {
        if (open) setPage(0)
    }, [open])

    React.useEffect(() => {
        if (!open) return
        if (page > 0 && page >= totalPages) {
            setPage(0)
        }
    }, [open, totalPages, page])

    React.useEffect(() => {
        setSelectedIds(prev => {
            let changed = false
            const next = new Set<string>()

            for (const episodeId of prev) {
                if (!downloadableEpisodeIds.has(episodeId) || isEpisodeSelectionLocked(downloadStatusById.get(episodeId))) {
                    changed = true
                    continue
                }

                next.add(episodeId)
            }

            return changed ? next : prev
        })
    }, [downloadStatusById, downloadableEpisodeIds])

    const toggleEpisode = useCallback((episodeId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(episodeId)) {
                next.delete(episodeId)
            } else {
                next.add(episodeId)
            }
            return next
        })
    }, [])

    const visibleSelectedCount = useMemo(() => {
        return downloadableEpisodes.reduce((count, episode) => {
            return count + (selectedIds.has(getEpisodeDownloadId(episode)) ? 1 : 0)
        }, 0)
    }, [downloadableEpisodes, selectedIds])

    const selectAll = useCallback(() => {
        const ids = new Set(
            downloadableEpisodes
                .map(ep => ({
                    episode: ep,
                    episodeId: getEpisodeDownloadId(ep),
                }))
                .filter(({ episodeId }) => !isEpisodeSelectionLocked(downloadStatusById.get(episodeId)))
                .map(({ episodeId }) => episodeId),
        )
        setSelectedIds(ids)
    }, [downloadStatusById, downloadableEpisodes])

    const deselectAll = useCallback(() => {
        setSelectedIds(new Set())
    }, [])

    const selectUnwatched = useCallback(() => {
        const watchProgress = entry.listData?.progress ?? 0
        const unwatched = downloadableEpisodes.filter(ep => {
            const episodeId = getEpisodeDownloadId(ep)
            if (isEpisodeSelectionLocked(downloadStatusById.get(episodeId))) return false
            if (ep.type !== "main") return true
            return ep.progressNumber > watchProgress
        })
        setSelectedIds(new Set(unwatched.map(getEpisodeDownloadId)))
    }, [downloadStatusById, downloadableEpisodes, entry.listData?.progress])

    const unwatchedEpisodeIds = useMemo(() => {
        const watchProgress = entry.listData?.progress ?? 0
        return new Set(downloadableEpisodes.filter(ep => {
            const episodeId = getEpisodeDownloadId(ep)
            if (isEpisodeSelectionLocked(downloadStatusById.get(episodeId))) return false
            if (ep.type !== "main") return true
            return ep.progressNumber > watchProgress
        }).map(getEpisodeDownloadId))
    }, [downloadStatusById, downloadableEpisodes, entry.listData?.progress])

    const allUnwatchedSelected = unwatchedEpisodeIds.size > 0
        && Array.from(unwatchedEpisodeIds).every(episodeId => selectedIds.has(episodeId))

    const deselectUnwatched = useCallback(() => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            for (const episodeId of unwatchedEpisodeIds) {
                next.delete(episodeId)
            }
            return next
        })
    }, [unwatchedEpisodeIds])

    const handleDownload = useCallback(() => {
        const toDownload = downloadableEpisodes.filter(ep => {
            const id = getEpisodeDownloadId(ep)
            return selectedIds.has(id)
        })
        if (toDownload.length === 0) return
        startBatch(toDownload)
        setSelectedIds(new Set())
        onOpenChange(false)
    }, [downloadableEpisodes, selectedIds, startBatch, onOpenChange])

    const selectableEpisodeCount = useMemo(() => {
        return downloadableEpisodes.reduce((count, episode) => {
            const episodeId = getEpisodeDownloadId(episode)
            return count + (isEpisodeSelectionLocked(downloadStatusById.get(episodeId)) ? 0 : 1)
        }, 0)
    }, [downloadStatusById, downloadableEpisodes])
    const allSelected = selectedIds.size === selectableEpisodeCount && selectableEpisodeCount > 0
    const hasVisibleSelection = visibleSelectedCount > 0

    const toggleAll = useCallback(() => {
        if (allSelected) {
            deselectAll()
            return
        }

        selectAll()
    }, [allSelected, deselectAll, selectAll])

    const toggleUnwatched = useCallback(() => {
        if (allUnwatchedSelected) {
            deselectUnwatched()
            return
        }

        selectUnwatched()
    }, [allUnwatchedSelected, deselectUnwatched, selectUnwatched])

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Download Episodes"
            snapPoints={["70%", "92%"]}
            footer={
                <View className="flex-row items-center gap-3">
                    <Button
                        variant="secondary"
                        className="flex-1 rounded-xl"
                        onPress={toggleAll}
                    >
                        <Text className="text-sm font-medium text-secondary-foreground">
                            {allSelected ? "Deselect All" : "Select All"}
                        </Text>
                    </Button>
                    <Button
                        className="flex-[2] rounded-xl"
                        disabled={selectedIds.size === 0}
                        onPress={handleDownload}
                        style={selectedIds.size === 0 ? { opacity: 0.4 } : undefined}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="download" size={16} color="black" />
                            <Text className="text-sm font-semibold text-primary-foreground">
                                Download{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                            </Text>
                        </View>
                    </Button>
                </View>
            }
        >
            <ScrollView
                horizontal
                nestedScrollEnabled
                showsHorizontalScrollIndicator={false}
                className="-mx-4"
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}
            >
                <DownloadFilterChip
                    label={allUnwatchedSelected ? "Deselect Unwatched" : "Select Unwatched"}
                    icon={allUnwatchedSelected ? "eye-outline" : "eye-off-outline"}
                    selected={allUnwatchedSelected}
                    onPress={toggleUnwatched}
                />
                <DownloadFilterChip
                    label={allSelected ? "Deselect All" : "Select All"}
                    icon={allSelected ? "close-circle-outline" : "checkmark-done-outline"}
                    selected={allSelected}
                    onPress={toggleAll}
                />
                <DownloadFilterChip
                    label="Watched"
                    icon="eye-outline"
                    selected={showWatched}
                    onPress={() => setShowWatched(prev => !prev)}
                />
                {hasNonMainEpisodes ? (
                    <DownloadFilterChip
                        label="Extras"
                        icon="sparkles-outline"
                        selected={showNonMain}
                        onPress={() => setShowNonMain(prev => !prev)}
                    />
                ) : null}
                <DownloadFilterChip label="Clear" icon="close-outline" onPress={deselectAll} disabled={!hasVisibleSelection} />
            </ScrollView>

            {downloadableEpisodes.length === 0 ? (
                <View className="py-8 items-center">
                    <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.3)" />
                    <Text className="text-white/40 text-sm mt-3">
                        No episodes available for download
                    </Text>
                </View>
            ) : (
                <>
                    {downloadableEpisodes.length > MODAL_PAGE_SIZE && (
                        <View className="flex-row items-center justify-center gap-3 pb-2">
                            <Pressable
                                onPress={() => setPage(Math.max(0, page - 1))}
                                disabled={page === 0}
                                className={cn(
                                    "w-8 h-8 rounded-lg items-center justify-center",
                                    page === 0 ? "opacity-25" : "bg-white/5",
                                )}
                            >
                                <Ionicons name="chevron-back" size={16} color="white" />
                            </Pressable>
                            <Text className="min-w-12 text-center text-xs font-medium text-white/40">
                                {page + 1} / {totalPages}
                            </Text>
                            <Pressable
                                onPress={() => setPage(Math.min(totalPages - 1, page + 1))}
                                disabled={page === totalPages - 1}
                                className={cn(
                                    "w-8 h-8 rounded-lg items-center justify-center",
                                    page === totalPages - 1 ? "opacity-25" : "bg-white/5",
                                )}
                            >
                                <Ionicons name="chevron-forward" size={16} color="white" />
                            </Pressable>
                        </View>
                    )}

                    <View className="gap-1">
                        {pagedEpisodes.map(episode => {
                            const episodeId = getEpisodeDownloadId(episode)
                            const downloadStatus = downloadStatusById.get(episodeId) ?? null
                            return (
                                <DownloadEpisodeRow
                                    key={episodeId}
                                    episode={episode}
                                    downloadStatus={downloadStatus}
                                    selected={selectedIds.has(episodeId)}
                                    watchedProgress={entry.listData?.progress ?? 0}
                                    onToggle={() => toggleEpisode(episodeId)}
                                />
                            )
                        })}
                    </View>
                </>
            )}
        </SeaBottomSheet>
    )
}

type DownloadEpisodeRowProps = {
    episode: Anime_Episode
    downloadStatus: DownloadStatus | null
    selected: boolean
    watchedProgress: number
    onToggle: () => void
}

type DownloadFilterChipProps = {
    label: string
    icon: React.ComponentProps<typeof Ionicons>["name"]
    selected?: boolean
    disabled?: boolean
    onPress: () => void
}

function DownloadFilterChip({ label, icon, selected = false, disabled = false, onPress }: DownloadFilterChipProps) {
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            className={cn(
                "h-8 flex-row items-center gap-1.5 rounded-full border px-3",
                disabled && "opacity-40",
                selected
                    ? "border-brand-300/60 bg-brand-300/15"
                    : "border-white/10 bg-white/[0.04] active:bg-white/10",
            )}
            disabled={disabled}
        >
            <Ionicons name={selected ? "checkmark-circle" : icon} size={14} color={selected ? "rgb(165,159,255)" : "rgba(255,255,255,0.55)"} />
            <Text className={cn("text-xs font-semibold", selected ? "text-brand-200" : "text-white/65")}>{label}</Text>
        </Pressable>
    )
}

function DownloadEpisodeRow({ episode, downloadStatus, selected, watchedProgress, onToggle }: DownloadEpisodeRowProps) {
    const serverStatus = useServerStatus()
    const thumbnailWidth = 80
    const isDownloaded = downloadStatus === "completed"
    const isDownloading = downloadStatus === "downloading"
    const isPending = downloadStatus === "pending"
    const isFailed = downloadStatus === "failed"
    const isUnavailable = isEpisodeSelectionLocked(downloadStatus)
    const spoiler = getEpisodeSpoilerState(serverStatus, {
        episodeNumber: episode.progressNumber || episode.episodeNumber,
        watchedProgress,
    })
    const spoilerSafeImage = getSpoilerSafeAnimeImage(episode.baseAnime)
    const originalImage = episode.episodeMetadata?.image || episode.baseAnime?.bannerImage
    const image = spoiler.hideThumbnail ? (spoilerSafeImage || originalImage) : originalImage
    const blurAdultContent = !!serverStatus?.settings?.anilist?.blurAdultContent && !!episode.baseAnime?.isAdult

    return (
        <Pressable
            onPress={isUnavailable ? undefined : onToggle}
            className="flex-row items-center py-2.5 px-1 rounded-xl"
            style={[
                selected && !isUnavailable && { backgroundColor: "rgba(255,255,255,0.06)" },
                isUnavailable && { opacity: 0.45 },
            ]}
            disabled={isUnavailable}
        >
            <View className="w-8 items-center justify-center">
                {isDownloaded ? (
                    <Ionicons name="checkmark-circle" size={22} color="rgba(120,200,120,0.8)" />
                ) : isDownloading ? (
                    <Ionicons name="cloud-download-outline" size={20} color="rgba(97,82,223,0.9)" />
                ) : isPending ? (
                    <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.45)" />
                ) : (
                    <View
                        className="w-5 h-5 rounded-md border-2 items-center justify-center"
                        style={{
                            borderColor: selected ? "rgb(97,82,223)" : "rgba(255,255,255,0.25)",
                            backgroundColor: selected ? "rgb(97,82,223)" : "transparent",
                        }}
                    >
                        {selected && <Ionicons name="checkmark" size={13} color="white" />}
                    </View>
                )}
            </View>

            <View
                className="rounded-lg overflow-hidden bg-white/5 ml-2"
                style={{ width: thumbnailWidth, aspectRatio: 16 / 9 }}
            >
                <SeaImage
                    source={{ uri: image }}
                    style={{ width: "100%", height: "100%" }}
                    contentFit="cover"
                    transition={100}
                    blurRadius={(spoiler.hideThumbnail && !spoilerSafeImage) || blurAdultContent ? 18 : 0}
                />
            </View>

            <View className="flex-1 ml-3 justify-center">
                <Text className="text-sm font-semibold text-white" numberOfLines={1}>
                    {episode.type !== "main" && (
                        <Text className="text-white/40">
                            {episode.type === "special" ? "SP " : "NC "}
                        </Text>
                    )}
                    Episode {episode.episodeNumber}
                </Text>
                {!!episode.episodeTitle && !spoiler.hideTitle && (
                    <Text className="text-xs text-white/40 mt-0.5" numberOfLines={1}>
                        {episode.episodeTitle}
                    </Text>
                )}
                {isDownloaded && (
                    <Text className="text-xs text-green-400/70 mt-0.5">
                        Downloaded
                    </Text>
                )}
                {isDownloading && (
                    <Text className="text-xs text-brand-300/80 mt-0.5">
                        Downloading
                    </Text>
                )}
                {isPending && (
                    <Text className="text-xs text-white/40 mt-0.5">
                        Queued
                    </Text>
                )}
                {isFailed && (
                    <Text className="text-xs text-red-400/80 mt-0.5">
                        Failed
                    </Text>
                )}
            </View>
        </Pressable>
    )
}
