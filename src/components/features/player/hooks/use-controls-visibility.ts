import React from "react"
import { CONTROLS_HIDE_DELAY, LOCKED_CONTROLS_HIDE_DELAY } from "../constants"
import type { GestureRefs } from "../types"

export function useControlsVisibility(gRef: React.RefObject<GestureRefs>) {
    const [controlsVisibleState, setControlsVisibleState] = React.useState(true)
    const [controlsLocked, setControlsLocked] = React.useState(false)
    const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const hideTimerVersion = React.useRef(0)
    const controlsVisibleRef = React.useRef(true)

    const setControlsVisible = React.useCallback((next: React.SetStateAction<boolean>) => {
        setControlsVisibleState(current => {
            const resolved = typeof next === "function" ? next(current) : next
            controlsVisibleRef.current = resolved
            return current === resolved ? current : resolved
        })
    }, [])

    const clearHideTimer = React.useCallback(() => {
        hideTimerVersion.current += 1
        if (hideTimer.current) {
            clearTimeout(hideTimer.current)
            hideTimer.current = null
        }
    }, [])

    const scheduleHide = React.useCallback(() => {
        clearHideTimer()
        const { paused, controlsLocked: locked } = gRef.current
        if (paused) return

        const delay = locked ? LOCKED_CONTROLS_HIDE_DELAY : CONTROLS_HIDE_DELAY
        const version = hideTimerVersion.current
        hideTimer.current = setTimeout(() => {
            if (hideTimerVersion.current !== version) return
            hideTimer.current = null
            setControlsVisible(false)
        }, delay)
    }, [clearHideTimer, gRef, setControlsVisible])

    const showControls = React.useCallback(() => {
        setControlsVisible(true)
        scheduleHide()
    }, [scheduleHide, setControlsVisible])

    const hideControls = React.useCallback(() => {
        clearHideTimer()
        setControlsVisible(false)
    }, [clearHideTimer, setControlsVisible])

    const toggleControls = React.useCallback(() => {
        if (controlsVisibleRef.current) {
            hideControls()
        } else {
            clearHideTimer()
            setControlsVisible(true)
        }
    }, [clearHideTimer, hideControls, setControlsVisible])

    // auto show/hide when play state changes
    const syncWithPaused = React.useCallback((paused: boolean) => {
        if (paused) {
            clearHideTimer()
            setControlsVisible(true)
            return
        }

        if (controlsVisibleRef.current) {
            scheduleHide()
        }
    }, [clearHideTimer, scheduleHide, setControlsVisible])

    // cleanup on unmount
    React.useEffect(() => clearHideTimer, [clearHideTimer])

    const handleUnlockScreen = React.useCallback(() => {
        setControlsLocked(false)
        setControlsVisible(true)
        if (!gRef.current.paused) {
            scheduleHide()
        } else {
            clearHideTimer()
        }
    }, [clearHideTimer, gRef, scheduleHide, setControlsVisible])

    const lockScreen = React.useCallback(() => {
        setControlsLocked(true)
        hideControls()
    }, [hideControls])

    return {
        controlsVisible: controlsVisibleState,
        setControlsVisible,
        controlsLocked,
        setControlsLocked,
        clearHideTimer,
        scheduleHide,
        showControls,
        hideControls,
        toggleControls,
        syncWithPaused,
        handleUnlockScreen,
        lockScreen,
        hideTimer,
    }
}
