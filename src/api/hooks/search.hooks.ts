import { buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { AL_ListAnime, AL_ListManga } from "@/api/generated/types"
import { useServerUrl } from "@/atoms/server.atoms"
import { getAnimeSearchVariables, getMangaSearchVariables, SearchParams } from "@/lib/search/search-atoms"
import { useInfiniteQuery } from "@tanstack/react-query"

export function useInfiniteAnimeSearch(params: SearchParams, enabled: boolean) {
    const serverUrl = useServerUrl()

    return useInfiniteQuery({
        queryKey: ["infinite-anime-search", params, serverUrl],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            return buildSeaQuery<AL_ListAnime>({
                serverUrl,
                endpoint: API_ENDPOINTS.ANILIST.AnilistListAnime.endpoint,
                method: API_ENDPOINTS.ANILIST.AnilistListAnime.methods[0],
                data: getAnimeSearchVariables(params, pageParam as number),
            })
        },
        getNextPageParam: (lastPage) => {
            const curr = lastPage?.Page?.pageInfo?.currentPage
            const hasNext = lastPage?.Page?.pageInfo?.hasNextPage
            return curr != null && hasNext ? curr + 1 : undefined
        },
        enabled: !!serverUrl && enabled && params.type === "anime",
    })
}

export function useInfiniteMangaSearch(params: SearchParams, enabled: boolean) {
    const serverUrl = useServerUrl()

    return useInfiniteQuery({
        queryKey: ["infinite-manga-search", params, serverUrl],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            return buildSeaQuery<AL_ListManga>({
                serverUrl,
                endpoint: API_ENDPOINTS.MANGA.AnilistListManga.endpoint,
                method: API_ENDPOINTS.MANGA.AnilistListManga.methods[0],
                data: getMangaSearchVariables(params, pageParam as number),
            })
        },
        getNextPageParam: (lastPage) => {
            const curr = lastPage?.Page?.pageInfo?.currentPage
            const hasNext = lastPage?.Page?.pageInfo?.hasNextPage
            return curr != null && hasNext ? curr + 1 : undefined
        },
        enabled: !!serverUrl && enabled && params.type === "manga",
    })
}
