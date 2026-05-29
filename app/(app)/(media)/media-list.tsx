import { AL_BaseAnime, AL_BaseManga } from "@/api/generated/types"
import { __media_listPageContentAtom } from "@/atoms/media-list"
import { MediaEntryCard } from "@/components/features/media/media-entry-card"
import { SafeView } from "@/components/layout/layout-view"
import { Button } from "@/components/ui/button"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import { Ionicons } from "@/lib/icons/Ionicons"
import { buildMediaEntryHref, getMediaEntryKind } from "@/lib/media-entry-route"
import { FlashList } from "@shopify/flash-list"
import { router } from "expo-router"
import { useAtom } from "jotai/react"
import React from "react"
import { Dimensions, Text, View } from "react-native"

const { width } = Dimensions.get("screen")
const NUM_COLUMNS = 3
const SPACING = 10
const PADDING_HORIZONTAL = 8
const AVAILABLE_SPACE = width - (NUM_COLUMNS - 1) * SPACING - 2 * PADDING_HORIZONTAL

const CARD_WIDTH = AVAILABLE_SPACE / NUM_COLUMNS


export default function MediaList() {
    const canGoBack = router.canGoBack()

    useIOSScrollRefreshRateWorkaround()

    const [mediaListPageContent] = useAtom(__media_listPageContentAtom)

    if (!mediaListPageContent) return null

    const keyExtractor = React.useCallback((item: AL_BaseAnime | AL_BaseManga, index: number) => `${item.id}-${index}`, [])

    const renderItem = React.useCallback(({ item, index }: { item: AL_BaseAnime | AL_BaseManga, index: number }) => {
        const itemType = getMediaEntryKind(item, mediaListPageContent.type)

        if (itemType === "manga") {
            return <MediaEntryCard
                type="manga"
                cardWidth={CARD_WIDTH}
                media={item as AL_BaseManga}
                onPress={() => router.push(buildMediaEntryHref(item, mediaListPageContent.type))}
            />
        }

        return <MediaEntryCard
            type="anime"
            cardWidth={CARD_WIDTH}
            media={item as AL_BaseAnime}
            onPress={() => router.push(buildMediaEntryHref(item, mediaListPageContent.type))}
        />
    }, [mediaListPageContent.type])

    return (
        <SafeView>
            <View className="flex flex-row gap-0 items-center px-4">
                {canGoBack && <Button
                    variant="secondary" size="icon" className="rounded-full"
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={18} colorClassName="accent-foreground" />
                </Button>}
                <Text className="text-xl font-bold text-foreground p-4">
                    <Text>{mediaListPageContent?.title}</Text>
                    <Text className="text-xl text-muted-foreground">&nbsp;&nbsp;{mediaListPageContent?.media.length}</Text>
                </Text>
            </View>
            <View
                className="flex-1"
            >
                <FlashList
                    data={mediaListPageContent?.media}
                    numColumns={NUM_COLUMNS}
                    showsVerticalScrollIndicator={false}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    drawDistance={320}
                    contentContainerStyle={{ paddingHorizontal: PADDING_HORIZONTAL, paddingBottom: 50 }}
                    ItemSeparatorComponent={() => <View style={{ height: SPACING }} />}
                    decelerationRate="normal"
                />
            </View>
        </SafeView>
    )

}
