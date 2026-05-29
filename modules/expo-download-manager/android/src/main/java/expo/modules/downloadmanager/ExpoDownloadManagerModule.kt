/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Inspired by and/or derived from Streamyfin (https://github.com/streamyfin/streamyfin).
 * Copyright (c) the original authors and Seanime Tenji contributors.
 */

package expo.modules.downloadmanager

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoDownloadManagerModule : Module(), ExpoDownloadEventSink {
    private val context
        get() = requireNotNull(appContext.reactContext)

    override fun definition() = ModuleDefinition {
        Name("ExpoDownloadManager")

        Events(
            "onDownloadProgress",
            "onDownloadComplete",
            "onDownloadError",
            "onDownloadStarted"
        )

        OnCreate {
            ExpoDownloadRuntime.addSink(this@ExpoDownloadManagerModule)
        }

        OnDestroy {
            ExpoDownloadRuntime.removeSink(this@ExpoDownloadManagerModule)
        }

        AsyncFunction("startDownload") { id: String, url: String, destinationPath: String, headers: Map<String, String>?, title: String?, promise: Promise ->
            try {
                val taskId = ExpoDownloadRuntime.start(
                    context,
                    ExpoDownloadRequest(
                        id = id,
                        url = url,
                        destinationPath = destinationPath,
                        headers = headers ?: emptyMap(),
                        title = title
                    )
                )
                promise.resolve(taskId)
            } catch (error: Exception) {
                promise.reject("DOWNLOAD_START_FAILED", error.message ?: "Failed to start download", error)
            }
        }

        Function("cancelDownload") { taskId: Int ->
            ExpoDownloadRuntime.cancelDownload(taskId)
        }

        Function("cancelDownloadById") { id: String ->
            ExpoDownloadRuntime.cancelDownloadById(id)
        }

        Function("cancelAllDownloads") {
            ExpoDownloadRuntime.cancelAllDownloads()
        }

        AsyncFunction("getActiveDownloads") { promise: Promise ->
            promise.resolve(ExpoDownloadRuntime.getActiveDownloads())
        }
    }

    override fun emitDownloadEvent(eventName: String, payload: Map<String, Any?>) {
        sendEvent(eventName, payload)
    }
}
