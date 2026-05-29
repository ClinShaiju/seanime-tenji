import { requireNativeModule } from "expo-modules-core"
import type { ExpoDownloadManagerModuleType } from "./ExpoDownloadManager.types"

const ExpoDownloadManagerModule = requireNativeModule<ExpoDownloadManagerModuleType>("ExpoDownloadManager")

export default ExpoDownloadManagerModule
