import {
    AL_AnimeCollection,
    AL_MangaCollection,
    Anime_EntryLibraryData,
    Anime_EntryListData,
    Anime_NakamaEntryLibraryData,
    Manga_EntryListData,
} from "@/api/generated/types"
import { atom } from "jotai"
import { useAtom, useAtomValue } from "jotai/react"
import React from "react"

const __anilist_animeCollectionAtom = atom<AL_AnimeCollection | null>(null)
const __anilist_mangaCollectionAtom = atom<AL_MangaCollection | null>(null)

const __anime_entryListDataAtom = atom<Record<string, Anime_EntryListData>>()
const __manga_entryListDataAtom = atom<Record<string, Manga_EntryListData>>()

export type AnimeLibraryEntryData = {
    libraryData?: Anime_EntryLibraryData
    nakamaLibraryData?: Anime_NakamaEntryLibraryData
}

const __anime_libraryEntryDataAtom = atom<Record<string, AnimeLibraryEntryData>>()

export function useAnilistAnimeCollectionAtom() {
    const [animeCollection, setAnimeCollection] = useAtom(__anilist_animeCollectionAtom)

    return {
        animeCollection,
        setAnimeCollection,
    }
}

export function useAnilistAnimeEntryListDataAtom() {
    const [animeEntryListData, setAnimeEntryListData] = useAtom(__anime_entryListDataAtom)

    return {
        animeEntryListData,
        setAnimeEntryListData,
    }
}

export function useAnilistMangaEntryListDataAtom() {
    const [mangaEntryListData, setMangaEntryListData] = useAtom(__manga_entryListDataAtom)

    return {
        mangaEntryListData,
        setMangaEntryListData,
    }
}

export function useAnimeLibraryEntryDataAtom() {
    const [animeLibraryEntryData, setAnimeLibraryEntryData] = useAtom(__anime_libraryEntryDataAtom)

    return {
        animeLibraryEntryData,
        setAnimeLibraryEntryData,
    }
}

export function useAnilistMangaCollectionAtom() {
    const [mangaCollection, setMangaCollection] = useAtom(__anilist_mangaCollectionAtom)

    return {
        mangaCollection,
        setMangaCollection,
    }
}

export function useMediaEntryListDataValue(type: "anime" | "manga", mediaId: number | string) {
    const mediaKey = String(mediaId)
    const entryAtom = React.useMemo(() => atom((get) => {
        if (type === "anime") {
            return get(__anime_entryListDataAtom)?.[mediaKey]
        }

        return get(__manga_entryListDataAtom)?.[mediaKey]
    }), [mediaKey, type])

    return useAtomValue(entryAtom)
}

export function useAnimeLibraryEntryDataValue(mediaId: number | string) {
    const mediaKey = String(mediaId)
    const entryAtom = React.useMemo(() => atom((get) => get(__anime_libraryEntryDataAtom)?.[mediaKey]),
        [mediaKey])

    return useAtomValue(entryAtom)
}
