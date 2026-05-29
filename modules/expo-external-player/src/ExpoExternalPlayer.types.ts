export type ExpoExternalPlayerModuleType = {
    open(url: string, packageName: string | null): Promise<boolean>
}
