/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Inspired by and/or derived from Streamyfin (https://github.com/streamyfin/streamyfin).
 * Copyright (c) the original authors and Seanime Tenji contributors.
 */

import type { EventSubscription } from "expo-modules-core"
import type {
    ActiveDownload,
    DownloadCompleteEvent,
    DownloadErrorEvent,
    DownloadProgressEvent,
    DownloadRequest,
    DownloadStartedEvent,
} from "./ExpoDownloadManager.types"
import ExpoDownloadManagerModule from "./ExpoDownloadManagerModule"

export type {
    ActiveDownload,
    DownloadCompleteEvent,
    DownloadErrorEvent,
    DownloadHeaders,
    DownloadProgressEvent,
    DownloadRequest,
    DownloadStartedEvent,
} from "./ExpoDownloadManager.types"

export const ExpoDownloadManager = {
    startDownload(request: DownloadRequest): Promise<number> {
        return ExpoDownloadManagerModule.startDownload(
            request.id,
            request.url,
            request.destinationPath,
            request.headers ?? null,
            request.title ?? null,
        )
    },

    cancelDownload(taskId: number): void {
        ExpoDownloadManagerModule.cancelDownload(taskId)
    },

    cancelDownloadById(id: string): void {
        ExpoDownloadManagerModule.cancelDownloadById(id)
    },

    cancelAllDownloads(): void {
        ExpoDownloadManagerModule.cancelAllDownloads()
    },

    getActiveDownloads(): Promise<ActiveDownload[]> {
        return ExpoDownloadManagerModule.getActiveDownloads()
    },

    addProgressListener(listener: (event: DownloadProgressEvent) => void): EventSubscription {
        return ExpoDownloadManagerModule.addListener("onDownloadProgress", listener)
    },

    addCompleteListener(listener: (event: DownloadCompleteEvent) => void): EventSubscription {
        return ExpoDownloadManagerModule.addListener("onDownloadComplete", listener)
    },

    addErrorListener(listener: (event: DownloadErrorEvent) => void): EventSubscription {
        return ExpoDownloadManagerModule.addListener("onDownloadError", listener)
    },

    addStartedListener(listener: (event: DownloadStartedEvent) => void): EventSubscription {
        return ExpoDownloadManagerModule.addListener("onDownloadStarted", listener)
    },
}

export default ExpoDownloadManager
