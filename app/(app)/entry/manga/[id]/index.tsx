import { MangaEntryScreen } from "@/components/features/manga/manga-entry-screen"
import { type MangaEntryView } from "@/components/features/manga/manga-entry-view-switcher"
import { useLocalSearchParams } from "expo-router"

const VALID_VIEWS = new Set<MangaEntryView>(["chapters", "info", "downloaded"])

export default function Screen() {
    const { initialView } = useLocalSearchParams<{ initialView?: string }>()
    const view: MangaEntryView =
        initialView && VALID_VIEWS.has(initialView as MangaEntryView)
            ? (initialView as MangaEntryView)
            : "chapters"
    return <MangaEntryScreen initialView={view} />
}
