import { Anime_Episode } from "@/api/generated/types"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetContinuityWatchHistory } from "@/api/hooks/continuity.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { getThemeSetting } from "@/lib/theme-settings"
import { CollectionParams, DEFAULT_COLLECTION_PARAMS, filterAnimeCollectionEntries, sortContinueWatchingEpisodes } from "@/lib/utils/filtering"
import { atomWithImmer } from "jotai-immer"
import { useAtom } from "jotai/react"
import React from "react"

export type ContinueWatchingItem = {
    episode: Anime_Episode
    sourceView: "library" | "torrentstream" | "onlinestream"
}

export const MAIN_LIBRARY_DEFAULT_PARAMS: CollectionParams = {
    ...DEFAULT_COLLECTION_PARAMS,
    sorting: "TITLE",
}

export const __mainLibrary_paramsAtom = atomWithImmer<CollectionParams>(MAIN_LIBRARY_DEFAULT_PARAMS)

export const __mainLibrary_paramsInputAtom = atomWithImmer<CollectionParams>(MAIN_LIBRARY_DEFAULT_PARAMS)

export function useAnimeLibraryCollection() {
    const serverStatus = useServerStatus()
    const { data, isLoading, isFetching, refetch } = useGetLibraryCollection()
    const { data: watchHistory } = useGetContinuityWatchHistory()
    const animeLibraryDefaultSorting = getThemeSetting(serverStatus, "animeLibraryCollectionDefaultSorting")
    const continueWatchingDefaultSorting = getThemeSetting(serverStatus, "continueWatchingDefaultSorting")
    const mainLibraryDefaultParams = React.useMemo<CollectionParams>(() => ({
        ...DEFAULT_COLLECTION_PARAMS,
        sorting: animeLibraryDefaultSorting,
    }), [animeLibraryDefaultSorting])
    const libraryGenres = React.useMemo(() => {
        const allGenres = data?.lists?.flatMap(l => {
            return l.entries?.flatMap(e => e.media?.genres) ?? []
        })
        return [...new Set(allGenres)].filter(Boolean)?.sort((a, b) => a.localeCompare(b))
    }, [data])

    const [params, setParams] = useAtom(__mainLibrary_paramsAtom)

    React.useEffect(() => {
        if (!!data) {
            setParams(mainLibraryDefaultParams)
        }
    }, [data, mainLibraryDefaultParams, setParams])

    const sortedCollection = React.useMemo(() => {
        if (!data || !data.lists) return []

        if (data.stream) {
            const currentList = data.lists.find(n => n.type === "CURRENT")
            if (currentList) {
                const entries = [...(currentList.entries ?? [])]
                for (const anime of (data.stream.anime ?? [])) {
                    if (!entries.some(e => e.mediaId === anime.id)) {
                        entries.push({
                            media: anime,
                            mediaId: anime.id,
                            listData: data.stream.listData?.[anime.id],
                        })
                    }
                }
                currentList.entries = entries
            }
        }

        const lists = data.lists.map(obj => {
            if (!obj) return obj
            const entries = filterAnimeCollectionEntries(
                obj.entries,
                mainLibraryDefaultParams,
                serverStatus?.settings?.anilist?.enableAdultContent,
                data.continueWatchingList,
                watchHistory,
            )

            return {
                type: obj.type,
                status: obj.status,
                entries,
            }
        })

        return [
            lists.find(n => n.type === "CURRENT"),
            lists.find(n => n.type === "PAUSED"),
            lists.find(n => n.type === "PLANNING"),
            lists.find(n => n.type === "COMPLETED"),
            lists.find(n => n.type === "DROPPED"),
        ].filter(Boolean)
    }, [data, mainLibraryDefaultParams, serverStatus?.settings?.anilist?.enableAdultContent, watchHistory])

    const filteredCollection = React.useMemo(() => {
        if (!data || !data.lists) return []

        const lists = data.lists.map(obj => {
            if (!obj) return obj
            const entries = filterAnimeCollectionEntries(
                obj.entries,
                params,
                serverStatus?.settings?.anilist?.enableAdultContent,
                data.continueWatchingList,
                watchHistory,
            )

            return {
                type: obj.type,
                status: obj.status,
                entries,
            }
        })

        return [
            lists.find(n => n.type === "CURRENT"),
            lists.find(n => n.type === "PAUSED"),
            lists.find(n => n.type === "PLANNING"),
            lists.find(n => n.type === "COMPLETED"),
            lists.find(n => n.type === "DROPPED"),
        ].filter(Boolean)
    }, [data, params, serverStatus?.settings?.anilist?.enableAdultContent, watchHistory])

    const continueWatchingList = React.useMemo(() => {
        const fallbackStreamView: ContinueWatchingItem["sourceView"] =
            serverStatus?.torrentstreamSettings?.includeInLibrary
                ? "torrentstream"
                : serverStatus?.settings?.library?.enableOnlinestream
                    ? "onlinestream"
                    : "library"

        const deduped = new Map<number, ContinueWatchingItem>()

        const registerEpisode = (
            episode: Anime_Episode | null | undefined,
            sourceView: ContinueWatchingItem["sourceView"],
        ) => {
            const mediaId = episode?.baseAnime?.id
            if (!episode || !mediaId) return

            const item: ContinueWatchingItem = {
                episode,
                sourceView: episode.localFile?.path ? "library" : sourceView,
            }

            const existing = deduped.get(mediaId)
            if (!existing || (existing.sourceView !== "library" && item.sourceView === "library")) {
                deduped.set(mediaId, item)
            }
        }

        for (const episode of data?.continueWatchingList ?? []) {
            registerEpisode(episode, fallbackStreamView)
        }

        for (const episode of data?.stream?.continueWatchingList ?? []) {
            registerEpisode(episode, "torrentstream")
        }

        const list = Array.from(deduped.values())
        const libraryEntries = data?.lists?.flatMap(item => item.entries ?? []) ?? []
        const sortedEpisodes = sortContinueWatchingEpisodes(
            list.map(item => item.episode),
            continueWatchingDefaultSorting,
            libraryEntries,
            watchHistory,
        )
        const orderByMediaId = new Map<number, number>()

        sortedEpisodes.forEach((episode, index) => {
            const mediaId = episode.baseAnime?.id
            if (mediaId) orderByMediaId.set(mediaId, index)
        })

        list.sort((left, right) => {
            const leftOrder = left.episode.baseAnime?.id ? orderByMediaId.get(left.episode.baseAnime.id) ?? 0 : 0
            const rightOrder = right.episode.baseAnime?.id ? orderByMediaId.get(right.episode.baseAnime.id) ?? 0 : 0

            return leftOrder - rightOrder
        })

        if (!serverStatus?.settings?.anilist?.enableAdultContent) {
            return list.filter(item => item.episode.baseAnime?.isAdult === false)
        }

        return list
    }, [
        data?.continueWatchingList,
        data?.lists,
        data?.stream?.continueWatchingList,
        continueWatchingDefaultSorting,
        serverStatus?.settings?.anilist?.blurAdultContent,
        serverStatus?.settings?.anilist?.enableAdultContent,
        serverStatus?.settings?.library?.enableOnlinestream,
        serverStatus?.torrentstreamSettings?.includeInLibrary,
        watchHistory,
    ])

    return {
        libraryGenres,
        isLoading,
        isFetching,
        refetch,
        libraryCollectionList: sortedCollection,
        filteredLibraryCollectionList: filteredCollection,
        continueWatchingList,
        hasNonLocalEpisodes: continueWatchingList.some(item => !item.episode.localFile),
        unmatchedLocalFiles: data?.unmatchedLocalFiles ?? [],
        ignoredLocalFiles: data?.ignoredLocalFiles ?? [],
        unmatchedGroups: data?.unmatchedGroups ?? [],
        unknownGroups: data?.unknownGroups ?? [],
    }
}
