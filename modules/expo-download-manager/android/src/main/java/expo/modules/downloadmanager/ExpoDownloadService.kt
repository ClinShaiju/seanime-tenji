package expo.modules.downloadmanager

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log

class ExpoDownloadService : Service() {
    companion object {
        private const val TAG = "ExpoDownloadService"
        private const val NOTIFICATION_ID = 4002
        private const val CHANNEL_ID = "seanime_downloads"
        private const val STOP_DELAY_MS = 15_000L

        private val mainHandler = Handler(Looper.getMainLooper())
        private var pendingStop: Runnable? = null

        @Volatile
        private var currentService: ExpoDownloadService? = null

        fun ensureRunning(context: Context) {
            cancelPendingStop()
            if (currentService != null) return

            val intent = Intent(context, ExpoDownloadService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun updateProgress(context: Context, title: String, progress: Int, activeCount: Int) {
            ensureRunning(context)
            currentService?.updateNotification(title, progress, activeCount)
        }

        fun stopIfIdle(context: Context, activeCount: Int) {
            if (activeCount > 0) return

            currentService?.markIdle()
            val appContext = context.applicationContext
            val stopRunnable = Runnable {
                currentService?.stopForegroundCompat()
                appContext.stopService(Intent(appContext, ExpoDownloadService::class.java))
                pendingStop = null
            }

            pendingStop = stopRunnable
            mainHandler.postDelayed(stopRunnable, STOP_DELAY_MS)
        }

        private fun cancelPendingStop() {
            val stopRunnable = pendingStop ?: return
            mainHandler.removeCallbacks(stopRunnable)
            pendingStop = null
        }
    }

    private var currentTitle = "Preparing downloads"
    private var currentProgress = 0
    private var currentActiveCount = 0
    private var isForeground = false

    override fun onCreate() {
        super.onCreate()
        currentService = this
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundSafely()
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onDestroy() {
        if (currentService === this) {
            currentService = null
        }
        super.onDestroy()
    }

    private fun updateNotification(title: String, progress: Int, activeCount: Int) {
        currentTitle = title
        currentProgress = progress.coerceIn(0, 100)
        currentActiveCount = activeCount

        startForegroundSafely()
        val manager = getSystemService(NotificationManager::class.java)
        manager.notify(NOTIFICATION_ID, createNotification())
    }

    private fun markIdle() {
        currentActiveCount = 0
    }

    private fun startForegroundSafely() {
        if (isForeground) return

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    NOTIFICATION_ID,
                    createNotification(),
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                )
            } else {
                @Suppress("DEPRECATION")
                startForeground(NOTIFICATION_ID, createNotification())
            }
            isForeground = true
        } catch (error: Exception) {
            Log.e(TAG, "Unable to start foreground service", error)
            stopSelf()
        }
    }

    private fun stopForegroundCompat() {
        if (!isForeground) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        isForeground = false
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Downloads",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Seanime download progress"
            setShowBadge(false)
        }

        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(channel)
    }

    private fun createNotification(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        val contentText = if (currentActiveCount > 1) {
            "$currentActiveCount downloads active"
        } else if (currentProgress > 0) {
            "$currentProgress% complete"
        } else {
            "Starting"
        }

        builder
            .setContentTitle(currentTitle)
            .setContentText(contentText)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)

        if (currentProgress > 0) {
            builder.setProgress(100, currentProgress, false)
        } else {
            builder.setProgress(100, 0, true)
        }

        return builder.build()
    }
}
