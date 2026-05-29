import React from "react"
import { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated"
import { DOUBLE_TAP_INDICATOR_VISIBLE_MS } from "../constants"

/**
 * Manages the double-tap seek flash indicator state and animation.
 */
export function useDoubleTapSeek() {
    const [doubleTapSide, setDoubleTapSide] = React.useState<"left" | "right">("right")
    const [doubleTapAmount, setDoubleTapAmount] = React.useState(0)
    const doubleTapAmountRef = React.useRef(0)
    const doubleTapVisibleSideRef = React.useRef<"left" | "right" | null>(null)
    const doubleTapHideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const doubleTapOpacity = useSharedValue(0)
    const doubleTapIndicatorStyle = useAnimatedStyle(() => ({ opacity: doubleTapOpacity.value }))

    const showDoubleTapIndicator = React.useCallback((side: "left" | "right", amount: number) => {
        const nextAmount = doubleTapVisibleSideRef.current === side
            ? doubleTapAmountRef.current + amount
            : amount

        doubleTapVisibleSideRef.current = side
        doubleTapAmountRef.current = nextAmount
        setDoubleTapSide(side)
        setDoubleTapAmount(nextAmount)

        if (doubleTapHideTimerRef.current) {
            clearTimeout(doubleTapHideTimerRef.current)
        }

        doubleTapOpacity.set(withSequence(
            withTiming(1, { duration: 80 }),
            withTiming(0, { duration: 600 }),
        ))
        doubleTapHideTimerRef.current = setTimeout(() => {
            doubleTapVisibleSideRef.current = null
            doubleTapAmountRef.current = 0
            setDoubleTapAmount(0)
            doubleTapHideTimerRef.current = null
        }, DOUBLE_TAP_INDICATOR_VISIBLE_MS)
    }, [doubleTapOpacity])

    React.useEffect(() => {
        return () => {
            if (doubleTapHideTimerRef.current) clearTimeout(doubleTapHideTimerRef.current)
        }
    }, [])

    return {
        doubleTapSide,
        doubleTapAmount,
        doubleTapIndicatorStyle,
        showDoubleTapIndicator,
    }
}
