/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Inspired by and/or derived from Streamyfin (https://github.com/streamyfin/streamyfin)
 * and Findroid (https://github.com/findroid/findroid).
 * Copyright (c) the original authors and Seanime Tenji contributors.
 */

package expo.modules.mpvplayer

import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.SurfaceHolder
import android.view.SurfaceView
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

private const val TAG = "MpvPlayerView"

data class VideoLoadConfig(
    val url: String,
    val headers: Map<String, String>? = null,
    val externalSubtitles: List<Pair<String, String?>>? = null,
    val startPosition: Double? = null,
    val autoplay: Boolean = true
)

class MpvPlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext),
    MPVLayerRenderer.Delegate, SurfaceHolder.Callback, PiPController.Delegate {

    // event dispatchers
    val onLoad by EventDispatcher()
    val onPlaybackStateChange by EventDispatcher()
    val onProgress by EventDispatcher()
    val onError by EventDispatcher()
    val onTracksReady by EventDispatcher()

    private val surfaceView: SurfaceView
    private var renderer: MPVLayerRenderer? = null
    private var pipController: PiPController? = null

    // state
    private var currentUrl: String? = null
    private var cachedPosition: Double = 0.0
    private var cachedDuration: Double = 0.0
    private var intendedPlayState: Boolean = false
    private var surfaceReady: Boolean = false
    private var pendingConfig: VideoLoadConfig? = null
    private var _isZoomedToFill: Boolean = false
    private var dispatchedPiPActive: Boolean = false
    private var dispatchedPaused: Boolean? = null

    init {
        setBackgroundColor(Color.BLACK)

        surfaceView = SurfaceView(context)
        addView(
            surfaceView, ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        surfaceView.holder.addCallback(this)

        renderer = MPVLayerRenderer(context).also {
            it.delegate = this
            it.start()
        }

        pipController = PiPController(context, appContext).also {
            it.setPlayerView(surfaceView)
            it.delegate = this
        }
    }

    // -------------------------------------------------------------------
    // SurfaceHolder.Callback
    // -------------------------------------------------------------------

    override fun surfaceCreated(holder: SurfaceHolder) {
        Log.d(TAG, "surface created")
        surfaceReady = true
        renderer?.attachSurface(holder.surface)

        // if a load was requested before the surface was ready, execute it now
        pendingConfig?.let { config ->
            pendingConfig = null
            loadVideoInternal(config)
        }
    }

    override fun surfaceChanged(holder: SurfaceHolder, format: Int, width: Int, height: Int) {
        Log.d(TAG, "surface changed: ${width}x${height}")
        renderer?.updateSurfaceSize(width, height)
        pipController?.refreshPiPParams()
    }

    override fun surfaceDestroyed(holder: SurfaceHolder) {
        Log.d(TAG, "surface destroyed")
        surfaceReady = false
        renderer?.detachSurface()
    }

    // -------------------------------------------------------------------
    // Video loading
    // -------------------------------------------------------------------

    fun loadVideo(config: VideoLoadConfig) {
        // skip if same URL is already playing
        if (config.url == currentUrl) return

        if (!surfaceReady) {
            pendingConfig = config
            return
        }

        loadVideoInternal(config)
    }

    private fun loadVideoInternal(config: VideoLoadConfig) {
        currentUrl = config.url
        cachedPosition = 0.0
        cachedDuration = 0.0
        dispatchedPaused = null

        renderer?.load(
            url = config.url,
            headers = config.headers,
            startPosition = config.startPosition,
            externalSubtitles = config.externalSubtitles
        )

        if (config.autoplay) {
            play()
        }

        onLoad(mapOf("url" to config.url))
    }

    // -------------------------------------------------------------------
    // Playback controls
    // -------------------------------------------------------------------

    fun play() {
        intendedPlayState = true
        renderer?.play()
        pipController?.setPlaybackRate(1.0)
        dispatchPauseState(false)
    }

    fun pause() {
        intendedPlayState = false
        renderer?.pause()
        pipController?.setPlaybackRate(0.0)
        dispatchPauseState(true)
    }

    fun seekTo(position: Double) {
        cachedPosition = position
        renderer?.seekTo(position)
    }

    fun seekBy(offset: Double) {
        renderer?.seekBy(offset)
    }

    fun setSpeed(speed: Double) {
        renderer?.setSpeed(speed)
    }

    fun getSpeed(): Double {
        return renderer?.getSpeed() ?: 1.0
    }

    fun isPaused(): Boolean {
        return renderer?.isPaused ?: true
    }

    fun getCurrentPosition(): Double {
        return renderer?.cachedPosition ?: cachedPosition
    }

    fun getDuration(): Double {
        return renderer?.cachedDuration ?: cachedDuration
    }

    // -------------------------------------------------------------------
    // PiP
    // -------------------------------------------------------------------

    fun startPictureInPicture(): Boolean {
        renderer?.updateSurfaceSize(surfaceView.width, surfaceView.height)
        pipController?.refreshPiPParams()

        val started = pipController?.startPiP() == true
        dispatchPictureInPictureState(started || isPictureInPictureActive())
        return started
    }

    fun stopPictureInPicture() {
        pipController?.stopPiP()
    }

    fun isPictureInPictureSupported(): Boolean {
        return pipController?.isPiPSupported() ?: false
    }

    fun isPictureInPictureActive(): Boolean {
        return pipController?.isPiPActive() ?: false
    }

    fun dispatchPictureInPictureState(active: Boolean) {
        if (dispatchedPiPActive == active) return
        dispatchedPiPActive = active
        onPlaybackStateChange(mapOf("isPiPActive" to active))
    }

    // -------------------------------------------------------------------
    // Subtitle controls
    // -------------------------------------------------------------------

    fun getSubtitleTracks(): List<Map<String, Any>> {
        return renderer?.getSubtitleTracks() ?: emptyList()
    }

    fun getChapters(): List<Map<String, Any>> {
        return renderer?.getChapters() ?: emptyList()
    }

    fun setSubtitleTrack(trackId: Int) {
        renderer?.setSubtitleTrack(trackId)
    }

    fun disableSubtitles() {
        renderer?.disableSubtitles()
    }

    fun getCurrentSubtitleTrack(): Int {
        return renderer?.getCurrentSubtitleTrack() ?: -1
    }

    fun addSubtitleFile(url: String, select: Boolean) {
        renderer?.addSubtitleFile(url, select)
    }

    fun setSubtitleDelay(delay: Double) {
        renderer?.setSubtitleDelay(delay)
    }

    fun setSubtitleFontSize(size: Int) {
        renderer?.setSubtitleFontSize(size)
    }

    fun setSubtitleVisibility(visible: Boolean) {
        renderer?.setSubtitleVisibility(visible)
    }

    fun setSubtitlePosition(position: Int) {
        renderer?.setSubtitlePosition(position)
    }

    // -------------------------------------------------------------------
    // Audio controls
    // -------------------------------------------------------------------

    fun getAudioTracks(): List<Map<String, Any>> {
        return renderer?.getAudioTracks() ?: emptyList()
    }

    fun setAudioTrack(trackId: Int) {
        renderer?.setAudioTrack(trackId)
    }

    fun getCurrentAudioTrack(): Int {
        return renderer?.getCurrentAudioTrack() ?: -1
    }

    fun setAudioDelay(delay: Double) {
        renderer?.setAudioDelay(delay)
    }

    // -------------------------------------------------------------------
    // Zoom
    // -------------------------------------------------------------------

    fun setVideoZoom(scale: Double) {
        renderer?.setVideoZoom(scale)
    }

    fun setZoomedToFill(zoomed: Boolean) {
        _isZoomedToFill = zoomed
        renderer?.setZoomedToFill(zoomed)
    }

    fun isZoomedToFill(): Boolean {
        return _isZoomedToFill
    }

    // -------------------------------------------------------------------
    // Technical info
    // -------------------------------------------------------------------

    fun getTechnicalInfo(): Map<String, Any> {
        return renderer?.getTechnicalInfo() ?: emptyMap()
    }

    /** Expose the inner SurfaceView for PiP source rect hints. */
    fun getPlayerView(): android.view.View = surfaceView

    // -------------------------------------------------------------------
    // MPVLayerRenderer.Delegate
    // -------------------------------------------------------------------

    override fun onPositionChanged(position: Double, duration: Double, cacheSeconds: Double) {
        cachedPosition = position
        cachedDuration = duration

        pipController?.setPlaybackRate(if (intendedPlayState) 1.0 else 0.0)

        onProgress(
            mapOf(
                "position" to position,
                "duration" to duration,
                "cacheSeconds" to cacheSeconds
            )
        )
    }

    override fun onPauseChanged(isPaused: Boolean) {
        pipController?.setPlaybackRate(if (isPaused) 0.0 else 1.0)
        dispatchPauseState(isPaused)
    }

    private fun dispatchPauseState(isPaused: Boolean) {
        if (dispatchedPaused == isPaused) return
        dispatchedPaused = isPaused
        onPlaybackStateChange(
            mapOf(
                "isPaused" to isPaused,
                "isPlaying" to !isPaused
            )
        )
    }

    override fun onLoadingChanged(isLoading: Boolean) {
        onPlaybackStateChange(
            mapOf(
                "isLoading" to isLoading
            )
        )
    }

    override fun onReadyToSeek() {
        onPlaybackStateChange(
            mapOf(
                "isReadyToSeek" to true
            )
        )
    }

    override fun onTracksReady() {
        onTracksReady(emptyMap<String, Any>())
    }

    override fun onVideoDimensionsChanged(width: Int, height: Int) {
        pipController?.setVideoDimensions(width, height)
    }

    override fun onEOFChanged(eofReached: Boolean) {
        onPlaybackStateChange(
            mapOf(
                "eofReached" to eofReached
            )
        )
    }

    override fun onSpeedChanged(speed: Double) {
        onPlaybackStateChange(
            mapOf(
                "speed" to speed
            )
        )
    }

    override fun onSubtitleDelayChanged(delay: Double) {
        onPlaybackStateChange(
            mapOf(
                "subtitleDelay" to delay
            )
        )
    }

    override fun onAudioDelayChanged(delay: Double) {
        onPlaybackStateChange(
            mapOf(
                "audioDelay" to delay
            )
        )
    }

    override fun onError(message: String) {
        onError(
            mapOf(
                "error" to message
            )
        )
    }

    // -------------------------------------------------------------------
    // PiPController.Delegate
    // -------------------------------------------------------------------

    override fun onPlay() {
        play()
    }

    override fun onPause() {
        pause()
    }

    // -------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------

    fun cleanup() {
        pipController?.stopPiP()
        renderer?.stop()
        surfaceView.holder.removeCallback(this)
        renderer = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        cleanup()
    }
}
