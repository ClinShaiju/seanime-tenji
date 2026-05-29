import { requireOptionalNativeModule } from "expo-modules-core"
import type { ExpoOfflineLoggerModuleType } from "./ExpoOfflineLogger.types"

const ExpoOfflineLoggerModule = requireOptionalNativeModule<ExpoOfflineLoggerModuleType>("ExpoOfflineLogger")

export default ExpoOfflineLoggerModule