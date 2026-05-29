import ExpoDownloadManager, {
    type ActiveDownload,
    type DownloadCompleteEvent,
    type DownloadErrorEvent,
    type DownloadHeaders,
    type DownloadProgressEvent,
} from "expo-download-manager"
import type { EventSubscription } from "expo-modules-core"

export type ManagedNativeDownloadOptions = {
    id: string
    url: string
    destinationPath: string
    headers?: DownloadHeaders
    title?: string
    onProgress?: (event: DownloadProgressEvent) => void
}

export type ManagedNativeDownloadResult = {
    id: string
    taskId: number
    filePath: string
}

type PendingNativeDownload = {
    taskId?: number
    onProgress?: (event: DownloadProgressEvent) => void
    resolve: (result: ManagedNativeDownloadResult) => void
    reject: (error: Error) => void
}

export class NativeDownloadCancelledError extends Error {
    constructor(id: string) {
        super(`Download cancelled: ${id}`)
        this.name = "NativeDownloadCancelledError"
    }
}

const pendingDownloads = new Map<string, PendingNativeDownload>()
let subscriptions: EventSubscription[] | undefined

function ensureNativeDownloadListeners(): void {
    if (subscriptions) return

    subscriptions = [
        ExpoDownloadManager.addProgressListener(handleProgress),
        ExpoDownloadManager.addCompleteListener(handleComplete),
        ExpoDownloadManager.addErrorListener(handleError),
    ]
}

function handleProgress(event: DownloadProgressEvent): void {
    pendingDownloads.get(event.id)?.onProgress?.(event)
}

function handleComplete(event: DownloadCompleteEvent): void {
    const pending = pendingDownloads.get(event.id)
    if (!pending) return

    pendingDownloads.delete(event.id)
    pending.resolve({
        id: event.id,
        taskId: event.taskId,
        filePath: event.filePath,
    })
}

function handleError(event: DownloadErrorEvent): void {
    const pending = pendingDownloads.get(event.id)
    if (!pending) return

    pendingDownloads.delete(event.id)
    pending.reject(new Error(event.error))
}

export function startManagedNativeDownload(options: ManagedNativeDownloadOptions): Promise<ManagedNativeDownloadResult> {
    ensureNativeDownloadListeners()
    return toPendingNativeDownload(options, true)
}

export function attachManagedNativeDownload(options: ManagedNativeDownloadOptions): Promise<ManagedNativeDownloadResult> {
    ensureNativeDownloadListeners()
    return toPendingNativeDownload(options, false)
}

function toPendingNativeDownload(
    options: ManagedNativeDownloadOptions,
    shouldStart: boolean,
): Promise<ManagedNativeDownloadResult> {
    ensureNativeDownloadListeners()

    const existing = pendingDownloads.get(options.id)
    if (existing) {
        return new Promise((resolve, reject) => {
            const previousResolve = existing.resolve
            const previousReject = existing.reject
            existing.resolve = (result) => {
                previousResolve(result)
                resolve(result)
            }
            existing.reject = (error) => {
                previousReject(error)
                reject(error)
            }
        })
    }

    return new Promise((resolve, reject) => {
        pendingDownloads.set(options.id, {
            onProgress: options.onProgress,
            resolve,
            reject,
        })

        if (!shouldStart) {
            return
        }

        ExpoDownloadManager.startDownload({
            id: options.id,
            url: options.url,
            destinationPath: options.destinationPath,
            headers: options.headers,
            title: options.title,
        }).then(taskId => {
            const pending = pendingDownloads.get(options.id)
            if (pending) {
                pending.taskId = taskId
            }
        }).catch(error => {
            pendingDownloads.delete(options.id)
            reject(error instanceof Error ? error : new Error(String(error)))
        })
    })
}

export async function getManagedNativeDownload(id: string): Promise<ActiveDownload | undefined> {
    const activeDownloads = await ExpoDownloadManager.getActiveDownloads()
    return activeDownloads.find(download => download.id === id)
}

export function cancelManagedNativeDownload(id: string): void {
    const pending = pendingDownloads.get(id)
    if (pending) {
        pendingDownloads.delete(id)
        pending.reject(new NativeDownloadCancelledError(id))
    }

    ExpoDownloadManager.cancelDownloadById(id)
}

export function isNativeDownloadCancelledError(error: unknown): error is NativeDownloadCancelledError {
    return error instanceof NativeDownloadCancelledError
}
