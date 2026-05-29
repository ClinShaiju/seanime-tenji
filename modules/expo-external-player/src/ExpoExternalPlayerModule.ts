import { requireOptionalNativeModule } from "expo-modules-core"
import type { ExpoExternalPlayerModuleType } from "./ExpoExternalPlayer.types"

const ExpoExternalPlayerModule = requireOptionalNativeModule<ExpoExternalPlayerModuleType>("ExpoExternalPlayer")

export default ExpoExternalPlayerModule
