import { InlineSelect } from "@/components/shared/inline-select"
import { MultiToggle } from "@/components/shared/multi-toggle"
import { SheetFooter, SheetFooterButton } from "@/components/shared/sheet-footer"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { FormField } from "@/components/ui/form-field"
import { Text } from "@/components/ui/text"
import {
    SEARCH_FORMATS_ANIME,
    SEARCH_FORMATS_MANGA,
    SEARCH_MEDIA_GENRES,
    SEARCH_SEASONS,
    SEARCH_STATUS,
    SEARCH_YEARS,
} from "@/lib/search/search-constants"
import { cn } from "@/lib/utils"
import { COLLECTION_SORTING_OPTIONS, CollectionParams, DEFAULT_COLLECTION_PARAMS } from "@/lib/utils/filtering"
import Ionicons from "@expo/vector-icons/Ionicons"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"

export function countActiveCollectionFilters(params: CollectionParams, type: "anime" | "manga"): number {
    let count = 0
    if (params.sorting !== "SCORE_DESC") count++
    if (params.genre && params.genre.length > 0) count++
    if (params.tags && params.tags.length > 0) count++
    if (params.status !== null) count++
    if (params.format !== null) count++
    if (params.season !== null && type === "anime") count++
    if (params.year !== null) count++
    return count
}

type CollectionFilterSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    params: CollectionParams
    type: "anime" | "manga"
    onApply: (params: CollectionParams) => void
    /** AniList tags present in the user's collection (frequency-sorted). Hides the field when empty. */
    tagOptions?: string[]
}

export function CollectionFilterSheet({
    open,
    onOpenChange,
    params,
    type,
    onApply,
    tagOptions,
}: CollectionFilterSheetProps) {
    const [draft, setDraft] = React.useState(params)

    // sync draft when sheet opens
    React.useEffect(() => {
        if (open) setDraft(params)
    }, [open, params])

    const isAnime = type === "anime"

    function toggleGenre(genre: string) {
        setDraft(d => ({
            ...d,
            genre: (d.genre ?? []).includes(genre)
                ? (d.genre ?? []).filter(g => g !== genre)
                : [...(d.genre ?? []), genre],
        }))
    }

    function toggleTag(tag: string) {
        setDraft(d => ({
            ...d,
            tags: (d.tags ?? []).includes(tag)
                ? (d.tags ?? []).filter(t => t !== tag)
                : [...(d.tags ?? []), tag],
        }))
    }

    function reset() {
        setDraft({ ...DEFAULT_COLLECTION_PARAMS })
    }

    function apply() {
        onApply(draft)
        onOpenChange(false)
    }

    const activeCount = countActiveCollectionFilters(draft, type)

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={["90%"]}
            title="Filters"
            footer={
                <SheetFooter>
                    <SheetFooterButton variant="cancel" onPress={reset}>
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="refresh-outline" size={15} color="rgba(255,255,255,0.6)" />
                            <Text className="text-white/60 text-sm font-semibold">Reset</Text>
                        </View>
                    </SheetFooterButton>
                    <SheetFooterButton onPress={apply}>
                        <Text className="text-sm font-bold">
                            {activeCount > 0 ? `Apply (${activeCount})` : "Apply"}
                        </Text>
                    </SheetFooterButton>
                </SheetFooter>
            }
        >
            <View className="gap-5 pb-2">

                <FormField label="Sort by" icon="swap-vertical-outline">
                    <InlineSelect
                        options={COLLECTION_SORTING_OPTIONS}
                        value={draft.sorting}
                        nullable={false}
                        onSelect={v => v && setDraft(d => ({ ...d, sorting: v as CollectionParams["sorting"] }))}
                    />
                </FormField>


                <FormField label="Format" icon="layers-outline">
                    <InlineSelect
                        options={isAnime ? SEARCH_FORMATS_ANIME : SEARCH_FORMATS_MANGA}
                        value={draft.format}
                        onSelect={v => setDraft(d => ({ ...d, format: v }))}
                    />
                </FormField>


                {isAnime && (
                    <FormField label="Season" icon="partly-sunny-outline">
                        <InlineSelect
                            options={[...SEARCH_SEASONS]}
                            value={draft.season}
                            onSelect={v => setDraft(d => ({ ...d, season: v as CollectionParams["season"] }))}
                        />
                    </FormField>
                )}


                <FormField label="Year" icon="calendar-outline">
                    <View style={{ maxHeight: 120 }}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 8, paddingRight: 4 }}
                            keyboardShouldPersistTaps="handled"
                        >
                            {SEARCH_YEARS.map(year => {
                                const selected = draft.year === year
                                return (
                                    <Pressable
                                        key={year}
                                        onPress={() => setDraft(d => ({
                                            ...d,
                                            year: d.year === year ? null : year,
                                        }))}
                                        className={cn(
                                            "h-9 w-16 rounded-xl border items-center justify-center active:opacity-70",
                                            selected
                                                ? "border-brand-500/70 bg-brand-500/20"
                                                : "border-white/10 bg-white/[0.04]",
                                        )}
                                    >
                                        <Text
                                            className={cn(
                                                "text-sm font-medium",
                                                selected ? "text-brand-400" : "text-white/65",
                                            )}
                                        >
                                            {year}
                                        </Text>
                                    </Pressable>
                                )
                            })}
                        </ScrollView>
                    </View>
                </FormField>


                <FormField label="Status" icon="radio-button-on-outline">
                    <InlineSelect
                        options={SEARCH_STATUS}
                        value={draft.status}
                        onSelect={v => setDraft(d => ({ ...d, status: v as CollectionParams["status"] }))}
                    />
                </FormField>


                <FormField label="Genres" icon="pricetag-outline">
                    <MultiToggle
                        options={SEARCH_MEDIA_GENRES.map(g => ({ value: g, label: g }))}
                        values={draft.genre ?? []}
                        onToggle={toggleGenre}
                    />
                </FormField>

                {!!tagOptions?.length && (
                    <FormField label="Tags" icon="pricetags-outline">
                        <MultiToggle
                            options={tagOptions.map(t => ({ value: t, label: t }))}
                            values={draft.tags ?? []}
                            onToggle={toggleTag}
                        />
                    </FormField>
                )}
            </View>
        </SeaBottomSheet>
    )
}
