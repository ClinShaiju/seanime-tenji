import { AL_BaseManga } from "@/api/generated/types"
import { DownloadedMangaList } from "@/components/features/manga/downloaded-manga-list"
import { HorizontalMediaCardList } from "@/components/features/media/horizontal-media-card-list"
import { MediaEntryGrid } from "@/components/features/media/media-entry-grid"
import { SafeView } from "@/components/layout/layout-view"
import { TabFadeView } from "@/components/layout/tab-fade-view"
import { CenteredSpinner } from "@/components/shared/centered-spinner"
import { LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT, LibrarySearchHeader } from "@/components/shared/library-search-header"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import { useMangaLibraryCollection } from "@/hooks/use-manga-library-collection"
import { useIsServerConnected } from "@/lib/offline"
import { filterEntriesByTitle } from "@/lib/utils/filtering"
import { router, useFocusEffect } from "expo-router"
import * as React from "react"
import { FlatList, RefreshControl, View } from "react-native"

type MangaShelfSection = {
    key: string
    title: string
    media: AL_BaseManga[]
    sectionIndex: number
}


export default function MangaLibraryScreen() {
    const isConnected = useIsServerConnected()
    const [searchQuery, setSearchQuery] = React.useState("")
    const deferredSearchQuery = React.useDeferredValue(searchQuery)
    const [isPullRefreshing, setIsPullRefreshing] = React.useState(false)

    useIOSScrollRefreshRateWorkaround()

    const {
        libraryCollectionList,
        isLoading,
        refetch,
    } = useMangaLibraryCollection()
    const refetchRef = React.useRef(refetch)

    React.useEffect(() => {
        refetchRef.current = refetch
    }, [refetch])

    const allEntries = React.useMemo(
        () => libraryCollectionList.flatMap(list => list?.entries ?? []),
        [libraryCollectionList],
    )

    const searchResults = React.useMemo(() => {
        if (!deferredSearchQuery.trim()) return []
        return filterEntriesByTitle(allEntries, deferredSearchQuery)
            .map(e => e.media!)
            .filter(Boolean)
    }, [allEntries, deferredSearchQuery])

    const isSearching = searchQuery.trim().length > 0

    const shelfSections = React.useMemo<MangaShelfSection[]>(() => {
        const buildMedia = (type: string) => (
            libraryCollectionList.find(item => item.type === type)?.entries?.map(entry => entry.media!).filter(Boolean) ?? []
        )

        return [
            { key: "current", title: "Currently reading", media: buildMedia("CURRENT"), sectionIndex: 0 },
            { key: "paused", title: "Paused", media: buildMedia("PAUSED"), sectionIndex: 1 },
            { key: "planning", title: "Planning", media: buildMedia("PLANNING"), sectionIndex: 2 },
            { key: "completed", title: "Completed", media: buildMedia("COMPLETED"), sectionIndex: 3 },
            { key: "dropped", title: "Dropped", media: buildMedia("DROPPED"), sectionIndex: 4 },
        ].filter(section => section.media.length > 0)
    }, [libraryCollectionList])

    useFocusEffect(
        React.useCallback(() => {
            if (!isConnected) return
            void refetchRef.current()
        }, [isConnected]),
    )

    const handleRefresh = React.useCallback(() => {
        setIsPullRefreshing(true)
        void refetch().finally(() => {
            setIsPullRefreshing(false)
        })
    }, [refetch])

    const refreshControl = isConnected ? (
        <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handleRefresh}
            tintColor="rgba(255,255,255,0.45)"
        />
    ) : undefined

    if (isLoading && isConnected) {
        return (
            <SafeView>
                <CenteredSpinner />
            </SafeView>
        )
    }

    const renderShelfSection = React.useCallback(({ item }: { item: MangaShelfSection }) => (
        <HorizontalMediaCardList
            title={item.title}
            type="manga"
            sectionIndex={item.sectionIndex}
            media={item.media}
            onMediaPress={(media) => router.push(`/(app)/entry/manga/${media.id}`)}
        />
    ), [])

    return (
        <SafeView>
            <TabFadeView>
                <OfflineBanner />

                <View className="flex-1">
                    {isConnected && (
                        <LibrarySearchHeader
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search manga..."
                        />
                    )}

                    {isSearching ? (
                        <MediaEntryGrid
                            type="manga"
                            media={searchResults}
                            query={searchQuery}
                            onPress={(media) => router.push(`/(app)/entry/manga/${media.id}`)}
                            topPadding={isConnected ? LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT : 8}
                        />
                    ) : (
                        <FlatList
                            data={isConnected ? shelfSections : []}
                            renderItem={renderShelfSection}
                            keyExtractor={(item) => item.key}
                            ListFooterComponent={<DownloadedMangaList />}
                            contentInsetAdjustmentBehavior="automatic"
                            contentContainerStyle={{
                                paddingTop: isConnected ? LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT : 0,
                                paddingBottom: 80,
                            }}
                            showsVerticalScrollIndicator={false}
                            refreshControl={refreshControl}
                            initialNumToRender={2}
                            maxToRenderPerBatch={2}
                            updateCellsBatchingPeriod={16}
                            windowSize={5}
                            removeClippedSubviews
                        />
                    )}
                </View>
            </TabFadeView>
        </SafeView>
    )
}
