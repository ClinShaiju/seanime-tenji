import { appendServerHMACToken } from "@/api/client/server-auth"
import { getServerBaseUrl } from "@/api/client/server-url"
import type { HibikeManga_ChapterDetails, Manga_PageContainer } from "@/api/generated/types"
import { MANGA_READING_MODE, type MangaReaderSettings } from "@/components/features/manga/reader/manga-reader-state"
import type { DownloadedMangaChapter } from "@/lib/downloads"
import type { Href } from "expo-router"

type PageContainerPage = NonNullable<Manga_PageContainer["pages"]>[number]

export type MangaReaderRouteParams = {
    mediaId: number | string
    provider: string
    chapterId: string
    chapterNumber?: string
}

export type MangaReaderPage = {
    index: number
    uri: string
    width?: number
    height?: number
}

export type MangaReaderChapterRef = {
    mediaId: number
    provider: string
    chapterId: string
    chapterNumber: string
    title?: string
    scanlator?: string
    downloaded?: boolean
}

export function formatMangaReaderHref(params: MangaReaderRouteParams): Href {
    return {
        pathname: "/(app)/(media)/manga-reader",
        params: {
            mediaId: String(params.mediaId),
            provider: params.provider,
            chapterId: params.chapterId,
            chapterNumber: params.chapterNumber,
        },
    }
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value))
}

export function getChapterDecimal(chapter: string | undefined): number {
    if (!chapter) return 0

    const match = chapter.match(/(\d+(\.\d+)?)/)?.[0]
    return match ? Number.parseFloat(match) : 0
}

export function getChapterProgressNumber(chapter: string | undefined): number {
    return Math.floor(getChapterDecimal(chapter))
}

export function formatPageLabel(pageIndexes: number[], totalPages: number): string {
    if (pageIndexes.length === 0) return `Page 0 / ${totalPages}`
    if (pageIndexes.length === 1) return `Page ${pageIndexes[0] + 1} / ${totalPages}`
    return `Pages ${pageIndexes[0] + 1}-${pageIndexes[pageIndexes.length - 1] + 1} / ${totalPages}`
}

export function getMangaPageUrl(
    serverUrl: string | null | undefined,
    page: Pick<PageContainerPage, "url" | "headers">,
    isDownloaded?: boolean,
): string {
    const baseUrl = getServerBaseUrl(serverUrl)

    if (page.url.startsWith("{{manga-local-assets}}")) {
        const assetPath = encodeURIComponent(page.url)
        return appendServerHMACToken(
            `${baseUrl}/api/v1/manga/local-page/${assetPath}`,
            "/api/v1/manga/local-page",
        )
    }

    if (!isDownloaded && page.headers && Object.keys(page.headers).length > 0) {
        return appendServerHMACToken(
            `${baseUrl}/api/v1/image-proxy?url=${encodeURIComponent(page.url)}&headers=${encodeURIComponent(JSON.stringify(page.headers))}`,
            "/api/v1/image-proxy",
        )
    }

    return page.url
}

export function buildReaderPages(
    serverUrl: string | null | undefined,
    pageContainer: Manga_PageContainer | undefined,
    localPages: string[],
    localPageDimensions?: Record<number, { width: number; height: number }>,
): MangaReaderPage[] {
    if (localPages.length > 0) {
        return localPages.map((uri, index) => ({
            index,
            uri,
            // keep server dimensions
            width: pageContainer?.pageDimensions?.[index]?.width ?? localPageDimensions?.[index]?.width,
            height: pageContainer?.pageDimensions?.[index]?.height ?? localPageDimensions?.[index]?.height,
        }))
    }

    return (pageContainer?.pages ?? []).map(page => ({
        index: page.index,
        uri: getMangaPageUrl(serverUrl, page, pageContainer?.isDownloaded),
        width: pageContainer?.pageDimensions?.[page.index]?.width,
        height: pageContainer?.pageDimensions?.[page.index]?.height,
    }))
}

export function buildReaderSpreads(
    pages: MangaReaderPage[],
    settings: MangaReaderSettings,
): number[][] {
    if (pages.length === 0) return []

    if (settings.readingMode !== MANGA_READING_MODE.DOUBLE_PAGE) {
        return pages.map(page => [page.index])
    }

    const pageDimensions = Object.fromEntries(
        pages
            .filter(page => !!page.width && !!page.height)
            .map(page => [page.index, { width: page.width!, height: page.height! }]),
    )

    const widths = Object.values(pageDimensions).map(dimension => dimension.width)

    const recurringWidth = getRecurringNumber(widths)
    const fullSpreadThreshold = recurringWidth > 0 ? recurringWidth + 50 : 2000

    const spreads: number[][] = []
    let pageIndex = 0

    while (pageIndex < pages.length) {
        const currentPage = pages[pageIndex]
        const currentWidth = pageDimensions[currentPage.index]?.width ?? 0

        if (settings.doublePageOffset > 0 && pageIndex < settings.doublePageOffset) {
            spreads.push([currentPage.index])
            pageIndex += 1
            continue
        }

        const nextPage = pages[pageIndex + 1]
        const nextWidth = nextPage ? (pageDimensions[nextPage.index]?.width ?? 0) : 0
        const isFullSpread = currentWidth > fullSpreadThreshold
        const nextIsFullSpread = nextWidth > fullSpreadThreshold

        if (isFullSpread || !nextPage || nextIsFullSpread) {
            spreads.push([currentPage.index])
            pageIndex += 1
            continue
        }

        spreads.push([currentPage.index, nextPage.index])
        pageIndex += 2
    }

    return spreads
}

export function getSpreadIndexForPage(spreads: number[][], pageIndex: number): number {
    if (spreads.length === 0) return 0

    const lastPageIndex = spreads[spreads.length - 1]?.[spreads[spreads.length - 1].length - 1] ?? 0
    const clampedPageIndex = clamp(pageIndex, 0, lastPageIndex)

    const foundIndex = spreads.findIndex(spread => spread.includes(clampedPageIndex))
    return foundIndex >= 0 ? foundIndex : 0
}

export function getCurrentSpreadPages(spreads: number[][], spreadIndex: number): number[] {
    return spreads[spreadIndex] ?? spreads[0] ?? []
}

export function getPreferredStartChapter(
    mediaId: number,
    progress: number,
    onlineChapters: HibikeManga_ChapterDetails[],
    downloadedChapters: DownloadedMangaChapter[],
): MangaReaderChapterRef | undefined {
    const candidates = dedupeByChapterNumber([
        ...onlineChapters.map(chapter => ({
            mediaId,
            provider: chapter.provider,
            chapterId: chapter.id,
            chapterNumber: chapter.chapter,
            title: chapter.title,
            scanlator: chapter.scanlator,
            downloaded: false,
        })),
        ...downloadedChapters
            .filter(chapter => chapter.status === "completed")
            .map(chapter => ({
                mediaId,
                provider: chapter.provider,
                chapterId: chapter.chapterId,
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                scanlator: chapter.scanlator,
                downloaded: true,
            })),
    ])

    if (candidates.length === 0) return undefined

    const sorted = [...candidates].sort((left, right) => getChapterDecimal(left.chapterNumber) - getChapterDecimal(right.chapterNumber))
    const nextUnread = sorted?.find(chapter => getChapterDecimal(chapter.chapterNumber) > progress)

    return nextUnread ?? sorted?.[0]
}

export function getAdjacentChapters(
    currentChapter: MangaReaderChapterRef,
    onlineChapters: HibikeManga_ChapterDetails[],
    downloadedChapters: DownloadedMangaChapter[],
): {
    previousChapter?: MangaReaderChapterRef
    nextChapter?: MangaReaderChapterRef
} {
    const groupedCandidates = groupByChapterNumber([
        ...onlineChapters.map(chapter => ({
            mediaId: currentChapter.mediaId,
            provider: chapter.provider,
            chapterId: chapter.id,
            chapterNumber: chapter.chapter,
            title: chapter.title,
            scanlator: chapter.scanlator,
            downloaded: false,
        })),
        ...downloadedChapters
            .filter(chapter => chapter.status === "completed")
            .map(chapter => ({
                mediaId: currentChapter.mediaId,
                provider: chapter.provider,
                chapterId: chapter.chapterId,
                chapterNumber: chapter.chapterNumber,
                title: chapter.title,
                scanlator: chapter.scanlator,
                downloaded: true,
            })),
    ])

    const currentDecimal = getChapterDecimal(currentChapter.chapterNumber)

    const previousCandidates = groupedCandidates.filter(group => group.decimal < currentDecimal)
    const nextCandidates = groupedCandidates.filter(group => group.decimal > currentDecimal)

    return {
        previousChapter: pickClosestChapter(previousCandidates, currentChapter.provider, "previous"),
        nextChapter: pickClosestChapter(nextCandidates, currentChapter.provider, "next"),
    }
}

function pickClosestChapter(
    candidates: Array<{ decimal: number; candidates: MangaReaderChapterRef[] }>,
    preferredProvider: string,
    direction: "previous" | "next",
): MangaReaderChapterRef | undefined {
    if (candidates.length === 0) return undefined

    const sorted = [...candidates].sort((left, right) => left.decimal - right.decimal)

    const closestGroup = direction === "previous"
        ? sorted[sorted.length - 1]
        : sorted[0]

    return closestGroup
        ? getPreferredChapterCandidate(closestGroup.candidates, preferredProvider)
        : undefined
}

function dedupeByChapterNumber(chapters: MangaReaderChapterRef[], preferredProvider?: string): MangaReaderChapterRef[] {
    return groupByChapterNumber(chapters).map(group => getPreferredChapterCandidate(group.candidates, preferredProvider))
}

function groupByChapterNumber(chapters: MangaReaderChapterRef[]): Array<{ decimal: number; candidates: MangaReaderChapterRef[] }> {
    const chapterMap = new Map<string, { decimal: number; candidates: MangaReaderChapterRef[] }>()

    for (const chapter of chapters) {
        const decimal = getChapterDecimal(chapter.chapterNumber)
        const key = Number.isFinite(decimal) ? decimal.toFixed(4) : chapter.chapterId

        const existing = chapterMap.get(key)
        if (existing) {
            existing.candidates.push(chapter)
        } else {
            chapterMap.set(key, {
                decimal,
                candidates: [chapter],
            })
        }
    }

    return Array.from(chapterMap.values())
}

function getPreferredChapterCandidate(
    candidates: MangaReaderChapterRef[],
    preferredProvider?: string,
): MangaReaderChapterRef {
    const ranked = [...candidates].sort((left, right) => getChapterCandidateScore(right, preferredProvider) - getChapterCandidateScore(left,
        preferredProvider))
    return ranked[0] ?? candidates[0]
}

function getChapterCandidateScore(chapter: MangaReaderChapterRef, preferredProvider?: string): number {
    let score = chapter.downloaded ? 2 : 0

    if (preferredProvider && chapter.provider === preferredProvider) {
        score += 4
    }

    return score
}

function getRecurringNumber(numbers: number[]): number {
    if (numbers.length === 0) return 0

    const counts = new Map<number, number>()

    for (const number of numbers) {
        counts.set(number, (counts.get(number) ?? 0) + 1)
    }

    let maxCount = 0
    let recurringNumber = 0

    for (const [number, count] of counts.entries()) {
        if (count > maxCount) {
            maxCount = count
            recurringNumber = number
        }
    }

    return recurringNumber
}
