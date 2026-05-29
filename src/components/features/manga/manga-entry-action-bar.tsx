import { HibikeManga_ChapterDetails, Manga_Entry } from "@/api/generated/types"
import { DownloadMangaChaptersModal } from "@/components/features/manga/download-chapters-modal"
import { formatMangaReaderHref, getPreferredStartChapter } from "@/components/features/manga/reader/manga-reader-utils"
import { Button } from "@/components/ui/button"
import { useAllDownloadedMangaChapters, useCompletedMangaChapters, useMangaDownloadQueueLength } from "@/lib/downloads/use-manga-downloads"
import { useIsServerConnected } from "@/lib/offline"
import { Ionicons } from "@expo/vector-icons"
import { useRouter } from "expo-router"
import React, { useMemo, useState } from "react"
import { Text, View } from "react-native"

type MangaEntryActionBarProps = {
    entry: Manga_Entry
    provider: string | null
    chapters: HibikeManga_ChapterDetails[]
}

export function MangaEntryActionBar({
    entry,
    provider,
    chapters,
}: MangaEntryActionBarProps) {
    const router = useRouter()
    const [downloadModalOpen, setDownloadModalOpen] = useState(false)
    const downloadedChapters = useCompletedMangaChapters(entry.mediaId, provider)
    const allDownloadedChapters = useAllDownloadedMangaChapters(entry.mediaId)
    const queueLength = useMangaDownloadQueueLength()
    const isConnected = useIsServerConnected()

    const progress = entry.listData?.progress ?? 0

    const nextChapter = useMemo(() => {
        return getPreferredStartChapter(
            entry.mediaId,
            progress,
            chapters,
            allDownloadedChapters,
        )
    }, [allDownloadedChapters, chapters, entry.mediaId, progress])

    const hasDownloads = downloadedChapters.length > 0
    const hasChapters = chapters.length > 0 && isConnected

    return (
        <>
            <View className="flex-row items-center gap-2.5 px-4 pb-4 pt-1">
                {nextChapter && (
                    <Button
                        className="flex-1 rounded-xl h-11"
                        onPress={() => {
                            router.push(formatMangaReaderHref({
                                mediaId: nextChapter.mediaId,
                                provider: nextChapter.provider,
                                chapterId: nextChapter.chapterId,
                                chapterNumber: nextChapter.chapterNumber,
                            }))
                        }}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="book" size={15} color="black" />
                            <Text className="text-sm font-semibold text-primary-foreground" numberOfLines={1}>
                                {progress > 0 ? `Ch. ${nextChapter.chapterNumber}` : "Start Reading"}
                            </Text>
                        </View>
                    </Button>
                )}

                {hasChapters && (
                    <Button
                        variant="secondary"
                        className="rounded-xl h-11"
                        style={nextChapter ? { paddingHorizontal: 14 } : { flex: 1 }}
                        onPress={() => setDownloadModalOpen(true)}
                    >
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="download-outline" size={17} color="white" />
                            {hasDownloads ? (
                                <Text className="text-sm font-medium text-secondary-foreground">
                                    {downloadedChapters.length}
                                </Text>
                            ) : !nextChapter ? (
                                <Text className="text-sm font-medium text-secondary-foreground">
                                    Download
                                </Text>
                            ) : null}
                            {queueLength > 0 && (
                                <View className="bg-brand-300/20 rounded-full px-1.5 py-0.5">
                                    <Text className="text-xs font-bold text-brand-300">{queueLength}</Text>
                                </View>
                            )}
                        </View>
                    </Button>
                )}
            </View>

            <DownloadMangaChaptersModal
                entry={entry}
                provider={provider}
                chapters={chapters}
                open={downloadModalOpen}
                onOpenChange={setDownloadModalOpen}
            />
        </>
    )
}
