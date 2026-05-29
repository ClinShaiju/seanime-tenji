const { withAndroidManifest } = require("expo/config-plugins")

function withAndroidLanCleartext(config) {
    return withAndroidManifest(config, config => {
        const app = config.modResults.manifest.application?.[0]

        if (!app) {
            return config
        }

        if (!app.$) {
            app.$ = {}
        }

        app.$["android:usesCleartextTraffic"] = "true"

        return config
    })
}

module.exports = withAndroidLanCleartext