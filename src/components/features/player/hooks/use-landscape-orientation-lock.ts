import { MpvPlayerModule } from "expo-mpv-player"
import * as ScreenOrientation from "expo-screen-orientation"
import { Accelerometer } from "expo-sensors"
import React from "react"
import { AppState, InteractionManager, Platform } from "react-native"

type UseLandscapeOrientationLockParams = {
    restoreLock?: ScreenOrientation.OrientationLock
}

const PORTRAIT_ORIENTATIONS = new Set<ScreenOrientation.Orientation>([
    ScreenOrientation.Orientation.PORTRAIT_DOWN,
    ScreenOrientation.Orientation.PORTRAIT_UP,
    ScreenOrientation.Orientation.UNKNOWN,
])

export function useLandscapeOrientationLock({
    restoreLock = ScreenOrientation.OrientationLock.PORTRAIT_UP,
}: UseLandscapeOrientationLockParams = {}) {
    const currentLockRef = React.useRef<ScreenOrientation.OrientationLock>(
        Platform.OS === "ios"
            ? ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT
            : ScreenOrientation.OrientationLock.LANDSCAPE,
    )

    React.useEffect(() => {
        let accelerometerSubscription: { remove: () => void } | null = null

        const lockNativeLandscape = () => {
            if (Platform.OS !== "ios") return

            try {
                MpvPlayerModule.lockLandscape()
            }
            catch {
            }
        }

        const unlockNativeOrientation = () => {
            if (Platform.OS !== "ios") return

            try {
                MpvPlayerModule.unlockOrientation()
            }
            catch {
            }
        }

        const lockLandscape = async (
            lockType: ScreenOrientation.OrientationLock = currentLockRef.current,
        ) => {
            try {
                lockNativeLandscape()
                await ScreenOrientation.lockAsync(lockType)
                currentLockRef.current = lockType
            }
            catch {
            }
        }

        void lockLandscape(currentLockRef.current)

        const orientationSubscription = Platform.OS === "ios"
            ? ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
                if (!PORTRAIT_ORIENTATIONS.has(orientationInfo.orientation)) return
                void lockLandscape(currentLockRef.current)
            })
            : null

        if (Platform.OS === "ios") {
            Accelerometer.setUpdateInterval(500)
            accelerometerSubscription = Accelerometer.addListener(({ x }) => {
                if (x > 0.6 && currentLockRef.current !== ScreenOrientation.OrientationLock.LANDSCAPE_LEFT) {
                    void lockLandscape(ScreenOrientation.OrientationLock.LANDSCAPE_LEFT)
                } else if (x < -0.6 && currentLockRef.current !== ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT) {
                    void lockLandscape(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT)
                }
            })
        }

        const appStateSubscription = AppState.addEventListener("change", nextState => {
            if (nextState === "active") {
                void lockLandscape(currentLockRef.current)
            }
        })

        return () => {
            accelerometerSubscription?.remove()
            orientationSubscription?.remove()
            appStateSubscription.remove()
            unlockNativeOrientation()

            requestAnimationFrame(() => {
                InteractionManager.runAfterInteractions(() => {
                    void ScreenOrientation.lockAsync(restoreLock)
                })
            })
        }
    }, [restoreLock])
}
