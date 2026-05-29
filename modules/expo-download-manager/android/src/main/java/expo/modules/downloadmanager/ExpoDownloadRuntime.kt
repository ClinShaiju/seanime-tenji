/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Inspired by and/or derived from Streamyfin (https://github.com/streamyfin/streamyfin).
 * Copyright (c) the original authors and Seanime Tenji contributors.
 */

package expo.modules.downloadmanager

import android.content.Context
import android.net.Uri
import android.os.Build
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Dispatcher
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

interface ExpoDownloadEventSink {
    fun emitDownloadEvent(eventName: String, payload: Map<String, Any?>)
}

data class ExpoDownloadRequest(
    val id: String,
    val url: String,
    val destinationPath: String,
    val headers: Map<String, String>,
    val title: String?
)

object ExpoDownloadRuntime {
    private const val TAG = "ExpoDownloadManager"
    private const val PROGRESS_INTERVAL_MS = 500L

    private val taskIdCounter = AtomicInteger(1)
    private val dispatcher = Dispatcher().apply {
        maxRequests = 4
        maxRequestsPerHost = 4
    }
    private val client = OkHttpClient.Builder()
        .dispatcher(dispatcher)
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .callTimeout(0, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private val eventSinks = CopyOnWriteArraySet<ExpoDownloadEventSink>()
    private val activeCalls = ConcurrentHashMap<Int, Call>()
    private val activeRequests = ConcurrentHashMap<Int, ExpoDownloadRequest>()
    private val taskIdsByDownloadId = ConcurrentHashMap<String, Int>()

    fun addSink(sink: ExpoDownloadEventSink) {
        eventSinks.add(sink)
    }

    fun removeSink(sink: ExpoDownloadEventSink) {
        eventSinks.remove(sink)
    }

    fun start(context: Context, request: ExpoDownloadRequest): Int {
        taskIdsByDownloadId[request.id]?.let { existingTaskId ->
            return existingTaskId
        }

        val taskId = taskIdCounter.getAndIncrement()
        val destinationFile = File(resolveDestinationPath(request.destinationPath))
        val temporaryFile = File("${destinationFile.absolutePath}.part")
        destinationFile.parentFile?.mkdirs()

        val httpRequestBuilder = Request.Builder().url(request.url)
        for ((key, value) in request.headers) {
            httpRequestBuilder.header(key, value)
        }

        val call = client.newCall(httpRequestBuilder.build())
        activeCalls[taskId] = call
        activeRequests[taskId] = request
        taskIdsByDownloadId[request.id] = taskId

        ExpoDownloadService.ensureRunning(context.applicationContext)
        ExpoDownloadService.updateProgress(
            context.applicationContext,
            request.title ?: "Downloading",
            0,
            activeRequests.size
        )

        emit("onDownloadStarted", startedPayload(taskId, request))

        call.enqueue(object : Callback {
            override fun onFailure(call: Call, error: IOException) {
                val wasCancelled = call.isCanceled()
                if (!wasCancelled) {
                    Log.e(TAG, "Download failed: ${request.id}: ${error.message}")
                }
                finishWithError(context.applicationContext, taskId, error.message ?: "Download failed", wasCancelled)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use { scopedResponse ->
                    if (!scopedResponse.isSuccessful) {
                        finishWithError(
                            context.applicationContext,
                            taskId,
                            "HTTP ${scopedResponse.code}: ${scopedResponse.message}",
                            false
                        )
                        return
                    }

                    val body = scopedResponse.body
                    if (body == null) {
                        finishWithError(context.applicationContext, taskId, "Download response was empty", false)
                        return
                    }

                    try {
                        if (temporaryFile.exists()) {
                            temporaryFile.delete()
                        }
                        destinationFile.parentFile?.mkdirs()

                        val totalBytes = body.contentLength()
                        var bytesWritten = 0L
                        var lastProgressAt = 0L
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)

                        body.byteStream().use { input ->
                            temporaryFile.outputStream().use { output ->
                                while (true) {
                                    if (call.isCanceled()) {
                                        temporaryFile.delete()
                                        finishWithError(context.applicationContext, taskId, "Download cancelled", true)
                                        return
                                    }

                                    val bytesRead = input.read(buffer)
                                    if (bytesRead == -1) break

                                    output.write(buffer, 0, bytesRead)
                                    bytesWritten += bytesRead

                                    val now = System.currentTimeMillis()
                                    if (now - lastProgressAt >= PROGRESS_INTERVAL_MS) {
                                        emitProgress(context.applicationContext, taskId, request, bytesWritten, totalBytes)
                                        lastProgressAt = now
                                    }
                                }
                            }
                        }

                        if (destinationFile.exists()) {
                            destinationFile.delete()
                        }
                        if (!temporaryFile.renameTo(destinationFile)) {
                            temporaryFile.copyTo(destinationFile, overwrite = true)
                            temporaryFile.delete()
                        }

                        emitProgress(context.applicationContext, taskId, request, bytesWritten, totalBytes)
                        emit(
                            "onDownloadComplete", mapOf(
                                "id" to request.id,
                                "taskId" to taskId,
                                "url" to request.url,
                                "filePath" to request.destinationPath
                            )
                        )
                        finishTask(context.applicationContext, taskId)
                    } catch (error: Exception) {
                        temporaryFile.delete()
                        val wasCancelled = call.isCanceled()
                        finishWithError(context.applicationContext, taskId, error.message ?: "Download failed", wasCancelled)
                    }
                }
            }
        })

        return taskId
    }

    fun cancelDownload(taskId: Int) {
        val request = activeRequests[taskId]
        if (request != null) {
            val destinationFile = File(resolveDestinationPath(request.destinationPath))
            File("${destinationFile.absolutePath}.part").delete()
            destinationFile.delete()
        }
        activeCalls[taskId]?.cancel()
        finishTask(null, taskId)
    }

    fun cancelDownloadById(id: String) {
        val taskId = taskIdsByDownloadId[id] ?: return
        cancelDownload(taskId)
    }

    fun cancelAllDownloads() {
        for (taskId in activeRequests.keys) {
            cancelDownload(taskId)
        }
    }

    fun getActiveDownloads(): List<Map<String, Any?>> {
        return activeRequests.map { (taskId, request) ->
            mapOf(
                "id" to request.id,
                "taskId" to taskId,
                "url" to request.url,
                "destinationPath" to request.destinationPath,
                "state" to "running"
            )
        }
    }

    private fun emitProgress(context: Context, taskId: Int, request: ExpoDownloadRequest, bytesWritten: Long, totalBytes: Long) {
        val progress = if (totalBytes > 0) {
            bytesWritten.toDouble() / totalBytes.toDouble()
        } else {
            0.0
        }

        ExpoDownloadService.updateProgress(
            context,
            request.title ?: "Downloading",
            (progress * 100).toInt().coerceIn(0, 100),
            activeRequests.size
        )

        emit(
            "onDownloadProgress", mapOf(
                "id" to request.id,
                "taskId" to taskId,
                "url" to request.url,
                "bytesWritten" to bytesWritten,
                "totalBytes" to totalBytes,
                "progress" to progress
            )
        )
    }

    private fun finishWithError(context: Context?, taskId: Int, error: String, wasCancelled: Boolean) {
        val request = activeRequests[taskId]
        if (request != null && !wasCancelled) {
            emit(
                "onDownloadError", mapOf(
                    "id" to request.id,
                    "taskId" to taskId,
                    "url" to request.url,
                    "error" to error
                )
            )
        }
        finishTask(context, taskId)
    }

    private fun finishTask(context: Context?, taskId: Int) {
        val request = activeRequests.remove(taskId)
        if (request != null) {
            taskIdsByDownloadId.remove(request.id)
        }
        activeCalls.remove(taskId)

        if (context != null) {
            ExpoDownloadService.stopIfIdle(context, activeRequests.size)
        }
    }

    private fun startedPayload(taskId: Int, request: ExpoDownloadRequest): Map<String, Any?> {
        return mapOf(
            "id" to request.id,
            "taskId" to taskId,
            "url" to request.url
        )
    }

    private fun emit(eventName: String, payload: Map<String, Any?>) {
        for (sink in eventSinks) {
            sink.emitDownloadEvent(eventName, payload)
        }
    }

    private fun resolveDestinationPath(destinationPath: String): String {
        if (!destinationPath.startsWith("file://")) return destinationPath

        val parsedPath = Uri.parse(destinationPath).path
        if (parsedPath != null) return parsedPath

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            java.net.URI.create(destinationPath).path
        } else {
            destinationPath.removePrefix("file://")
        }
    }
}
