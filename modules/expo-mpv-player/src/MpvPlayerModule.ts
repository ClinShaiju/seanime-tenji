import { requireNativeModule } from "expo-modules-core"

type ExpoMpvPlayerModuleType = {
    lockLandscape: () => void
    unlockOrientation: () => void
}

export const MpvPlayerModule = requireNativeModule<ExpoMpvPlayerModuleType>("ExpoMpvPlayer")
