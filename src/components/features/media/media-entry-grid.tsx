import { AL_BaseAnime, AL_BaseManga } from "@/api/generated/types"
import { MediaEntryCard } from "@/components/features/media/media-entry-card"
import Ionicons from "@expo/vector-icons/Ionicons"
import * as React from "react"
import { Dimensions, FlatList, StyleProp, Text, ViewStyle } from "react-native"
import Animated, { FadeIn } from "react-native-reanimated"

const { width } = Dimensions.get("screen")
const NUM_COLUMNS = 3
const SPACING = 10
const PADDING_HORIZONTAL = 14
const CARD_WIDTH = (width - (NUM_COLUMNS - 1) * SPACING - 2 * PADDING_HORIZONTAL) / NUM_COLUMNS
const GRID_INITIAL_ROWS = 4
const GRID_ROW_HEIGHT = CARD_WIDTH * 1.5 + SPACING + 8

type MediaEntryGridProps<T extends "anime" | "manga"> = {
    type: T
    media: T extends "anime" ? AL_BaseAnime[] : AL_BaseManga[]
    onPress: (item: T extends "anime" ? AL_BaseAnime : AL_BaseManga) => void
    query?: string
    contentContainerStyle?: StyleProp<ViewStyle>
    topPadding?: number
}

export function MediaEntryGrid<T extends "anime" | "manga">({
    type,
    media,
    onPress,
    query,
    contentContainerStyle,
    topPadding = 8,
}: MediaEntryGridProps<T>) {
    if (media.length === 0) {
        return (
            <Animated.View
                entering={FadeIn.duration(200)}
                className="flex-1 items-center justify-center pt-24 gap-3"
            >
                <Ionicons name="search-outline" size={36} color="rgba(255,255,255,0.15)" />
                <Text className="text-white/30 text-sm">
                    {query ? `No results for "${query}"` : "No results"}
                </Text>
            </Animated.View>
        )
    }

    const keyExtractor = React.useCallback((item: AL_BaseAnime | AL_BaseManga, index: number) => `${item.id}-${index}`, [])

    const renderItem = React.useCallback(({ item }: { item: AL_BaseAnime | AL_BaseManga }) => (
        <MediaEntryCard
            type={type}
            cardWidth={CARD_WIDTH}
            media={item as any}
            onPress={() => onPress(item as any)}
        />
    ), [onPress, type])

    const getItemLayout = React.useCallback((_: ArrayLike<AL_BaseAnime | AL_BaseManga> | null | undefined, index: number) => {
        const rowIndex = Math.floor(index / NUM_COLUMNS)

        return {
            length: GRID_ROW_HEIGHT,
            offset: topPadding + (rowIndex * GRID_ROW_HEIGHT),
            index,
        }
    }, [topPadding])

    return (
        <Animated.View entering={FadeIn.duration(200)} className="flex-1">
            <FlatList
                data={media as (AL_BaseAnime | AL_BaseManga)[]}
                numColumns={NUM_COLUMNS}
                showsVerticalScrollIndicator={false}
                keyExtractor={keyExtractor}
                renderItem={renderItem}
                getItemLayout={getItemLayout}
                initialNumToRender={NUM_COLUMNS * GRID_INITIAL_ROWS}
                maxToRenderPerBatch={NUM_COLUMNS * 2}
                updateCellsBatchingPeriod={16}
                windowSize={7}
                removeClippedSubviews
                contentContainerStyle={[
                    {
                        gap: SPACING,
                        paddingHorizontal: PADDING_HORIZONTAL,
                        paddingBottom: 80,
                        paddingTop: topPadding,
                    },
                    contentContainerStyle,
                ]}
                columnWrapperStyle={{ gap: SPACING }}
                decelerationRate="normal"
            />
        </Animated.View>
    )
}
