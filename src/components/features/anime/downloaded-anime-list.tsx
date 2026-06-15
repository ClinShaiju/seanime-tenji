import { DownloadedMediaShelf } from "@/components/features/media/downloaded-media-shelf"
import { LuffyError } from "@/components/shared/luffy-error"
import { useAllDownloadedAnime } from "@/lib/downloads"
import { useIsServerConnected } from "@/lib/offline"

export function DownloadedAnimeList({ showOfflineEmptyState = true }: { showOfflineEmptyState?: boolean }) {
    const downloadedAnime = useAllDownloadedAnime()
    const isConnected = useIsServerConnected()

    if (!downloadedAnime?.length && !isConnected && showOfflineEmptyState) return <LuffyError title="No downloaded anime" />

    return <DownloadedMediaShelf type="anime" items={downloadedAnime} />
}
