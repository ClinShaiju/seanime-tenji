import React from "react"
import { Gesture } from "react-native-gesture-handler"
import { runOnJS } from "react-native-reanimated"
import {
    CENTER_TAP_FEEDBACK_HIDE_DELAY,
    DOUBLE_TAP_THRESHOLD,
    GESTURE_DIRECTION_LOCK_RATIO,
    LONG_PRESS_MIN_DURATION,
    PAN_GESTURE_MIN_DISTANCE,
    SIDE_ADJUST_ACTIVATION_THRESHOLD,
    SIDE_ADJUST_ZONE_RATIO,
    SWIPE_ACTIVATION_THRESHOLD,
    SWIPE_SEEK_SENSITIVITY,
    TAP_GESTURE_MAX_DISTANCE,
} from "../constants"
import { clamp, getDoubleTapSeekZone, getGestureTouchX, getTapZone } from "../helpers"
import type { GestureRefs } from "../types"

interface UsePlayerGesturesParams {
    gRef: React.MutableRefObject<GestureRefs>
    screenWidth: number
    screenHeight: number
    fillZoomScale: number

    // controls
    clearHideTimer: () => void
    scheduleHide: () => void
    showControls: () => void
    toggleControls: () => void
    closeSettings: () => void
    setControlsVisible: React.Dispatch<React.SetStateAction<boolean>>

    // player actions
    seekTo: (sec: number, exact?: boolean) => void
    seekRelative: (delta: number, exact?: boolean) => void
    togglePlayPause: () => void
    setPlayerSpeed: (speed: number) => void

    // zoom
    applyVideoZoom: (scale: number) => void
    applyZoomMode: (mode: "fit" | "fill") => void
    zoomScaleRef: React.MutableRefObject<number>
    pinchStartScaleRef: React.MutableRefObject<number>

    // double tap
    showDoubleTapIndicator: (side: "left" | "right", amount: number) => void

    // swipe seek
    swipeStartTimeRef: React.MutableRefObject<number>
    swipeActivatedRef: React.MutableRefObject<boolean>
    swipeStartXRef: React.MutableRefObject<number>
    swipeSeekingRef: React.MutableRefObject<{ startTime: number; currentTime: number } | null>
    panGestureModeRef: React.MutableRefObject<"seek" | "side-adjust" | null>
    scheduleSwipeSeekingUpdate: (value: { startTime: number; currentTime: number } | null) => void

    // side adjust
    brightnessLevelRef: React.MutableRefObject<number>
    volumeLevelRef: React.MutableRefObject<number>
    sideAdjustKindRef: React.MutableRefObject<"brightness" | "volume" | null>
    sideAdjustStartYRef: React.MutableRefObject<number>
    sideAdjustStartValueRef: React.MutableRefObject<number>
    sideAdjustActivatedRef: React.MutableRefObject<boolean>
    scheduleSideAdjustHide: () => void
    scheduleSideAdjustUpdate: (kind: "brightness" | "volume", value: number) => void

    // long press
    savedSpeedRef: React.MutableRefObject<number>
    controlsVisibleBeforeLongPressRef: React.MutableRefObject<boolean>
    setIsFastForwarding: React.Dispatch<React.SetStateAction<boolean>>

    // center tap
    setCenterTapFeedback: React.Dispatch<React.SetStateAction<"play" | "pause" | null>>
    centerTapHideTimerRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
}

/**
 * Composes all gesture recognizers into a single stable gesture object.
 *
 * All volatile state is read from gRef so the gesture object is only
 * recreated when structural dependencies change (screen dimensions, callbacks).
 */
export function usePlayerGestures(params: UsePlayerGesturesParams) {
    const {
        gRef, screenWidth, screenHeight, fillZoomScale,
        clearHideTimer, scheduleHide, showControls, toggleControls, closeSettings, setControlsVisible,
        seekTo, seekRelative, togglePlayPause, setPlayerSpeed,
        applyVideoZoom, applyZoomMode, zoomScaleRef, pinchStartScaleRef,
        showDoubleTapIndicator,
        swipeStartTimeRef, swipeActivatedRef, swipeStartXRef,
        swipeSeekingRef, panGestureModeRef, scheduleSwipeSeekingUpdate,
        brightnessLevelRef, volumeLevelRef,
        sideAdjustKindRef, sideAdjustStartYRef, sideAdjustStartValueRef,
        sideAdjustActivatedRef, scheduleSideAdjustHide, scheduleSideAdjustUpdate,
        savedSpeedRef, controlsVisibleBeforeLongPressRef, setIsFastForwarding,
        setCenterTapFeedback, centerTapHideTimerRef,
    } = params

    const longPressActiveRef = React.useRef(false)
    const tapStartXRef = React.useRef<number | null>(null)
    const pendingSideTapRef = React.useRef<{
        zone: "left" | "right"
        previousControlsVisible: boolean
        startedAt: number
        timeout: ReturnType<typeof setTimeout> | null
    } | null>(null)
    const suppressedEdgeTapRef = React.useRef<{
        zone: "left" | "right"
        until: number
    } | null>(null)

    // stable action callbacks (read from gRef, minimal deps)

    const flashCenterTapFeedback = React.useCallback((nextPaused: boolean) => {
        if (centerTapHideTimerRef.current) clearTimeout(centerTapHideTimerRef.current)
        setCenterTapFeedback(nextPaused ? "pause" : "play")
        centerTapHideTimerRef.current = setTimeout(() => {
            setCenterTapFeedback(null)
            centerTapHideTimerRef.current = null
        }, CENTER_TAP_FEEDBACK_HIDE_DELAY)
    }, [centerTapHideTimerRef, setCenterTapFeedback])

    const clearPendingSideTap = React.useCallback(() => {
        const pendingSideTap = pendingSideTapRef.current
        if (pendingSideTap?.timeout) {
            clearTimeout(pendingSideTap.timeout)
        }
        pendingSideTapRef.current = null
    }, [])

    const setTapStartX = React.useCallback((tapX: number | null) => {
        tapStartXRef.current = tapX
    }, [])

    React.useEffect(() => clearPendingSideTap, [clearPendingSideTap])

    const applyQueuedSideTap = React.useCallback((previousControlsVisible: boolean) => {
        clearHideTimer()
        if (previousControlsVisible) {
            setControlsVisible(false)
            return
        }

        setControlsVisible(true)
        if (!gRef.current.paused) {
            scheduleHide()
        }
    }, [clearHideTimer, gRef, scheduleHide, setControlsVisible])

    const handleDoubleTapSeekStart = React.useCallback((side: "left" | "right") => {
        const pendingSideTap = pendingSideTapRef.current
        if (!pendingSideTap || pendingSideTap.zone !== side) return

        clearPendingSideTap()
        suppressedEdgeTapRef.current = {
            zone: side,
            until: Date.now() + DOUBLE_TAP_THRESHOLD,
        }
    }, [clearPendingSideTap])

    const handleSingleTap = React.useCallback(() => {
        const g = gRef.current
        if (g.isPiPActive) return
        if (g.panel) {
            closeSettings()
            return
        }
        if (g.controlsLocked) {
            showControls()
            return
        }
        toggleControls()
    }, [closeSettings, gRef, showControls, toggleControls])

    const handleDoubleTapSeek = React.useCallback((side: "left" | "right") => {
        const g = gRef.current
        if (g.isPiPActive || g.panel || g.controlsLocked) return

        clearPendingSideTap()
        suppressedEdgeTapRef.current = {
            zone: side,
            until: Date.now() + DOUBLE_TAP_THRESHOLD,
        }

        const amount = g.doubleTapSeekSec
        if (side === "left") {
            seekRelative(-amount, true)
            showDoubleTapIndicator("left", amount)
        } else {
            seekRelative(amount, true)
            showDoubleTapIndicator("right", amount)
        }
        scheduleHide()
    }, [clearPendingSideTap, gRef, scheduleHide, seekRelative, showDoubleTapIndicator])

    const handleTapGestureEnd = React.useCallback((tapEndX: number) => {
            const tapX = tapStartXRef.current ?? tapEndX
            tapStartXRef.current = null

            const g = gRef.current
            const tapZone = getTapZone(screenWidth, tapX)
            const seekZone = getDoubleTapSeekZone(screenWidth, tapX)
            const suppressedEdgeTap = suppressedEdgeTapRef.current
            const pendingSideTap = pendingSideTapRef.current

            if (suppressedEdgeTap && Date.now() > suppressedEdgeTap.until) {
                suppressedEdgeTapRef.current = null
            }
            if (seekZone && suppressedEdgeTapRef.current?.zone === seekZone) {
                return
            }

            if (pendingSideTap && (!seekZone || pendingSideTap.zone !== seekZone)) {
                clearPendingSideTap()
            }

            if (g.isPiPActive) return
            if (g.panel) {
                closeSettings()
                return
            }
            if (g.controlsLocked) {
                showControls()
                return
            }

            if (g.centerTapPlayPause && tapZone === "center") {
                const nextPaused = !g.paused
                togglePlayPause()
                flashCenterTapFeedback(nextPaused)
                if (nextPaused) {
                    clearHideTimer()
                    setControlsVisible(true)
                } else {
                    setControlsVisible(false)
                }
                return
            }

            if (!seekZone) {
                handleSingleTap()
                return
            }

            const now = Date.now()
            if (pendingSideTap && pendingSideTap.zone === seekZone && (now - pendingSideTap.startedAt) <= DOUBLE_TAP_THRESHOLD) {
                clearPendingSideTap()
                handleDoubleTapSeek(seekZone)
                return
            }

            clearPendingSideTap()
            const nextPendingSideTap = {
                zone: seekZone,
                previousControlsVisible: g.controlsVisible,
                startedAt: now,
                timeout: null as ReturnType<typeof setTimeout> | null,
            }
            nextPendingSideTap.timeout = setTimeout(() => {
                const activePendingSideTap = pendingSideTapRef.current
                if (activePendingSideTap !== nextPendingSideTap) return

                pendingSideTapRef.current = null
                applyQueuedSideTap(activePendingSideTap.previousControlsVisible)
            }, DOUBLE_TAP_THRESHOLD)
            pendingSideTapRef.current = nextPendingSideTap
        },
        [applyQueuedSideTap, clearHideTimer, clearPendingSideTap, closeSettings, flashCenterTapFeedback, gRef, handleDoubleTapSeek, handleSingleTap,
            screenWidth, setControlsVisible, showControls, togglePlayPause])

    const handleLongPressStart = React.useCallback(() => {
            const g = gRef.current
            if (g.isPiPActive || g.controlsLocked || g.panel) return
            clearPendingSideTap()
            longPressActiveRef.current = true
            savedSpeedRef.current = g.speed
            controlsVisibleBeforeLongPressRef.current = g.controlsVisible
            setPlayerSpeed(g.longPressFastForwardSpeed)
            setIsFastForwarding(true)
            setControlsVisible(false)
            clearHideTimer()
        },
        [clearHideTimer, clearPendingSideTap, controlsVisibleBeforeLongPressRef, gRef, savedSpeedRef, setControlsVisible, setIsFastForwarding,
            setPlayerSpeed])

    const stopLongPressFastForward = React.useCallback(() => {
        if (!longPressActiveRef.current) return
        longPressActiveRef.current = false
        setPlayerSpeed(savedSpeedRef.current)
        setIsFastForwarding(false)
        if (controlsVisibleBeforeLongPressRef.current) showControls()
        else scheduleHide()
    }, [controlsVisibleBeforeLongPressRef, savedSpeedRef, scheduleHide, setIsFastForwarding, setPlayerSpeed, showControls])

    // compose gesture object

    const screenGesture = React.useMemo(() => {
        const tapGesture = Gesture.Tap()
            .numberOfTaps(1)
            .maxDuration(250)
            .maxDistance(TAP_GESTURE_MAX_DISTANCE)
            .shouldCancelWhenOutside(false)
            .onTouchesDown((event, manager) => {
                if (event.numberOfTouches > 1) {
                    manager.fail()
                    return
                }
                const x = getGestureTouchX(event)
                runOnJS(setTapStartX)(x)
            })
            .onEnd((e, success) => {
                if (!success) return
                runOnJS(handleTapGestureEnd)(e.x)
            })
            .onFinalize(() => {
                runOnJS(setTapStartX)(null)
            })

        const leftDoubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(250)
            .maxDelay(DOUBLE_TAP_THRESHOLD)
            .maxDistance(TAP_GESTURE_MAX_DISTANCE)
            .shouldCancelWhenOutside(false)
            .onTouchesDown((event, manager) => {
                if (event.numberOfTouches > 1) {
                    manager.fail()
                    return
                }
                const x = getGestureTouchX(event)
                if (x === null || getDoubleTapSeekZone(screenWidth, x) !== "left") {
                    manager.fail()
                    return
                }
                runOnJS(handleDoubleTapSeekStart)("left")
            })
            .onEnd((_event, success) => {
                if (!success) return
                runOnJS(handleDoubleTapSeek)("left")
            })

        const rightDoubleTap = Gesture.Tap()
            .numberOfTaps(2)
            .maxDuration(250)
            .maxDelay(DOUBLE_TAP_THRESHOLD)
            .maxDistance(TAP_GESTURE_MAX_DISTANCE)
            .shouldCancelWhenOutside(false)
            .onTouchesDown((event, manager) => {
                if (event.numberOfTouches > 1) {
                    manager.fail()
                    return
                }
                const x = getGestureTouchX(event)
                if (x === null || getDoubleTapSeekZone(screenWidth, x) !== "right") {
                    manager.fail()
                    return
                }
                runOnJS(handleDoubleTapSeekStart)("right")
            })
            .onEnd((_event, success) => {
                if (!success) return
                runOnJS(handleDoubleTapSeek)("right")
            })

        // long press
        const longPressGesture = Gesture.LongPress()
            .minDuration(LONG_PRESS_MIN_DURATION)
            .maxDistance(80)
            .shouldCancelWhenOutside(false)
            .onTouchesDown((event, manager) => {
                if (event.numberOfTouches > 1) manager.fail()
            })
            .onStart(() => { runOnJS(handleLongPressStart)() })
            .onEnd(() => { runOnJS(stopLongPressFastForward)() })
            .onFinalize(() => { runOnJS(stopLongPressFastForward)() })

        // pan (swipe seek + side adjust)
        const panGesture = Gesture.Pan()
            .maxPointers(1)
            .minDistance(Math.max(PAN_GESTURE_MIN_DISTANCE, SWIPE_ACTIVATION_THRESHOLD, SIDE_ADJUST_ACTIVATION_THRESHOLD))
            .onBegin((e) => {
                clearPendingSideTap()
                if (gRef.current.isPiPActive) {
                    swipeSeekingRef.current = null
                    panGestureModeRef.current = null
                    sideAdjustKindRef.current = null
                    return
                }

                swipeStartTimeRef.current = gRef.current.currentTime
                swipeActivatedRef.current = false
                swipeStartXRef.current = e.x
                panGestureModeRef.current = null
                sideAdjustActivatedRef.current = false
                sideAdjustStartYRef.current = e.y

                if (!gRef.current.sideSwipeBrightnessVolume || gRef.current.controlsLocked || gRef.current.panel) {
                    sideAdjustKindRef.current = null
                    return
                }

                const leftBoundary = screenWidth * SIDE_ADJUST_ZONE_RATIO
                const rightBoundary = screenWidth * (1 - SIDE_ADJUST_ZONE_RATIO)

                if (e.x <= leftBoundary) {
                    sideAdjustKindRef.current = "brightness"
                    sideAdjustStartValueRef.current = brightnessLevelRef.current
                } else if (e.x >= rightBoundary) {
                    sideAdjustKindRef.current = "volume"
                    sideAdjustStartValueRef.current = volumeLevelRef.current
                } else {
                    sideAdjustKindRef.current = null
                }
            })
            .onUpdate((e) => {
                if (gRef.current.isPiPActive || gRef.current.controlsLocked || gRef.current.panel) return

                const dx = e.x - swipeStartXRef.current
                const dy = e.y - sideAdjustStartYRef.current
                const absDx = Math.abs(dx)
                const absDy = Math.abs(dy)

                if (panGestureModeRef.current === null) {
                    const shouldSeek = absDx >= SWIPE_ACTIVATION_THRESHOLD
                        && absDx > absDy * GESTURE_DIRECTION_LOCK_RATIO
                    const shouldSideAdjust = sideAdjustKindRef.current !== null
                        && absDy >= SIDE_ADJUST_ACTIVATION_THRESHOLD
                        && absDy > absDx * GESTURE_DIRECTION_LOCK_RATIO

                    if (shouldSideAdjust) {
                        panGestureModeRef.current = "side-adjust"
                        sideAdjustActivatedRef.current = true
                    } else if (shouldSeek) {
                        panGestureModeRef.current = "seek"
                        swipeActivatedRef.current = true
                    } else {
                        return
                    }
                }

                if (panGestureModeRef.current === "seek") {
                    const newTime = Math.max(0, Math.min(gRef.current.duration, swipeStartTimeRef.current + dx * SWIPE_SEEK_SENSITIVITY))
                    const swipeState = { startTime: swipeStartTimeRef.current, currentTime: newTime }
                    swipeSeekingRef.current = swipeState
                    scheduleSwipeSeekingUpdate(swipeState)
                    return
                }

                if (panGestureModeRef.current === "side-adjust" && sideAdjustKindRef.current) {
                    const nextValue = clamp(
                        sideAdjustStartValueRef.current - (dy / Math.max(screenHeight * 0.65, 1)),
                        0, 1,
                    )
                    scheduleSideAdjustUpdate(sideAdjustKindRef.current, nextValue)
                }
            })
            .onEnd(() => {
                if (gRef.current.isPiPActive) {
                    swipeSeekingRef.current = null
                    scheduleSwipeSeekingUpdate(null)
                    swipeActivatedRef.current = false
                    panGestureModeRef.current = null
                    sideAdjustKindRef.current = null
                    sideAdjustActivatedRef.current = false
                    return
                }

                if (panGestureModeRef.current === "seek" && swipeSeekingRef.current) {
                    seekTo(swipeSeekingRef.current.currentTime, false)
                }
                if (panGestureModeRef.current === "side-adjust" && sideAdjustActivatedRef.current) {
                    scheduleSideAdjustHide()
                }

                swipeSeekingRef.current = null
                scheduleSwipeSeekingUpdate(null)
                swipeActivatedRef.current = false
                panGestureModeRef.current = null
                sideAdjustKindRef.current = null
                sideAdjustActivatedRef.current = false
                scheduleHide()
            })
            .onFinalize(() => {
                swipeSeekingRef.current = null
                scheduleSwipeSeekingUpdate(null)
                swipeActivatedRef.current = false
                sideAdjustKindRef.current = null
                if (sideAdjustActivatedRef.current) scheduleSideAdjustHide()
                sideAdjustActivatedRef.current = false
                panGestureModeRef.current = null
            })
            .runOnJS(true)

        // pinch (zoom)
        // zoom scale during the gesture and a fit/fill mode decision on release.
        const pinchGesture = Gesture.Pinch()
            .runOnJS(true)
            .onBegin(() => {
                clearPendingSideTap()
                if (gRef.current.isPiPActive) return
                clearHideTimer()
                pinchStartScaleRef.current = zoomScaleRef.current
            })
            .onUpdate((e) => {
                if (gRef.current.isPiPActive) return
                const maxScale = Math.max(1, fillZoomScale)
                const nextScale = pinchStartScaleRef.current * e.scale
                applyVideoZoom(Math.max(1, Math.min(maxScale, nextScale)))
            })
            .onEnd((e) => {
                if (gRef.current.isPiPActive) return
                const maxScale = Math.max(1, fillZoomScale)
                const finalScale = Math.max(1, Math.min(maxScale, pinchStartScaleRef.current * e.scale))
                applyVideoZoom(finalScale)
                applyZoomMode(finalScale > 1.01 ? "fill" : "fit")
            })

        return Gesture.Simultaneous(
            pinchGesture,
            Gesture.Race(longPressGesture, panGesture, Gesture.Simultaneous(leftDoubleTap, rightDoubleTap, tapGesture)),
        )
    }, [
        screenWidth, screenHeight, fillZoomScale,
        clearPendingSideTap, handleDoubleTapSeek, handleDoubleTapSeekStart, handleTapGestureEnd,
        handleLongPressStart, stopLongPressFastForward,
        clearHideTimer, scheduleHide, seekTo,
        applyVideoZoom, applyZoomMode, zoomScaleRef, pinchStartScaleRef,
        scheduleSideAdjustHide, scheduleSideAdjustUpdate, scheduleSwipeSeekingUpdate,
        gRef,
        swipeStartTimeRef, swipeActivatedRef, swipeStartXRef, swipeSeekingRef, panGestureModeRef,
        brightnessLevelRef, volumeLevelRef,
        sideAdjustKindRef, sideAdjustStartYRef, sideAdjustStartValueRef, sideAdjustActivatedRef,
        setTapStartX,
    ])

    return { screenGesture, handleSingleTap, flashCenterTapFeedback }
}
