import React from "react"

export function useSwipeSeek() {
    const [swipeSeeking, setSwipeSeeking] = React.useState<{ startTime: number; currentTime: number } | null>(null)
    const swipeStartTimeRef = React.useRef(0)
    const swipeActivatedRef = React.useRef(false)
    const swipeStartXRef = React.useRef(0)
    const swipeSeekingRef = React.useRef<{ startTime: number; currentTime: number } | null>(null)
    const pendingSwipeSeekingRef = React.useRef<{ startTime: number; currentTime: number } | null>(null)
    const swipeSeekingFrameRef = React.useRef<number | null>(null)
    const panGestureModeRef = React.useRef<"seek" | "side-adjust" | null>(null)

    const scheduleSwipeSeekingUpdate = React.useCallback((value: { startTime: number; currentTime: number } | null) => {
        pendingSwipeSeekingRef.current = value
        if (value === null) {
            if (swipeSeekingFrameRef.current !== null) {
                cancelAnimationFrame(swipeSeekingFrameRef.current)
                swipeSeekingFrameRef.current = null
            }
            setSwipeSeeking(null)
            return
        }

        if (swipeSeekingFrameRef.current !== null) return

        swipeSeekingFrameRef.current = requestAnimationFrame(() => {
            swipeSeekingFrameRef.current = null
            const nextValue = pendingSwipeSeekingRef.current
            setSwipeSeeking(current => {
                if (current === null && nextValue === null) return current
                if (current && nextValue
                    && current.startTime === nextValue.startTime
                    && current.currentTime === nextValue.currentTime) {
                    return current
                }
                return nextValue
            })
        })
    }, [])

    // cleanup
    React.useEffect(() => {
        return () => {
            if (swipeSeekingFrameRef.current !== null) cancelAnimationFrame(swipeSeekingFrameRef.current)
        }
    }, [])

    return {
        swipeSeeking,
        swipeStartTimeRef,
        swipeActivatedRef,
        swipeStartXRef,
        swipeSeekingRef,
        panGestureModeRef,
        scheduleSwipeSeekingUpdate,
    }
}
