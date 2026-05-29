import { AL_BaseAnime } from "@/api/generated/types"
import { ContinueWatching } from "@/components/features/anime/continue-watching"
import { DownloadedAnimeList } from "@/components/features/anime/downloaded-anime-list"
import { HorizontalMediaCardList } from "@/components/features/media/horizontal-media-card-list"
import { MediaEntryGrid } from "@/components/features/media/media-entry-grid"
import { SafeView } from "@/components/layout/layout-view"
import { TabFadeView } from "@/components/layout/tab-fade-view"
import { CenteredSpinner } from "@/components/shared/centered-spinner"
import { LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT, LibrarySearchHeader } from "@/components/shared/library-search-header"
import { OfflineBanner } from "@/components/shared/offline-banner"
import { useAnimeLibraryCollection } from "@/hooks/use-anime-library-collection"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import { useIsServerConnected } from "@/lib/offline"
import { filterEntriesByTitle } from "@/lib/utils/filtering"
import { router, useFocusEffect } from "expo-router"
import * as React from "react"
import { FlatList, RefreshControl, View } from "react-native"

type LibraryShelfSection = {
    key: string
    title: string
    media: AL_BaseAnime[]
    sectionIndex: number
}


export default function LibraryScreen() {
    const isConnected = useIsServerConnected()
    const [searchQuery, setSearchQuery] = React.useState("")
    const deferredSearchQuery = React.useDeferredValue(searchQuery)
    const [isPullRefreshing, setIsPullRefreshing] = React.useState(false)

    useIOSScrollRefreshRateWorkaround()

    const {
        libraryCollectionList,
        continueWatchingList,
        isLoading,
        refetch,
        hasNonLocalEpisodes,
    } = useAnimeLibraryCollection()
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

    const shelfSections = React.useMemo<LibraryShelfSection[]>(() => {
        const buildMedia = (type: string) => (
            libraryCollectionList.find(item => item.type === type)?.entries?.map(entry => entry.media!).filter(Boolean) ?? []
        )

        return [
            { key: "current", title: "Currently watching", media: buildMedia("CURRENT"), sectionIndex: 0 },
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

    const renderShelfSection = React.useCallback(({ item }: { item: LibraryShelfSection }) => (
        <HorizontalMediaCardList
            title={item.title}
            type="anime"
            sectionIndex={item.sectionIndex}
            media={item.media}
            hideLibraryBadge={item.key !== "current" || !hasNonLocalEpisodes}
        />
    ), [hasNonLocalEpisodes])

    if (isLoading && isConnected) {
        return (
            <SafeView>
                <CenteredSpinner />
            </SafeView>
        )
    }

    return (
        <SafeView>
            <TabFadeView>
                <OfflineBanner />

                <View className="flex-1">
                    {isConnected && (
                        <LibrarySearchHeader
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholder="Search anime..."
                        />
                    )}

                    {isSearching ? (
                        <MediaEntryGrid
                            type="anime"
                            media={searchResults}
                            query={searchQuery}
                            onPress={(media) => router.push(`/(app)/entry/anime/${media.id}`)}
                            topPadding={isConnected ? LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT : 8}
                        />
                    ) : (
                        <FlatList
                            data={isConnected ? shelfSections : []}
                            renderItem={renderShelfSection}
                            keyExtractor={(item) => item.key}
                            ListHeaderComponent={isConnected ? <ContinueWatching items={continueWatchingList} /> : null}
                            ListFooterComponent={<DownloadedAnimeList />}
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
