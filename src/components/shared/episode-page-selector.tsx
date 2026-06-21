import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, ScrollView, Text, View } from "react-native"

export const EPISODE_PAGE_SIZE = 24

// Number of pages for an episode list, folding a small trailing page (<= 3 episodes)
// into the previous one — so a 25-episode (split-cour) season shows one "1–25" page
// instead of "1–24" + a lonely "25–25".
export function getEpisodePageCount(totalCount: number, pageSize = EPISODE_PAGE_SIZE): number {
    if (totalCount <= pageSize) return 1
    let count = Math.ceil(totalCount / pageSize)
    const remainder = totalCount % pageSize
    if (remainder > 0 && remainder <= 3) count -= 1
    return count
}

type EpisodePageSelectorProps = {
    totalCount: number
    pageSize?: number
    currentPage: number
    onPageChange: (page: number) => void
    className?: string
    // Fold a small trailing page into the previous one (must match the consumer's slicing).
    foldTail?: boolean
}

/**
 * Horizontally-scrollable page selector for paginated episode lists.
 * Renders range pills like "1–24", "25–48", etc.
 * Returns null when all episodes fit on a single page.
 */
export function EpisodePageSelector({
    totalCount,
    pageSize = EPISODE_PAGE_SIZE,
    currentPage,
    onPageChange,
    className,
    foldTail = false,
}: EpisodePageSelectorProps) {
    const pageCount = foldTail ? getEpisodePageCount(totalCount, pageSize) : Math.ceil(totalCount / pageSize)
    if (pageCount <= 1) return null

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className={cn("flex-none", className)}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 4 }}
        >
            <View className="flex-row gap-2">
                {Array.from({ length: pageCount }).map((_, i) => {
                    const start = i * pageSize + 1
                    // Last page absorbs any folded tail, so its end is the true total.
                    const end = i === pageCount - 1 ? totalCount : (i + 1) * pageSize
                    const isActive = i === currentPage

                    return (
                        <Pressable
                            key={i}
                            onPress={() => onPageChange(i)}
                            className={cn(
                                "h-8 items-center justify-center rounded-full border px-3.5",
                                isActive
                                    ? "border-brand-300/40 bg-brand-300/15 active:bg-brand-300/20"
                                    : "border-white/10 bg-white/[0.04] active:bg-white/10",
                            )}
                        >
                            <Text
                                className={cn(
                                    "text-xs font-semibold",
                                    isActive ? "text-brand-300" : "text-white/50",
                                )}
                            >
                                {start}–{end}
                            </Text>
                        </Pressable>
                    )
                })}
            </View>
        </ScrollView>
    )
}
