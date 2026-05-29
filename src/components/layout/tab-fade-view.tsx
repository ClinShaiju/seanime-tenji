import { useFocusEffect } from "expo-router"
import * as React from "react"
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

export function TabFadeView({ children, style }: { children: React.ReactNode; style?: object }) {
    const opacity = useSharedValue(0)

    useFocusEffect(
        React.useCallback(() => {
            opacity.set(withTiming(1, { duration: 180 }))
            return () => {
                // immediately reset so the next focus always starts from 0
                opacity.set(0)
            }
        }, [opacity]),
    )

    const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

    return (
        <Animated.View style={[{ flex: 1 }, animStyle, style]}>
            {children}
        </Animated.View>
    )
}
