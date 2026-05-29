import { getReaderPageAspectRatio, loadReaderPageAspectRatio } from "@/components/features/manga/reader/manga-reader-layout"
import { MANGA_READING_MODE, type MangaReadingMode } from "@/components/features/manga/reader/manga-reader-state"
import type { MangaReaderPage } from "@/components/features/manga/reader/manga-reader-utils"
import * as React from "react"
import { Platform } from "react-native"

const ANDROID_LONG_STRIP_IMAGE_WINDOW = 5
const ANDROID_LONG_STRIP_PREMEASURE_BACKWARD_WINDOW = 32
const ANDROID_LONG_STRIP_PREMEASURE_FORWARD_WINDOW = 10
const ANDROID_LONG_STRIP_SCROLL_EVENT_THROTTLE = 32

type UseMangaReaderAndroidLongStripParams = {
    chapterKey: string
    currentPageIndex: number
    currentSpreadIndex: number
    pages: MangaReaderPage[]
    readingMode: MangaReadingMode
    savedPageIndex: number
}

export function useMangaReaderAndroidLongStrip({
    chapterKey,
    currentPageIndex,
    currentSpreadIndex,
    pages,
    readingMode,
    savedPageIndex,
}: UseMangaReaderAndroidLongStripParams) {
    const [measuredPageAspectRatios, setMeasuredPageAspectRatios] = React.useState<Record<string, number>>({})
    const [initialWarmupComplete, setInitialWarmupComplete] = React.useState(false)

    const measuredPageAspectRatiosRef = React.useRef<Record<string, number>>({})

    const isAndroidLongStrip = readingMode === MANGA_READING_MODE.LONG_STRIP && Platform.OS === "android"
    const longStripScrollEventThrottle = isAndroidLongStrip ? ANDROID_LONG_STRIP_SCROLL_EVENT_THROTTLE : 16

    const rememberPageAspectRatio = React.useCallback((uri: string, aspectRatio: number) => {
        if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return

        const currentAspectRatio = measuredPageAspectRatiosRef.current[uri]
        if (currentAspectRatio && Math.abs(currentAspectRatio - aspectRatio) < 0.001) return

        measuredPageAspectRatiosRef.current = {
            ...measuredPageAspectRatiosRef.current,
            [uri]: aspectRatio,
        }
        setMeasuredPageAspectRatios(measuredPageAspectRatiosRef.current)
    }, [])

    const shouldRenderLongStripImages = React.useCallback((spreadIndex: number) => {
        if (!isAndroidLongStrip) return true
        return Math.abs(spreadIndex - currentSpreadIndex) <= ANDROID_LONG_STRIP_IMAGE_WINDOW
    }, [currentSpreadIndex, isAndroidLongStrip])

    const getVirtualizedLongStripItemType = React.useCallback((item: number[]) => {
        const page = pages[item[0] ?? 0]
        if (!page) return "manga-page"

        const aspectRatio = getReaderPageAspectRatio(page)
        if (aspectRatio < 0.45) return "manga-page-tall"
        if (aspectRatio > 1) return "manga-page-wide"
        return "manga-page"
    }, [pages])

    React.useEffect(() => {
        measuredPageAspectRatiosRef.current = {}
        setMeasuredPageAspectRatios({})
        setInitialWarmupComplete(false)
    }, [chapterKey])

    React.useEffect(() => {
        if (!isAndroidLongStrip || pages.length === 0) return

        const startIndex = Math.max(0, currentPageIndex - ANDROID_LONG_STRIP_PREMEASURE_BACKWARD_WINDOW)
        const endIndex = Math.min(pages.length - 1, currentPageIndex + ANDROID_LONG_STRIP_PREMEASURE_FORWARD_WINDOW)
        const pagesToMeasure = pages
            .slice(startIndex, endIndex + 1)
            .filter(page => !page.width || !page.height)
            .filter(page => !measuredPageAspectRatiosRef.current[page.uri])

        if (pagesToMeasure.length === 0) return

        let cancelled = false

        const measurePages = async () => {
            const nextAspectRatios: Record<string, number> = {}

            for (const page of pagesToMeasure) {
                if (cancelled) return

                const aspectRatio = await loadReaderPageAspectRatio(page)
                if (aspectRatio !== null && Number.isFinite(aspectRatio) && aspectRatio > 0) {
                    nextAspectRatios[page.uri] = aspectRatio
                }

                if (cancelled) return

                if (Object.keys(nextAspectRatios).length >= 4) {
                    measuredPageAspectRatiosRef.current = {
                        ...measuredPageAspectRatiosRef.current,
                        ...nextAspectRatios,
                    }
                    setMeasuredPageAspectRatios(measuredPageAspectRatiosRef.current)

                    for (const uri of Object.keys(nextAspectRatios)) {
                        delete nextAspectRatios[uri]
                    }
                }
            }

            if (cancelled || Object.keys(nextAspectRatios).length === 0) return

            measuredPageAspectRatiosRef.current = {
                ...measuredPageAspectRatiosRef.current,
                ...nextAspectRatios,
            }
            setMeasuredPageAspectRatios(measuredPageAspectRatiosRef.current)
        }

        void measurePages()

        return () => {
            cancelled = true
        }
    }, [currentPageIndex, isAndroidLongStrip, pages])

    React.useEffect(() => {
        if (!isAndroidLongStrip || pages.length === 0) {
            setInitialWarmupComplete(true)
            return
        }

        const targetPageIndex = Math.min(Math.max(savedPageIndex, 0), Math.max(pages.length - 1, 0))
        const pagesToMeasure = pages
            .slice(0, targetPageIndex + 1)
            .filter(page => !page.width || !page.height)
            .filter(page => !measuredPageAspectRatiosRef.current[page.uri])

        if (pagesToMeasure.length === 0) {
            setInitialWarmupComplete(true)
            return
        }

        let cancelled = false
        setInitialWarmupComplete(false)

        const measurePages = async () => {
            const nextAspectRatios: Record<string, number> = {}

            for (const page of pagesToMeasure) {
                if (cancelled) return

                const aspectRatio = await loadReaderPageAspectRatio(page)
                if (aspectRatio) {
                    nextAspectRatios[page.uri] = aspectRatio
                }
            }

            if (cancelled) return

            if (Object.keys(nextAspectRatios).length > 0) {
                measuredPageAspectRatiosRef.current = {
                    ...measuredPageAspectRatiosRef.current,
                    ...nextAspectRatios,
                }
                setMeasuredPageAspectRatios(measuredPageAspectRatiosRef.current)
            }

            setInitialWarmupComplete(true)
        }

        void measurePages()

        return () => {
            cancelled = true
        }
    }, [isAndroidLongStrip, pages, savedPageIndex])

    return {
        getVirtualizedLongStripItemType,
        isAndroidLongStrip,
        longStripScrollEventThrottle,
        measuredPageAspectRatios,
        rememberPageAspectRatio,
        shouldRenderLongStripImages,
        androidLongStripInitialWarmupComplete: initialWarmupComplete,
    }
}
