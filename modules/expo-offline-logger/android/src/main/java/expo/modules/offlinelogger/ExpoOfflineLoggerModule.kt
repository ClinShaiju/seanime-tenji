package expo.modules.offlinelogger

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.system.exitProcess

object ExpoOfflineLoggerRuntime {
    @Volatile
    private var installed = false
    @Volatile
    private var watchdogThread: Thread? = null
    @Volatile
    private var lastAnrWriteAt = 0L
    private var previousHandler: Thread.UncaughtExceptionHandler? = null
    private const val ANR_TIMEOUT_MS = 5000L
    private const val ANR_WRITE_THROTTLE_MS = 30000L

    private fun directory(context: Context): File {
        return File(context.filesDir, "seanime-offline-logger").apply { mkdirs() }
    }

    private fun logsFile(context: Context): File {
        return File(directory(context), "native.log")
    }

    private fun crashFile(context: Context): File {
        return File(directory(context), "last-native-crash.log")
    }

    private fun timestamp(): String {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", Locale.US).format(Date())
    }

    fun install(context: Context): Boolean {
        if (installed) return false

        previousHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            writeCrash(context, thread, throwable)

            val handler = previousHandler
            if (handler != null) {
                handler.uncaughtException(thread, throwable)
            } else {
                exitProcess(2)
            }
        }

        installed = true
        startAnrWatchdog(context.applicationContext)
        return true
    }

    fun append(context: Context, entryJson: String) {
        logsFile(context).appendText(entryJson + "\n")
    }

    fun readNativeLogs(context: Context): String? {
        val file = logsFile(context)
        return if (file.exists()) file.readText() else null
    }

    fun getLastNativeCrash(context: Context): String? {
        val file = crashFile(context)
        return if (file.exists()) file.readText() else null
    }

    fun clear(context: Context) {
        logsFile(context).delete()
    }

    fun clearLastNativeCrash(context: Context) {
        crashFile(context).delete()
    }

    private fun writeCrash(context: Context, thread: Thread, throwable: Throwable) {
        val crash = buildString {
            appendLine("timestamp=${timestamp()}")
            appendLine("thread=${thread.name}")
            appendLine("type=${throwable::class.java.name}")
            appendLine("message=${throwable.message ?: ""}")
            appendLine(throwable.stackTraceToString())
        }

        crashFile(context).writeText(crash)
    }

    private fun startAnrWatchdog(context: Context) {
        if (watchdogThread != null) return

        val mainHandler = Handler(Looper.getMainLooper())
        watchdogThread = Thread {
            while (!Thread.currentThread().isInterrupted) {
                val responded = AtomicBoolean(false)
                mainHandler.post { responded.set(true) }

                try {
                    Thread.sleep(ANR_TIMEOUT_MS)
                } catch (_: InterruptedException) {
                    return@Thread
                }

                if (!responded.get()) {
                    writeAnr(context)
                }
            }
        }.apply {
            name = "SeanimeAnrWatchdog"
            isDaemon = true
            start()
        }
    }

    private fun writeAnr(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastAnrWriteAt < ANR_WRITE_THROTTLE_MS) return
        lastAnrWriteAt = now

        val mainThread = Looper.getMainLooper().thread
        val stack = mainThread.stackTrace.joinToString("\n") { frame -> "  at $frame" }
        val crash = buildString {
            appendLine("timestamp=${timestamp()}")
            appendLine("type=android-anr")
            appendLine("thread=${mainThread.name}")
            appendLine(stack)
        }

        crashFile(context).writeText(crash)
    }
}

class ExpoOfflineLoggerModule : Module() {
    private val context
        get() = requireNotNull(appContext.reactContext)

    override fun definition() = ModuleDefinition {
        Name("ExpoOfflineLogger")

        Function("install") {
            ExpoOfflineLoggerRuntime.install(context)
        }

        Function("append") { entryJson: String ->
            ExpoOfflineLoggerRuntime.append(context, entryJson)
        }

        AsyncFunction("readNativeLogs") { promise: Promise ->
            promise.resolve(ExpoOfflineLoggerRuntime.readNativeLogs(context))
        }

        AsyncFunction("getLastNativeCrash") { promise: Promise ->
            promise.resolve(ExpoOfflineLoggerRuntime.getLastNativeCrash(context))
        }

        Function("clear") {
            ExpoOfflineLoggerRuntime.clear(context)
        }

        Function("clearLastNativeCrash") {
            ExpoOfflineLoggerRuntime.clearLastNativeCrash(context)
        }

        Function("copyToClipboard") { text: String ->
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            clipboard.setPrimaryClip(ClipData.newPlainText("Seanime logs", text))
            true
        }
    }
}
