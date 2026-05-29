import { useGetMangaCollection, useGetMangaLatestChapterNumbersMap } from "@/api/hooks/manga.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { useStoredMangaSelectionState } from "@/hooks/use-manga-chapters"
import { getThemeSetting } from "@/lib/theme-settings"
import { CollectionParams, DEFAULT_COLLECTION_PARAMS, filterMangaCollectionEntries } from "@/lib/utils/filtering"
import React from "react"

export function useMangaLibraryCollection() {
    const serverStatus = useServerStatus()
    const { data, isLoading, isFetching, refetch } = useGetMangaCollection()
    const { data: latestChapterNumbers } = useGetMangaLatestChapterNumbersMap()
    const { storedProviders, storedFilters } = useStoredMangaSelectionState()
    const mangaLibraryDefaultSorting = getThemeSetting(serverStatus, "mangaLibraryCollectionDefaultSorting")
    const mangaLibraryDefaultParams = React.useMemo<CollectionParams>(() => ({
        ...DEFAULT_COLLECTION_PARAMS,
        sorting: mangaLibraryDefaultSorting,
    }), [mangaLibraryDefaultSorting])

    const libraryCollectionList = React.useMemo(() => {
        if (!data?.lists) return []

        const sortedLists = data.lists.map(list => ({
            ...list,
            entries: filterMangaCollectionEntries(
                list.entries,
                mangaLibraryDefaultParams,
                serverStatus?.settings?.anilist?.enableAdultContent,
                latestChapterNumbers,
                storedProviders,
                storedFilters,
            ),
        }))

        return [
            sortedLists.find(n => n.type === "CURRENT"),
            sortedLists.find(n => n.type === "PAUSED"),
            sortedLists.find(n => n.type === "PLANNING"),
            sortedLists.find(n => n.type === "COMPLETED"),
            sortedLists.find(n => n.type === "DROPPED"),
        ].filter(Boolean)
    }, [data, latestChapterNumbers, mangaLibraryDefaultParams, serverStatus?.settings?.anilist?.enableAdultContent, storedFilters, storedProviders])

    return {
        libraryCollectionList,
        isLoading,
        isFetching,
        refetch,
    }
}
