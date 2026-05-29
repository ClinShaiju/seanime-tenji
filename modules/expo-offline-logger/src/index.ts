import ExpoOfflineLoggerModule from "./ExpoOfflineLoggerModule"

export type { ExpoOfflineLoggerModuleType } from "./ExpoOfflineLogger.types"

export const ExpoOfflineLogger = {
    install(): boolean {
        return ExpoOfflineLoggerModule?.install() ?? false
    },

    append(entryJson: string): void {
        ExpoOfflineLoggerModule?.append(entryJson)
    },

    readNativeLogs(): Promise<string | null> {
        return ExpoOfflineLoggerModule?.readNativeLogs() ?? Promise.resolve(null)
    },

    getLastNativeCrash(): Promise<string | null> {
        return ExpoOfflineLoggerModule?.getLastNativeCrash() ?? Promise.resolve(null)
    },

    clear(): void {
        ExpoOfflineLoggerModule?.clear()
    },

    clearLastNativeCrash(): void {
        ExpoOfflineLoggerModule?.clearLastNativeCrash()
    },

    copyToClipboard(text: string): boolean {
        return ExpoOfflineLoggerModule?.copyToClipboard(text) ?? false
    },
}

export default ExpoOfflineLogger