import type { HibikeManga_SearchResult } from "@/api/generated/types"
import { useGetMangaMapping, useMangaManualMapping, useMangaManualSearch, useRemoveMangaMapping } from "@/api/hooks/manga.hooks"
import { SheetFooter, SheetFooterButton } from "@/components/shared/sheet-footer"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import { BottomSheetTextInput } from "@gorhom/bottom-sheet"
import * as React from "react"
import { ActivityIndicator, Pressable, Text, View } from "react-native"

type MangaManualMatchModalProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    mediaId: number
    provider: string | null
    mediaTitle: string
}

export function MangaManualMatchModal({
    open,
    onOpenChange,
    mediaId,
    provider,
    mediaTitle,
}: MangaManualMatchModalProps) {
    const [query, setQuery] = React.useState(mediaTitle)

    const { data: currentMapping } = useGetMangaMapping({ provider: provider ?? undefined, mediaId })
    const { mutate: search, data: searchResults, isPending: isSearching } = useMangaManualSearch(mediaId, provider)
    const { mutate: mapManga, isPending: isMapping } = useMangaManualMapping()
    const { mutate: removeMapping, isPending: isRemoving } = useRemoveMangaMapping()

    React.useEffect(() => {
        if (open) {
            setQuery(mediaTitle)
        }
    }, [open, mediaTitle])

    const handleSearch = React.useCallback(() => {
        if (!query.trim() || !provider) return
        search({ provider, query: query.trim() })
    }, [query, provider, search])

    const handleSelectResult = React.useCallback((result: HibikeManga_SearchResult) => {
        if (!provider) return
        mapManga(
            { provider, mediaId, mangaId: result.id },
            { onSuccess: () => onOpenChange(false) },
        )
    }, [provider, mediaId, mapManga, onOpenChange])

    const handleRemoveMapping = React.useCallback(() => {
        if (!provider) return
        removeMapping(
            { provider, mediaId },
            { onSuccess: () => onOpenChange(false) },
        )
    }, [provider, mediaId, removeMapping, onOpenChange])

    return (
        <SeaBottomSheet
            title="Manual Match"
            open={open}
            onOpenChange={onOpenChange}
            index={1}
            snapPoints={["60%", "92%"]}
            footer={
                <SheetFooter>
                    <SheetFooterButton
                        variant="cancel"
                        onPress={() => onOpenChange(false)}
                    >
                        <Text className="font-medium text-foreground/70">Close</Text>
                    </SheetFooterButton>
                    {currentMapping?.mangaId && (
                        <SheetFooterButton
                            variant="destructive"
                            onPress={handleRemoveMapping}
                            disabled={isRemoving}
                        >
                            {isRemoving ? (
                                <ActivityIndicator size="small" color="#ef4444" />
                            ) : (
                                <Text className="font-medium text-red-400">Remove mapping</Text>
                            )}
                        </SheetFooterButton>
                    )}
                </SheetFooter>
            }
        >
            <View className="gap-4">
                <View className="flex-row gap-2">
                    <View className="flex-1 h-11 bg-card/30 border border-border/50 rounded-xl px-3 flex-row items-center">
                        <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
                        <BottomSheetTextInput
                            value={query}
                            onChangeText={setQuery}
                            onSubmitEditing={handleSearch}
                            returnKeyType="search"
                            placeholder="Search title..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            className="ml-2 flex-1 text-sm text-white"
                            autoCapitalize="none"
                        />
                    </View>
                    <Pressable
                        onPress={handleSearch}
                        disabled={isSearching || !query.trim() || !provider}
                        className={cn(
                            "h-11 px-4 items-center justify-center rounded-xl",
                            isSearching || !query.trim() || !provider
                                ? "bg-card/30 border border-border/50"
                                : "bg-primary active:opacity-80",
                        )}
                    >
                        {isSearching ? (
                            <ActivityIndicator size="small" color="white" />
                        ) : (
                            <Text className="text-sm font-medium text-primary-foreground">Search</Text>
                        )}
                    </Pressable>
                </View>

                {currentMapping?.mangaId && (
                    <View className="bg-brand-300/10 border border-brand-300/20 rounded-xl px-3 py-2">
                        <Text className="text-xs text-brand-300">
                            Currently mapped to: {currentMapping.mangaId}
                        </Text>
                    </View>
                )}

                {searchResults && searchResults.length === 0 && (
                    <View className="py-8 items-center">
                        <Text className="text-white/40 text-sm">No results found</Text>
                    </View>
                )}

                {searchResults && searchResults.map((result, index) => (
                    <Pressable
                        key={`${result.id}-${index}`}
                        onPress={() => handleSelectResult(result)}
                        disabled={isMapping}
                        className={cn(
                            "px-4 py-3.5 bg-card/30 border-x border-border/50 active:bg-white/10",
                            index === 0 && "rounded-t-2xl border-t",
                            index === searchResults.length - 1 && "rounded-b-2xl border-b",
                            index < searchResults.length - 1 && "border-b border-b-border/30",
                        )}
                    >
                        <Text className="text-sm font-medium text-foreground" numberOfLines={2}>
                            {result.title}
                        </Text>
                        {!!result.year && (
                            <Text className="text-xs text-white/40 mt-1">{result.year}</Text>
                        )}
                    </Pressable>
                ))}
            </View>
        </SeaBottomSheet>
    )
}
