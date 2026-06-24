import { Anime_GroupedEntry } from "@/api/generated/types"
import { useGetAnimeFranchise } from "@/api/hooks/anime_franchise.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { __entry_mergedSeasonAtom } from "@/components/features/media/merged-season-section"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { ChevronDown } from "@/lib/icons/ChevronDown"
import { cn } from "@/lib/utils"
import { router } from "expo-router"
import { useAtom } from "jotai/react"
import React from "react"
import { Pressable, Text, View } from "react-native"

// Stremio-style season switcher for the entry screen. Split-cour seasons (multiple
// AniList entries sharing a TMDB season number) collapse into one "Season N" item that
// opens a merged continuous list; single-cour seasons navigate to their entry. Rendered
// only when "Group seasons" is enabled and the franchise has more than one part.

function entryTitle(e: Anime_GroupedEntry): string {
    return e.media?.title?.userPreferred || e.media?.title?.romaji || e.media?.title?.english || `#${e.mediaId}`
}

export function SeasonSwitcher({ mediaId }: { mediaId: number }) {
    const serverStatus = useServerStatus()
    const groupSeasons = !!serverStatus?.themeSettings?.groupSeasons
    const { data: franchise } = useGetAnimeFranchise(mediaId, groupSeasons)
    const [mergedSeason, setMergedSeason] = useAtom(__entry_mergedSeasonAtom)
    const [open, setOpen] = React.useState(false)

    const currentId = mediaId

    // Group seasons into distinct (TMDB id, season) buckets, preserving order. Cours of
    // one season share a TMDB id; a sibling mislabeled with the same season number but a
    // different/empty TMDB becomes its own bucket.
    const { order, groups } = React.useMemo(() => {
        const order: string[] = []
        const groups = new Map<string, Anime_GroupedEntry[]>()
        for (const s of (franchise?.seasons ?? [])) {
            const key = s.tmdbId ? `${s.tmdbId}:${s.seasonNumber}` : `id:${s.mediaId}`
            if (!groups.has(key)) {
                groups.set(key, [])
                order.push(key)
            }
            groups.get(key)!.push(s)
        }
        return { order, groups }
    }, [franchise?.seasons])

    // Default the entry to its merged season when it's a cour of a multi-cour season;
    // otherwise clear (so single-season entries show their own list). Re-runs per entry.
    const appliedRef = React.useRef<number | null>(null)
    React.useEffect(() => {
        if (!franchise || appliedRef.current === currentId) return
        appliedRef.current = currentId
        for (const key of order) {
            const cours = groups.get(key)!
            if (cours.length > 1 && cours.some(c => c.mediaId === currentId)) {
                setMergedSeason({ season: cours[0].seasonNumber, tmdb: cours[0].tmdbId })
                return
            }
        }
        setMergedSeason(null)
    }, [franchise, order, groups, currentId, setMergedSeason])

    if (!groupSeasons || !franchise) return null

    const seasons = franchise.seasons ?? []
    const extras = franchise.extras ?? []
    const watchOrder = franchise.watchOrder ?? []
    if (seasons.length + extras.length <= 1) return null

    // replace (not push) so switching seasons doesn't stack entry screens — back from
    // any season returns to wherever you opened the entry from, not the prior season.
    const go = (id: number) => {
        if (id && id !== currentId) router.replace({ pathname: "/(app)/entry/anime/[id]", params: { id: String(id) } })
    }

    const selectSeason = (key: string) => {
        const cours = groups.get(key) ?? []
        if (cours.length > 1) {
            setMergedSeason({ season: cours[0].seasonNumber, tmdb: cours[0].tmdbId })
            // Navigate to the season's first cour so the banner/cover/metadata reflect it
            // (the merged view re-opens on arrival via the auto-open effect). No-op if we're
            // already on a cour of this season.
            if (!cours.some(c => c.mediaId === currentId)) go(cours[0].mediaId)
        } else if (cours[0]) {
            setMergedSeason(null)
            go(cours[0].mediaId)
        }
    }

    // One ordered (watch-order) list of selectable items: each season (cours collapsed)
    // plus the tagged extras.
    type Item = { label: string, sub?: string, tag?: string, isCurrent: boolean, onSelect: () => void }
    const items: Item[] = []
    const seenKey = new Set<string>()
    for (const e of watchOrder) {
        if (e.isExtra) {
            items.push({
                label: entryTitle(e),
                tag: e.tag || undefined,
                isCurrent: mergedSeason == null && e.mediaId === currentId,
                onSelect: () => { setMergedSeason(null); go(e.mediaId) },
            })
            continue
        }
        const key = e.tmdbId ? `${e.tmdbId}:${e.seasonNumber}` : `id:${e.mediaId}`
        if (seenKey.has(key)) continue
        seenKey.add(key)
        const cours = groups.get(key) ?? [e]
        const isMerged = cours.length > 1
        items.push({
            label: `Season ${order.indexOf(key) + 1}`,
            sub: isMerged ? `${cours.length} cours` : undefined,
            isCurrent: mergedSeason != null
                ? (isMerged && mergedSeason.season === cours[0].seasonNumber && mergedSeason.tmdb === cours[0].tmdbId)
                : cours.some(c => c.mediaId === currentId),
            onSelect: () => selectSeason(key),
        })
    }
    const current = items.find(it => it.isCurrent)

    return (
        <View className="px-4 mb-5">
            <Pressable
                onPress={() => setOpen(true)}
                className="flex-row items-center gap-2 self-start rounded-lg border border-border px-3 py-2 active:bg-accent"
            >
                <Text className="text-muted-foreground text-sm">Season:</Text>
                <Text className="text-foreground font-semibold max-w-[14rem]" numberOfLines={1}>{current?.label ?? "Select"}</Text>
                {!!current?.sub && <Text className="text-muted-foreground text-xs">{current.sub}</Text>}
                <ChevronDown size={16} className="text-foreground" />
            </Pressable>

            <SeaBottomSheet open={open} onOpenChange={setOpen} title="Select season" snapPoints={["60%"]}>
                <View className="gap-1 pb-4">
                    {items.map((it, i) => (
                        <Pressable
                            key={i}
                            onPress={() => { it.onSelect(); setOpen(false) }}
                            className={cn("flex-row items-center gap-2 rounded-lg px-3 py-3", it.isCurrent && "bg-accent")}
                        >
                            <Text className={cn("flex-1 text-foreground", it.isCurrent && "font-semibold")} numberOfLines={1}>{it.label}</Text>
                            {!!it.sub && <Text className="text-muted-foreground text-xs">{it.sub}</Text>}
                            {!!it.tag && <Text className="text-muted-foreground text-xs uppercase">{it.tag}</Text>}
                        </Pressable>
                    ))}
                </View>
            </SeaBottomSheet>
        </View>
    )
}
