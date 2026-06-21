import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { AnimeEntryScreen } from "@/components/features/media/anime-entry-screen"
import { AnimeEntryScreenProvider } from "@/components/features/media/anime-entry-screen-context"
import { type AnimeEntryView } from "@/components/features/media/anime-entry-view-switcher"
import { useDebridPrewarm } from "@/components/features/torrentstream/use-debrid-prewarm"
import { SafeView } from "@/components/layout/layout-view"
import { CenteredSpinner } from "@/components/shared/centered-spinner"
import { LuffyError } from "@/components/shared/luffy-error"
import { getDownloadedEpisodesForMedia } from "@/lib/downloads/download-store"
import { useServerLocalAnimeEntry } from "@/lib/offline"
import { saveAnimeDownloadEntrySnapshot } from "@/lib/offline/download-entry-snapshot-store"
import { resolveOfflineAnimeEntry } from "@/lib/offline/offline-entry-resolver"
import { router, useLocalSearchParams } from "expo-router"
import * as React from "react"
import { Text, TouchableOpacity, View } from "react-native"

const VALID_VIEWS = new Set<AnimeEntryView>(["library", "torrentstream", "onlinestream", "info", "downloaded", "server-local"])

export default function Screen() {
    const { id, initialView } = useLocalSearchParams<{ id: string, initialView?: string }>()
    const view: AnimeEntryView =
        initialView && VALID_VIEWS.has(initialView as AnimeEntryView)
            ? (initialView as AnimeEntryView)
            : "library"

    const { data: entry, isLoading, isFetching, refetch } = useGetAnimeEntry(id)
    const serverLocalEntry = useServerLocalAnimeEntry(Number(id))
    const offlineEntry = React.useMemo(() => resolveOfflineAnimeEntry(Number(id), serverLocalEntry), [id, serverLocalEntry])
    const resolvedEntry = entry?.media ? entry : offlineEntry

    React.useEffect(() => {
        if (!entry?.media) return
        if (getDownloadedEpisodesForMedia(entry.mediaId).length === 0) return

        saveAnimeDownloadEntrySnapshot(entry)
    }, [entry])

    // Prewarm the next-up episode's debrid stream on entry mount so pressing play is instant. The
    // hook self-gates (debrid + preloadNextStream) and de-dupes; covers shows beyond the server's
    // background continue-watching prewarm (top 3). No-op offline / without debrid.
    const { prewarm: prewarmDebrid } = useDebridPrewarm()
    React.useEffect(() => {
        const next = resolvedEntry?.nextEpisode
        if (!resolvedEntry?.mediaId || !next?.aniDBEpisode) return
        prewarmDebrid({ mediaId: resolvedEntry.mediaId, episodeNumber: next.episodeNumber, aniDBEpisode: next.aniDBEpisode })
    }, [resolvedEntry?.mediaId, resolvedEntry?.nextEpisode?.episodeNumber, resolvedEntry?.nextEpisode?.aniDBEpisode, prewarmDebrid])

    if (isLoading && !resolvedEntry) {
        return (
            <SafeView>
                <CenteredSpinner />
            </SafeView>
        )
    }

    if (!resolvedEntry) {
        return (
            <SafeView>
                <LuffyError
                    title="Unavailable offline"
                    description="This anime's data isn't cached on your device."
                />
                <View className="items-center mt-4">
                    <TouchableOpacity onPress={() => router.back()} className="px-6 py-3 rounded-full bg-white/10">
                        <Text className="text-foreground font-medium">Go back</Text>
                    </TouchableOpacity>
                </View>
            </SafeView>
        )
    }

    return (
        <AnimeEntryScreenProvider
            value={{
                id: String(id),
                entry: resolvedEntry,
                isFetching,
                refetch: async () => {
                    await refetch()
                },
            }}
        >
            <AnimeEntryScreen initialView={view} />
        </AnimeEntryScreenProvider>
    )
}
