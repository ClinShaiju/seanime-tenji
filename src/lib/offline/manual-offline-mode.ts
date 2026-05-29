import { createAtomStorage, getStoredJsonValue } from "@/atoms/storage"
import { atomWithStorage } from "jotai/utils"

export const MANUAL_OFFLINE_MODE_STORAGE_KEY = "seanime-manual-offline-mode"

export const manualOfflineModeAtom = atomWithStorage<boolean>(
    MANUAL_OFFLINE_MODE_STORAGE_KEY,
    false,
    createAtomStorage<boolean>(),
    { getOnInit: true },
)

export function getStoredManualOfflineMode(): boolean {
    return getStoredJsonValue<boolean>(MANUAL_OFFLINE_MODE_STORAGE_KEY) ?? false
}