import { recordOfflineLog } from "@/lib/offline-logger"

export const logger = (prefix: string) => {
    return {
        info: (...data: unknown[]) => {
            recordOfflineLog("info", prefix, data, __DEV__)
        },
        warning: (...data: unknown[]) => {
            recordOfflineLog("warning", prefix, data, __DEV__)
        },
        success: (...data: unknown[]) => {
            recordOfflineLog("success", prefix, data, __DEV__)
        },
        error: (...data: unknown[]) => {
            recordOfflineLog("error", prefix, data, __DEV__)
        },
    }
}
