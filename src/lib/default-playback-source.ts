import type { Status } from "@/api/generated/types"

type SettingsWithLibrary = NonNullable<Status["settings"]>
type LibrarySettingsWithDefaultPlaybackSource = NonNullable<SettingsWithLibrary["library"]> & {
    defaultPlaybackSource?: string
}

export function getDefaultPlaybackSource(serverStatus: Status | null | undefined): string {
    const librarySettings = serverStatus?.settings?.library as LibrarySettingsWithDefaultPlaybackSource | undefined
    const source = librarySettings?.defaultPlaybackSource

    if (!source || source === "-") return ""

    return source
}

export function isPluginPlaybackSource(source: string): boolean {
    return source.startsWith("ext:") || source.startsWith("episodeTab:")
}