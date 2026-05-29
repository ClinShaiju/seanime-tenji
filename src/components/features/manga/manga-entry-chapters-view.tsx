import { HibikeManga_ChapterDetails, Manga_EntryListData } from "@/api/generated/types"
import { useEmptyMangaEntryCache } from "@/api/hooks/manga.hooks"
import { formatMangaReaderHref, getChapterDecimal } from "@/components/features/manga/reader/manga-reader-utils"
import { CenteredSpinner } from "@/components/shared/centered-spinner"
import { LabeledSwitch } from "@/components/shared/labeled-switch"
import { LuffyError } from "@/components/shared/luffy-error"
import { NativeSelect } from "@/components/shared/native-select"
import { Surface } from "@/components/shared/surface"
import { FormSectionLabel } from "@/components/ui/form-field"
import { useHandleMangaChapters } from "@/hooks/use-manga-chapters"
import { useCompletedMangaChapters, useIsMangaChapterDownloaded, useMangaChapterDownloadInfo } from "@/lib/downloads/use-manga-downloads"
import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import { useRouter } from "expo-router"
import * as React from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { MangaManualMatchModal } from "./manga-manual-match-modal"
import { MangaPaginationControls } from "./manga-pagination-controls"

const PAGE_SIZE = 30

function getChapterNumberValue(chapterNumber: string | undefined) {
    if (!chapterNumber || !/(\d+(\.\d+)?)/.test(chapterNumber)) return null
    return getChapterDecimal(chapterNumber)
}

function isChapterUnread(chapter: Pick<HibikeManga_ChapterDetails, "chapter">, progress: number) {
    const chapterValue = getChapterNumberValue(chapter.chapter)
    return chapterValue === null || chapterValue > progress
}

function getDefaultChapterPage(chapters: HibikeManga_ChapterDetails[], progress: number) {
    if (chapters.length === 0) return 0

    let candidateIndex = -1
    let candidateValue = Number.POSITIVE_INFINITY

    chapters.forEach((chapter, index) => {
        const chapterValue = getChapterNumberValue(chapter.chapter)
        if (chapterValue === null || chapterValue <= progress) return

        if (chapterValue < candidateValue) {
            candidateValue = chapterValue
            candidateIndex = index
        }
    })

    if (candidateIndex >= 0) {
        return Math.floor(candidateIndex / PAGE_SIZE)
    }

    const fallbackIndex = chapters.findIndex(chapter => isChapterUnread(chapter, progress))
    return fallbackIndex >= 0 ? Math.floor(fallbackIndex / PAGE_SIZE) : 0
}

type MangaEntryChaptersViewProps = {
    mediaId: number
    listData?: Manga_EntryListData
    mediaTitle?: string
    selectedChapterIds: Set<string>
    selectionMode: boolean
    onToggleChapter: (chapterId: string) => void
}

export function MangaEntryChaptersView({
    mediaId,
    listData,
    mediaTitle = "",
    selectedChapterIds,
    selectionMode,
    onToggleChapter,
}: MangaEntryChaptersViewProps) {
    const router = useRouter()
    const {
        selectedExtension,
        providerOptions,
        providerExtensionsLoading,
        selectedProvider,
        setSelectedProvider,
        selectedFilters,
        setSelectedLanguage,
        setSelectedScanlator,
        languageOptions,
        scanlatorOptions,
        chapterContainer,
        chapterContainerLoading,
        chapterContainerError,
    } = useHandleMangaChapters(String(mediaId))

    const { mutate: emptyCache, isPending: isEmptyingCache } = useEmptyMangaEntryCache()
    const [manualMatchOpen, setManualMatchOpen] = React.useState(false)

    const chapters = chapterContainer?.chapters ?? []
    const progress = listData?.progress ?? 0
    const [unreadOnly, setUnreadOnly] = React.useState(true)

    const unreadChapters = React.useMemo(
        () => chapters.filter(chapter => isChapterUnread(chapter, progress)),
        [chapters, progress],
    )
    const visibleChapters = React.useMemo(
        () => unreadOnly ? unreadChapters : chapters,
        [chapters, unreadChapters, unreadOnly],
    )
    const defaultPage = React.useMemo(
        () => getDefaultChapterPage(visibleChapters, progress),
        [progress, visibleChapters],
    )

    // pagination state
    const [page, setPage] = React.useState(0)
    const chaptersKey = `${selectedProvider}-${selectedFilters.language}-${selectedFilters.scanlators[0]}-${unreadOnly
        ? "unread"
        : "all"}-${visibleChapters.length}-${progress}`

    React.useEffect(() => {
        setPage(defaultPage)
    }, [chaptersKey, defaultPage])

    const totalPages = Math.max(1, Math.ceil(visibleChapters.length / PAGE_SIZE))
    const pagedChapters = visibleChapters.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

    // downloaded chapters count
    const completedChapters = useCompletedMangaChapters(mediaId, selectedProvider)
    const downloadedCount = completedChapters.length

    if (providerExtensionsLoading) {
        return <CenteredSpinner />
    }

    if (providerOptions.length === 0) {
        return (
            <LuffyError
                title="No providers"
                description="No manga provider extensions are installed. Install one from the extension manager on your Seanime server."
            />
        )
    }

    return (
        <>
            <View className="px-4 mb-5">
                <Surface variant="muted" className="p-3.5 gap-4">
                    <View className="gap-2">
                        <FormSectionLabel>Source</FormSectionLabel>
                        <NativeSelect
                            options={providerOptions.map(o => ({ id: o.value, label: o.label }))}
                            selectedId={selectedProvider ?? ""}
                            onSelect={(id) => setSelectedProvider({ mId: mediaId, provider: id })}
                            title="Select Source"
                            placeholder="Select provider"
                        />
                    </View>

                    {(scanlatorOptions.length > 0 || languageOptions.length > 0) && (
                        <View className="flex-row gap-3">
                            {scanlatorOptions.length > 0 && (
                                <View className="flex-1 gap-2">
                                    <FormSectionLabel>Scanlator</FormSectionLabel>
                                    <NativeSelect
                                        options={[{ id: "", label: "All" }, ...scanlatorOptions.map(o => ({ id: o.value, label: o.label }))]}
                                        selectedId={selectedFilters.scanlators[0] ?? ""}
                                        onSelect={(id) => setSelectedScanlator({ mId: mediaId, scanlators: id ? [id] : [] })}
                                        title="Select Scanlator"
                                        placeholder="All"
                                    />
                                </View>
                            )}

                            {languageOptions.length > 0 && (
                                <View className="flex-1 gap-2">
                                    <FormSectionLabel>Language</FormSectionLabel>
                                    <NativeSelect
                                        options={[{ id: "", label: "All" }, ...languageOptions.map(o => ({ id: o.value, label: o.label }))]}
                                        selectedId={selectedFilters.language ?? ""}
                                        onSelect={(id) => setSelectedLanguage({ mId: mediaId, language: id })}
                                        title="Select Language"
                                        placeholder="All"
                                    />
                                </View>
                            )}
                        </View>
                    )}

                    <View className="items-center gap-4">
                        <LabeledSwitch
                            label="Unread only"
                            helper="Show only chapters that you haven't read"
                            checked={unreadOnly}
                            onToggle={() => setUnreadOnly(current => !current)}
                        />

                        <View className="flex-row gap-2">
                            <Pressable
                                onPress={() => setManualMatchOpen(true)}
                                className="h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 active:bg-white/10"
                            >
                                <Ionicons name="search-outline" size={16} color="rgba(255,255,255,0.6)" />
                            </Pressable>

                            <Pressable
                                onPress={() => emptyCache({ mediaId })}
                                disabled={isEmptyingCache}
                                className="h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] border border-white/10 active:bg-white/10"
                            >
                                {isEmptyingCache ? (
                                    <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
                                ) : (
                                    <Ionicons name="refresh-outline" size={16} color="rgba(255,255,255,0.6)" />
                                )}
                            </Pressable>
                        </View>
                    </View>
                </Surface>
            </View>

            {!chapterContainerLoading && chapters.length > 0 && (
                <View className="flex-row items-center justify-between px-4 mb-3">
                    <Text className="text-sm font-medium text-foreground/70">
                        {unreadOnly
                            ? `${unreadChapters.length} unread chapter${unreadChapters.length !== 1 ? "s" : ""}`
                            : `${chapters.length} chapter${chapters.length !== 1 ? "s" : ""}`}
                    </Text>
                    {downloadedCount > 0 && (
                        <View className="flex-row items-center gap-1.5 rounded-full border border-green-400/15 bg-green-400/10 px-2.5 py-1">
                            <Ionicons name="download" size={12} color="rgba(120,200,120,0.8)" />
                            <Text className="text-xs font-medium text-green-400/80">{downloadedCount}</Text>
                        </View>
                    )}
                </View>
            )}

            {visibleChapters.length > PAGE_SIZE && (
                <View className="px-4 mb-3">
                    <MangaPaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
                </View>
            )}

            {chapterContainerLoading ? (
                <View className="py-10">
                    <CenteredSpinner />
                </View>
            ) : chapterContainerError ? (
                <View className="px-4">
                    <LuffyError
                        title="Could not load chapters"
                        description="Failed to fetch chapters from this provider. Try a different source or check your connection."
                    />
                </View>
            ) : chapters.length === 0 ? (
                <View className="px-4">
                    <LuffyError
                        title="No chapters"
                        description="No chapters found from this provider."
                    />
                </View>
            ) : visibleChapters.length === 0 ? (
                <View className="px-4">
                    <LuffyError
                        title="All caught up"
                        description="No unread chapters match the current filters. Turn off Unread only to browse the full list."
                    />
                </View>
            ) : (
                <View className="px-4">
                    <Text className="text-xl font-bold text-foreground mb-4">Chapters</Text>
                    <Surface className="overflow-hidden">
                        {pagedChapters.map((item, index) => (
                            <ChapterListItem
                                key={item.id}
                                chapter={item}
                                mediaId={mediaId}
                                provider={item.provider || selectedProvider}
                                progress={progress}
                                isLast={index === pagedChapters.length - 1}
                                showScanlator={!!selectedExtension?.settings?.supportsMultiScanlator && !selectedFilters.scanlators[0]}
                                selectionMode={selectionMode}
                                selected={selectedChapterIds.has(item.id)}
                                onToggle={() => onToggleChapter(item.id)}
                                onReadChapter={() => {
                                    const routeProvider = item.provider || selectedProvider
                                    if (!routeProvider) return

                                    router.push(formatMangaReaderHref({
                                        mediaId,
                                        provider: routeProvider,
                                        chapterId: item.id,
                                        chapterNumber: item.chapter,
                                    }))
                                }}
                            />
                        ))}
                    </Surface>
                </View>
            )}

            {visibleChapters.length > PAGE_SIZE && (
                <View className="px-4 mt-3">
                    <MangaPaginationControls page={page} totalPages={totalPages} onPageChange={setPage} />
                </View>
            )}

            <MangaManualMatchModal
                open={manualMatchOpen}
                onOpenChange={setManualMatchOpen}
                mediaId={mediaId}
                provider={selectedProvider}
                mediaTitle={mediaTitle}
            />
        </>
    )
}

////////////////////////// Chapter list item

type ChapterListItemProps = {
    chapter: HibikeManga_ChapterDetails
    mediaId: number
    provider: string | null
    progress: number
    isLast: boolean
    showScanlator: boolean
    selectionMode: boolean
    selected: boolean
    onToggle: () => void
    onReadChapter: () => void
}

function ChapterListItem({
    chapter,
    mediaId,
    provider,
    progress,
    isLast,
    showScanlator,
    selectionMode,
    selected,
    onToggle,
    onReadChapter,
}: ChapterListItemProps) {
    const isRead = !isChapterUnread(chapter, progress)
    const isDownloaded = useIsMangaChapterDownloaded(mediaId, provider, chapter.id)
    const downloadInfo = useMangaChapterDownloadInfo(mediaId, provider, chapter.id)
    const isActivelyDownloading = downloadInfo?.status === "downloading"
    const isPending = downloadInfo?.status === "pending"

    return (
        <Pressable
            onPress={selectionMode ? onToggle : onReadChapter}
            onLongPress={!selectionMode ? onToggle : undefined}
            className={cn(
                "flex-row items-center gap-3 px-4 py-3.5",
                !isLast && "border-b border-white/[0.05]",
                selectionMode && selected && "bg-brand-300/[0.08]",
            )}
        >
            {selectionMode && (
                <View className="flex-none">
                    {isDownloaded ? (
                        <Ionicons name="checkmark-circle" size={22} color="rgba(120,200,120,0.8)" />
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
            )}

            <View
                className={cn(
                    "w-12 h-8 rounded-lg items-center justify-center flex-none",
                    isRead ? "bg-brand-300/10" : "bg-white/5",
                )}
            >
                <Text
                    className={cn(
                        "text-sm font-bold",
                        isRead ? "text-brand-300/60" : "text-white",
                    )}
                    numberOfLines={1}
                >
                    {chapter.chapter}
                </Text>
            </View>

            <View className="flex-1 gap-0.5">
                <Text
                    className={cn(
                        "text-sm font-medium",
                        isRead ? "text-white/40" : "text-foreground",
                    )}
                    numberOfLines={2}
                >
                    {chapter.title || `Chapter ${chapter.chapter}`}
                </Text>
                {(showScanlator && !!chapter.scanlator) && (
                    <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                        {chapter.scanlator}
                    </Text>
                )}
            </View>

            <View className="flex-none flex-row items-center gap-1.5">
                {isDownloaded && (
                    <Ionicons name="download" size={15} color="rgba(120,200,120,0.7)" />
                )}
                {isActivelyDownloading && (
                    <View className="flex-row items-center gap-1">
                        <View className="w-4 h-4 rounded-full border-2 border-brand-300/50 border-t-brand-300" />
                        <Text className="text-xs text-brand-300/70">
                            {Math.round((downloadInfo.progress ?? 0) * 100)}%
                        </Text>
                    </View>
                )}
                {isPending && (
                    <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.3)" />
                )}
                {isRead && !selectionMode && (
                    <Ionicons name="checkmark-circle" size={18} color="rgba(157, 129, 255, 0.5)" />
                )}
                {!selectionMode && (
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.22)" />
                )}
            </View>
        </Pressable>
    )
}
