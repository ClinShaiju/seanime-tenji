package expo.modules.externalplayer

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

object ExpoExternalPlayerLauncher {
    fun open(context: Context, url: String, packageName: String?): Boolean {
        if (url.isBlank()) return false

        val uri = Uri.parse(url)
        val candidates = buildCandidateIntents(uri, packageName?.takeIf { it.isNotBlank() })

        // player intent filters differ, so try the common video handoff shapes
        for (candidate in candidates) {
            try {
                context.startActivity(candidate)
                return true
            } catch (_: ActivityNotFoundException) {
                continue
            } catch (_: SecurityException) {
                continue
            }
        }

        return false
    }

    private fun buildCandidateIntents(uri: Uri, packageName: String?): List<Intent> {
        return listOf(
            baseIntent(packageName).setDataAndType(uri, "video/*"),
            baseIntent(packageName).setData(uri),
            baseIntent(packageName).setDataAndType(uri, "*/*"),
        )
    }

    private fun baseIntent(packageName: String?): Intent {
        return Intent(Intent.ACTION_VIEW).apply {
            addCategory(Intent.CATEGORY_DEFAULT)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (packageName != null) setPackage(packageName)
        }
    }
}

class ExpoExternalPlayerModule : Module() {
    private val context
        get() = requireNotNull(appContext.reactContext)

    override fun definition() = ModuleDefinition {
        Name("ExpoExternalPlayer")

        AsyncFunction("open") { url: String, packageName: String?, promise: Promise ->
            promise.resolve(ExpoExternalPlayerLauncher.open(context, url, packageName))
        }
    }
}
