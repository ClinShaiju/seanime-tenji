import ExpoExternalPlayerModule from "./ExpoExternalPlayerModule"

export type { ExpoExternalPlayerModuleType } from "./ExpoExternalPlayer.types"

export const ExpoExternalPlayer = {
    open(url: string, packageName: string | null): Promise<boolean> {
        return ExpoExternalPlayerModule?.open(url, packageName) ?? Promise.resolve(false)
    },
}

export default ExpoExternalPlayer
