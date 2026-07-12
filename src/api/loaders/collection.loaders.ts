import { Anime_EntryListData, Manga_EntryListData } from "@/api/generated/types"
import { useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useGetRawAnilistMangaCollection } from "@/api/hooks/manga.hooks"
import {
    AnimeLibraryEntryData,
    useAnilistAnimeCollectionAtom,
    useAnilistAnimeEntryListDataAtom,
    useAnilistMangaCollectionAtom,
    useAnilistMangaEntryListDataAtom,
    useAnimeLibraryEntryDataAtom,
} from "@/atoms/anilist-collection.atoms"
import React from "react"

export function useAnilistCollectionLoader() {

    const { data: _animeCollection } = useGetAnimeCollection()
    const { data: _animeLibraryCollection } = useGetLibraryCollection()
    const { data: _mangaCollection } = useGetRawAnilistMangaCollection()

    const { setAnimeCollection } = useAnilistAnimeCollectionAtom()
    const { setAnimeEntryListData } = useAnilistAnimeEntryListDataAtom()
    React.useEffect(() => {
        if (_animeCollection) {
            setAnimeCollection(_animeCollection)
            // const allMedia = _animeCollection.MediaListCollection?.lists?.flatMap(n => n?.entries)?.filter(Boolean)?.map(n =>
            // n.media)?.filter(Boolean) ?? []

            const listData = _animeCollection.MediaListCollection?.lists?.flatMap(n => n?.entries)?.filter(Boolean)?.reduce((acc, n) => {
                const mediaId = n.media?.id
                if (!mediaId) return acc
                acc[String(mediaId)] = {
                    status: n.status,
                    progress: n.progress || 0,
                    score: n.score || 0,
                    startedAt: n.startedAt ? new Date(n.startedAt.year || 0,
                        (n.startedAt.month || 1) - 1,
                        n.startedAt.day || 1).toISOString() : undefined,
                    completedAt: n.completedAt ? new Date(n.completedAt.year || 0,
                        (n.completedAt.month || 1) - 1,
                        n.completedAt.day || 1).toISOString() : undefined,
                }
                return acc
            }, {} as Record<string, Anime_EntryListData>)
            setAnimeEntryListData(listData || {})
        }
    }, [_animeCollection])

    const { setAnimeLibraryEntryData } = useAnimeLibraryEntryDataAtom()
    React.useEffect(() => {
        if (_animeLibraryCollection) {
            const entryData = _animeLibraryCollection.lists?.flatMap(n => n?.entries)?.filter(Boolean)?.reduce((acc, n) => {
                acc[String(n.mediaId)] = {
                    libraryData: n.libraryData,
                    nakamaLibraryData: n.nakamaLibraryData,
                }
                return acc
            }, {} as Record<string, AnimeLibraryEntryData>)

            setAnimeLibraryEntryData(entryData || {})
        }
    }, [_animeLibraryCollection])

    const { setMangaCollection } = useAnilistMangaCollectionAtom()
    const { setMangaEntryListData } = useAnilistMangaEntryListDataAtom()
    React.useEffect(() => {
        if (_mangaCollection) {
            setMangaCollection(_mangaCollection)

            const listData = _mangaCollection.MediaListCollection?.lists?.flatMap(n => n?.entries)?.filter(Boolean)?.reduce((acc, n) => {
                const mediaId = n.media?.id
                if (!mediaId) return acc
                acc[String(mediaId)] = {
                    status: n.status,
                    progress: n.progress || 0,
                    score: n.score || 0,
                    startedAt: n.startedAt ? new Date(n.startedAt.year || 0,
                        (n.startedAt.month || 1) - 1,
                        n.startedAt.day || 1).toISOString() : undefined,
                    completedAt: n.completedAt ? new Date(n.completedAt.year || 0,
                        (n.completedAt.month || 1) - 1,
                        n.completedAt.day || 1).toISOString() : undefined,
                }
                return acc
            }, {} as Record<string, Manga_EntryListData>)

            setMangaEntryListData(listData || {})
        }
    }, [_mangaCollection])

}
