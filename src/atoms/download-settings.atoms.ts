import { createAtomStorage, getStoredJsonValue } from "@/atoms/storage"
import NetInfo from "@react-native-community/netinfo"
import { atomWithStorage } from "jotai/utils"

export type DownloadSettings = {
    wifiOnly: boolean
    backgroundDownloading: boolean
    parallelDownloading: boolean
}

const DOWNLOAD_SETTINGS_STORAGE_KEY = "sea-download-settings"

const defaultDownloadSettings: DownloadSettings = {
    wifiOnly: false,
    backgroundDownloading: true,
    parallelDownloading: true,
}

export const downloadSettingsAtom = atomWithStorage<DownloadSettings>(
    DOWNLOAD_SETTINGS_STORAGE_KEY,
    defaultDownloadSettings,
    createAtomStorage<DownloadSettings>(),
    { getOnInit: true },
)

export function getDownloadSettings(): DownloadSettings {
    return {
        ...defaultDownloadSettings,
        ...getStoredJsonValue<Partial<DownloadSettings>>(DOWNLOAD_SETTINGS_STORAGE_KEY),
    }
}

export function getDownloadWorkerCount(): number {
    return getDownloadSettings().parallelDownloading ? 3 : 1
}

export async function getDownloadNetworkBlockReason(): Promise<string | null> {
    if (!getDownloadSettings().wifiOnly) return null

    const state = await NetInfo.fetch()
    if (!state.isConnected) return "No network connection"
    if (state.type === "wifi" || state.type === "ethernet") return null

    return "Only download on Wi-Fi is enabled"
}
