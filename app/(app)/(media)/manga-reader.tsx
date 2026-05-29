import { MangaReaderScreen } from "@/components/features/manga/reader/manga-reader-screen"
import { useLocalSearchParams } from "expo-router"

export default function Screen() {
    const params = useLocalSearchParams<{
        mediaId?: string
        provider?: string
        chapterId?: string
        chapterNumber?: string
    }>()

    const mediaId = Number(params.mediaId)

    if (!mediaId || !params.provider || !params.chapterId) {
        return null
    }

    return (
        <MangaReaderScreen
            mediaId={mediaId}
            provider={params.provider}
            chapterId={params.chapterId}
            chapterNumber={params.chapterNumber}
        />
    )
}