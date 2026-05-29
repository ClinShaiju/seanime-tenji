import type { MangaReaderPage } from "@/components/features/manga/reader/manga-reader-utils"
import { Image } from "expo-image"

export const DEFAULT_READER_PAGE_ASPECT_RATIO = 0.7

export function getReaderPageAspectRatio(page: MangaReaderPage): number {
    if (page.width && page.height) {
        return page.width / page.height
    }

    // this keeps the first paint stable when a source skips page dimensions
    return DEFAULT_READER_PAGE_ASPECT_RATIO
}

export function getReaderImageSize({
    aspectRatio,
    screenWidth,
    screenHeight,
    mode,
}: {
    aspectRatio: number
    screenWidth: number
    screenHeight: number
    mode?: "vertical" | "horizontal"
}) {
    const boundedWidth = Math.max(1, screenWidth)
    const boundedHeight = Math.max(1, screenHeight)
    const boundedAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : DEFAULT_READER_PAGE_ASPECT_RATIO

    // long strip pages grow vertically
    if (mode === "vertical") {
        return {
            width: boundedWidth,
            height: boundedWidth / boundedAspectRatio,
        }
    }

    // bound page modes so swiping feels isn't jumpy
    const widthLimitedHeight = boundedWidth / boundedAspectRatio

    if (widthLimitedHeight <= boundedHeight) {
        return {
            width: boundedWidth,
            height: widthLimitedHeight,
        }
    }

    return {
        width: boundedHeight * boundedAspectRatio,
        height: boundedHeight,
    }
}

export async function loadReaderPageAspectRatio(page: MangaReaderPage): Promise<number | null> {
    if (page.width && page.height) {
        return page.width / page.height
    }

    try {
        // small decode is enough because we only need the shape for layout
        const image = await Image.loadAsync(page.uri, { maxWidth: 64 })
        const aspectRatio = image.width / image.height
        return Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : null
    }
    catch {
        return null
    }
}
