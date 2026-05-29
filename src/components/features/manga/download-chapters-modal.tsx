import { HibikeManga_ChapterDetails, Manga_Entry } from "@/api/generated/types"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { type MangaDownloadStatus, useDownloadedMangaChapters, useStartMangaChapterDownload } from "@/lib/downloads"
import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import React, { useCallback, useMemo, useState } from "react"
import { Pressable, ScrollView, Text, View } from "react-native"

const MODAL_PAGE_SIZE = 20

function isChapterSelectionLocked(status: MangaDownloadStatus | null | undefined): boolean {
    return status === "completed" || status === "downloading" || status === "pending"
}

type DownloadMangaChaptersModalProps = {
    entry: Manga_Entry
    provider: string | null
    chapters: HibikeManga_ChapterDetails[]
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DownloadMangaChaptersModal({
    entry,
    provider,
    chapters: _chapters,
    open,
    onOpenChange,
}: DownloadMangaChaptersModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [page, setPage] = useState(0)
    const startDownload = useStartMangaChapterDownload(entry, provider)

    const [showRead, setShowRead] = useState(false)
    const mediaId = entry.mediaId
    const progress = entry.listData?.progress ?? 0

    const downloadedChapters = useDownloadedMangaChapters(mediaId, provider)
    const downloadStatusById = useMemo(() => {
        return new Map(downloadedChapters.map(chapter => [chapter.chapterId, chapter.status]))
    }, [downloadedChapters])

    // pagination
    const chapters = (showRead ? _chapters : _chapters.filter(ch => {
        const chapterNumber = parseFloat(ch.chapter)
        return isNaN(chapterNumber) || chapterNumber > progress
    })).filter(ch => {
        const status = downloadStatusById.get(ch.id)
        return status !== "completed" && status !== "downloading"
    })
    const totalPages = Math.max(1, Math.ceil(chapters.length / MODAL_PAGE_SIZE))
    const pagedChapters = chapters.slice(page * MODAL_PAGE_SIZE, (page + 1) * MODAL_PAGE_SIZE)

    // reset page when modal opens/closes
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

            for (const chapterId of prev) {
                if (isChapterSelectionLocked(downloadStatusById.get(chapterId))) {
                    changed = true
                    continue
                }

                next.add(chapterId)
            }

            return changed ? next : prev
        })
    }, [downloadStatusById])

    const toggleChapter = useCallback((chapterId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(chapterId)) {
                next.delete(chapterId)
            } else {
                next.add(chapterId)
            }
            return next
        })
    }, [])

    const selectAll = useCallback(() => {
        const ids = new Set(
            chapters
                .filter(ch => !isChapterSelectionLocked(downloadStatusById.get(ch.id)))
                .map(ch => ch.id),
        )
        setSelectedIds(ids)
    }, [chapters, downloadStatusById])

    const deselectAll = useCallback(() => {
        setSelectedIds(new Set())
    }, [])

    const selectUnread = useCallback(() => {
        const unread = chapters.filter(ch => {
            if (isChapterSelectionLocked(downloadStatusById.get(ch.id))) return false
            const num = parseFloat(ch.chapter)
            return isNaN(num) || num > progress
        })
        setSelectedIds(new Set(unread.map(ch => ch.id)))
    }, [chapters, downloadStatusById, progress])

    const handleDownload = useCallback(() => {
        const toDownload = chapters.filter(ch => selectedIds.has(ch.id))
        if (toDownload.length === 0) return
        startDownload(toDownload)
        setSelectedIds(new Set())
        onOpenChange(false)
    }, [chapters, selectedIds, startDownload, onOpenChange])

    const selectableChapterCount = useMemo(() => {
        return chapters.reduce((count, chapter) => {
            return count + (isChapterSelectionLocked(downloadStatusById.get(chapter.id)) ? 0 : 1)
        }, 0)
    }, [chapters, downloadStatusById])
    const allSelected = selectedIds.size === selectableChapterCount && selectableChapterCount > 0

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Download Chapters"
            snapPoints={["70%", "92%"]}
            footer={
                <View className="flex-row items-center gap-3">
                    <Button
                        variant="secondary"
                        className="flex-1 rounded-xl"
                        onPress={allSelected ? deselectAll : selectAll}
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2 px-1 pb-3">
                    <Pressable
                        onPress={selectUnread}
                        className="rounded-lg px-3 py-1.5 bg-white/5 border border-white/10"
                    >
                        <Text className="text-xs text-white/70">Select Unread</Text>
                    </Pressable>
                    <Pressable
                        onPress={selectAll}
                        className="rounded-lg px-3 py-1.5 bg-white/5 border border-white/10"
                    >
                        <Text className="text-xs text-white/70">Select All</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => setShowRead(prev => !prev)}
                        className="rounded-lg px-3 py-1.5 bg-white/5 border border-white/10"
                    >
                        <Text className="text-xs text-white/70">{showRead ? "Hide Read" : "Show Read"}</Text>
                    </Pressable>
                    <Pressable
                        onPress={deselectAll}
                        className="rounded-lg px-3 py-1.5 bg-white/5 border border-white/10"
                    >
                        <Text className="text-xs text-white/70">Clear</Text>
                    </Pressable>
                </View>
            </ScrollView>

            {chapters.length === 0 ? (
                <View className="py-16 items-center gap-3">
                    <Ionicons name="cloud-offline-outline" size={40} color="rgba(255,255,255,0.2)" />
                    <Text className="text-white/40 text-sm">
                        No chapters available for download
                    </Text>
                </View>
            ) : (
                <>
                    {chapters.length > MODAL_PAGE_SIZE && (
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
                        {pagedChapters.map(chapter => {
                            const downloadStatus = downloadStatusById.get(chapter.id) ?? null
                            const isDownloaded = downloadStatus === "completed"
                            const isDownloading = downloadStatus === "downloading"
                            const isPending = downloadStatus === "pending"
                            const isFailed = downloadStatus === "failed"
                            const isUnavailable = isChapterSelectionLocked(downloadStatus)
                            const chapterNumber = parseFloat(chapter.chapter)
                            const isRead = !isNaN(chapterNumber) && chapterNumber <= progress
                            const selected = selectedIds.has(chapter.id)

                            return (
                                <Pressable
                                    key={chapter.id}
                                    onPress={isUnavailable ? undefined : () => toggleChapter(chapter.id)}
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
                                        className={cn(
                                            "w-12 h-8 rounded-lg items-center justify-center ml-2",
                                            isRead ? "bg-brand-300/10" : "bg-white/5",
                                        )}
                                    >
                                        <Text
                                            className={cn(
                                                "text-sm font-bold",
                                                isRead ? "text-brand-300/60" : "text-white/80",
                                            )} numberOfLines={1}
                                        >
                                            {chapter.chapter}
                                        </Text>
                                    </View>

                                    <View className="flex-1 ml-3 justify-center">
                                        <Text className="text-sm font-medium text-white/90" numberOfLines={1}>
                                            {chapter.title || `Chapter ${chapter.chapter}`}
                                        </Text>
                                        {!!chapter.scanlator && (
                                            <Text className="text-xs text-white/30 mt-0.5" numberOfLines={1}>
                                                {chapter.scanlator}
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
                        })}
                    </View>
                </>
            )}
        </SeaBottomSheet>
    )
}
