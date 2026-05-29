import type { EventSubscription } from "expo-modules-core"

export type DownloadHeaders = Record<string, string>

export type DownloadRequest = {
    id: string
    url: string
    destinationPath: string
    headers?: DownloadHeaders
    title?: string
}

export type DownloadProgressEvent = {
    id: string
    taskId: number
    url: string
    bytesWritten: number
    totalBytes: number
    progress: number
}

export type DownloadCompleteEvent = {
    id: string
    taskId: number
    url: string
    filePath: string
}

export type DownloadErrorEvent = {
    id: string
    taskId: number
    url: string
    error: string
}

export type DownloadStartedEvent = {
    id: string
    taskId: number
    url: string
}

export type ActiveDownload = {
    id: string
    taskId: number
    url: string
    destinationPath: string
    state: "running" | "suspended" | "canceling" | "completed" | "unknown"
}

export type DownloadEventName = "onDownloadProgress" | "onDownloadComplete" | "onDownloadError" | "onDownloadStarted"

export type DownloadManagerEvent = DownloadProgressEvent | DownloadCompleteEvent | DownloadErrorEvent | DownloadStartedEvent

export type ExpoDownloadManagerModuleType = {
    startDownload(
        id: string,
        url: string,
        destinationPath: string,
        headers?: DownloadHeaders | null,
        title?: string | null,
    ): Promise<number>
    cancelDownload(taskId: number): void
    cancelDownloadById(id: string): void
    cancelAllDownloads(): void
    getActiveDownloads(): Promise<ActiveDownload[]>
    addListener(eventName: "onDownloadProgress", listener: (event: DownloadProgressEvent) => void): EventSubscription
    addListener(eventName: "onDownloadComplete", listener: (event: DownloadCompleteEvent) => void): EventSubscription
    addListener(eventName: "onDownloadError", listener: (event: DownloadErrorEvent) => void): EventSubscription
    addListener(eventName: "onDownloadStarted", listener: (event: DownloadStartedEvent) => void): EventSubscription
}
