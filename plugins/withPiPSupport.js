/**
 * Expo Config Plugin: enables PiP for the main Activity on Android
 *
 * Adds `android:supportsPictureInPicture="true"` and the required
 * `android:configChanges` to prevent Activity recreation during PiP transitions.
 */
const { withAndroidManifest } = require("expo/config-plugins")

function withPiPSupport(config) {
    return withAndroidManifest(config, (config) => {
        const manifest = config.modResults
        const application = manifest.manifest.application?.[0]
        if (!application?.activity) return config

        // Find the main Activity
        const mainActivity = application.activity.find(
            (a) =>
                a.$?.["android:name"] === ".MainActivity" ||
                a.$?.["android:name"] === "com.anonymous.seanimeapp.MainActivity",
        )
        if (!mainActivity) return config

        // Enable PiP
        mainActivity.$["android:supportsPictureInPicture"] = "true"

        // Add required configChanges to prevent recreation during PiP
        const existing = mainActivity.$["android:configChanges"] || ""
        const required = ["screenSize", "smallestScreenSize", "screenLayout", "orientation"]
        const parts = existing.split("|").filter(Boolean)
        for (const r of required) {
            if (!parts.includes(r)) parts.push(r)
        }
        mainActivity.$["android:configChanges"] = parts.join("|")

        return config
    })
}

module.exports = withPiPSupport
