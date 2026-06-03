import { requireNativeModule } from "expo-modules-core"

type ExpoMpvPlayerModuleType = {
    lockLandscape: () => void
    unlockOrientation: () => void
    setWindowBrightness: (brightness: number) => void
}

export const MpvPlayerModule = requireNativeModule<ExpoMpvPlayerModuleType>("ExpoMpvPlayer")
