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

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Rect
import android.os.Build
import android.util.Log
import android.util.Rational
import android.view.View
import androidx.annotation.RequiresApi
import expo.modules.kotlin.AppContext

/**
 * Picture-in-Picture controller for Android.
 * Mirrors the Streamyfin / Findroid PiP approach.
 */
class PiPController(private val context: Context, private val appContext: AppContext? = null) {

    companion object {
        private const val TAG = "PiPController"
        private const val DEFAULT_ASPECT_WIDTH = 16
        private const val DEFAULT_ASPECT_HEIGHT = 9
    }

    interface Delegate {
        fun onPlay()
        fun onPause()
    }

    var delegate: Delegate? = null

    private var videoWidth: Int = 0
    private var videoHeight: Int = 0
    private var playerView: View? = null
    private var playbackRate: Double = 1.0

    /**
     * Check if Picture-in-Picture is supported on this device
     */
    fun isPiPSupported(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE)
        } else {
            false
        }
    }

    /**
     * Check if Picture-in-Picture is currently active
     */
    fun isPiPActive(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = getActivity()
            return activity?.isInPictureInPictureMode ?: false
        }
        return false
    }

    /**
     * Start Picture-in-Picture mode
     */
    fun startPiP(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = getActivity()
            if (activity == null) {
                Log.e(TAG, "Cannot start PiP: no activity found")
                return false
            }

            if (!isPiPSupported()) {
                Log.e(TAG, "PiP not supported on this device")
                return false
            }

            try {
                val params = buildPiPParams()
                activity.setPictureInPictureParams(params)
                val entered = activity.enterPictureInPictureMode(params)
                Log.i(TAG, "Entered PiP mode: $entered")
                return entered
            } catch (e: Exception) {
                Log.e(TAG, "Failed to enter PiP: ${e.message}")
                return false
            }
        } else {
            Log.w(TAG, "PiP requires Android O or higher")
            return false
        }
    }

    /**
     * Stop Picture-in-Picture mode
     */
    fun stopPiP() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = getActivity()
            if (activity?.isInPictureInPictureMode == true) {
                activity.moveTaskToBack(false)
            }
        }
    }

    /**
     * Set the playback rate (0.0 for paused, 1.0 for playing).
     * Updates PiP params if currently in PiP.
     */
    fun setPlaybackRate(rate: Double) {
        playbackRate = rate
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = getActivity()
            if (activity?.isInPictureInPictureMode == true) {
                try {
                    activity.setPictureInPictureParams(buildPiPParams())
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to update PiP params: ${e.message}")
                }
            }
        }
    }

    /**
     * Set the video dimensions for proper aspect ratio calculation
     */
    fun setVideoDimensions(width: Int, height: Int) {
        if (width > 0 && height > 0) {
            videoWidth = width
            videoHeight = height
            updatePiPParamsIfNeeded()
        }
    }

    /**
     * Set the player view reference for source rect hint
     */
    fun setPlayerView(view: View?) {
        playerView = view
    }

    fun refreshPiPParams() {
        updatePiPParamsIfNeeded()
    }

    private fun updatePiPParamsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val activity = getActivity()
            if (activity?.isInPictureInPictureMode == true) {
                try {
                    activity.setPictureInPictureParams(buildPiPParams())
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to update PiP params: ${e.message}")
                }
            }
        }
    }

    /**
     * Build PiP params using Findroid-style aspect ratio and source rect calculation.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun buildPiPParams(): PictureInPictureParams {
        val view = playerView
        val viewWidth = view?.width ?: 0
        val viewHeight = view?.height ?: 0

        // Display aspect ratio from view (Findroid approach)
        val displayAspectRatio = Rational(viewWidth.coerceAtLeast(1), viewHeight.coerceAtLeast(1))

        // Video aspect ratio with 2.39:1 clamping (Findroid approach)
        val aspectRatio = if (videoWidth > 0 && videoHeight > 0) {
            Rational(
                videoWidth.coerceAtMost((videoHeight * 2.39f).toInt()),
                videoHeight.coerceAtMost((videoWidth * 2.39f).toInt()),
            )
        } else {
            Rational(DEFAULT_ASPECT_WIDTH, DEFAULT_ASPECT_HEIGHT)
        }

        // Source rect hint (Findroid approach)
        val sourceRectHint = if (viewWidth > 0 && viewHeight > 0 && videoWidth > 0 && videoHeight > 0) {
            if (displayAspectRatio < aspectRatio) {
                // Letterboxing — black bars top/bottom
                val space = ((viewHeight - (viewWidth.toFloat() / aspectRatio.toFloat())) / 2).toInt()
                Rect(
                    0,
                    space,
                    viewWidth,
                    (viewWidth.toFloat() / aspectRatio.toFloat()).toInt() + space,
                )
            } else {
                // Pillarboxing — black bars left/right
                val space = ((viewWidth - (viewHeight.toFloat() * aspectRatio.toFloat())) / 2).toInt()
                Rect(
                    space,
                    0,
                    (viewHeight.toFloat() * aspectRatio.toFloat()).toInt() + space,
                    viewHeight,
                )
            }
        } else {
            null
        }

        val builder = PictureInPictureParams.Builder()
            .setAspectRatio(aspectRatio)

        sourceRectHint?.let { builder.setSourceRectHint(it) }

        // On Android 12+, enable auto-enter (Findroid approach)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            builder.setAutoEnterEnabled(true)
        }

        return builder.build()
    }

    private fun getActivity(): Activity? {
        // First try Expo's AppContext (preferred in React Native)
        appContext?.currentActivity?.let { return it }

        // Fallback: context wrapper chain
        var ctx = context
        while (ctx is android.content.ContextWrapper) {
            if (ctx is Activity) {
                return ctx
            }
            ctx = ctx.baseContext
        }
        return null
    }
}
