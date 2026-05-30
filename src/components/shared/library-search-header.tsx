import { COLORS } from "@/constants/colors"
import { LinearGradient } from "expo-linear-gradient"
import * as React from "react"
import { View } from "react-native"
import Animated, { Extrapolation, interpolate, interpolateColor, SharedValue, useAnimatedStyle } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { LibrarySearchBar, type LibrarySearchBarProps } from "./library-search-bar"

export const LIBRARY_SEARCH_HEADER_FADE_HEIGHT = 20
export const LIBRARY_SEARCH_HEADER_BASE_HEIGHT = 60

export interface LibrarySearchHeaderProps extends LibrarySearchBarProps {
    scrollY?: SharedValue<number>
    hasHero?: boolean
}

export function LibrarySearchHeader(props: LibrarySearchHeaderProps) {
    const { scrollY, hasHero = false, ...searchProps } = props
    const insets = useSafeAreaInsets()

    const animatedBgStyle = useAnimatedStyle(() => {
        if (!hasHero || !scrollY) {
            return {
                backgroundColor: COLORS.background || "#0c0c0c",
                borderBottomWidth: 1,
                borderBottomColor: "rgba(255,255,255,0.06)",
            }
        }

        const y = scrollY.value
        const bgColor = interpolateColor(
            y,
            [0, 100],
            ["rgba(12,12,12,0)", "rgba(12,12,12,0.98)"],
        )

        const borderColor = interpolateColor(
            y,
            [80, 120],
            ["rgba(255,255,255,0)", "rgba(255,255,255,0.06)"],
        )

        return {
            backgroundColor: bgColor,
            borderBottomWidth: 1,
            borderBottomColor: borderColor,
        }
    })

    const animatedGradientStyle = useAnimatedStyle(() => {
        if (!hasHero || !scrollY) {
            return { opacity: 0 }
        }

        const y = scrollY.value
        const opacity = interpolate(
            y,
            [0, 100],
            [1, 0],
            Extrapolation.CLAMP,
        )

        return { opacity }
    })

    const headerHeight = hasHero ? (insets.top + LIBRARY_SEARCH_HEADER_BASE_HEIGHT) : LIBRARY_SEARCH_HEADER_BASE_HEIGHT
    const paddingTop = hasHero ? (insets.top + 8) : 8

    return (
        <View
            className="absolute left-0 right-0 top-0 z-20"
            pointerEvents="box-none"
            style={{ height: headerHeight }}
        >
            <Animated.View
                pointerEvents="none"
                style={[{ position: "absolute", top: 0, left: 0, right: 0, height: headerHeight }, animatedGradientStyle]}
            >
                <LinearGradient
                    colors={["rgba(0,0,0,0.8)", "rgba(0,0,0,0.3)", "transparent"]}
                    locations={[0, 0.6, 1]}
                    style={{ flex: 1 }}
                />
            </Animated.View>

            <Animated.View
                style={[
                    {
                        paddingTop: paddingTop,
                        paddingBottom: 8,
                    },
                    animatedBgStyle,
                ]}
                className="px-4 flex-row items-center justify-between"
            >
                <LibrarySearchBar {...searchProps} />
            </Animated.View>
        </View>
    )
}


