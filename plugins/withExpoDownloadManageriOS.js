const { withDangerousMod, withInfoPlist } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const POD_LINE = "  pod 'ExpoDownloadManager', :path => '../modules/expo-download-manager/ios'"
const POD_REGEX = /^\s*pod 'ExpoDownloadManager'.*$/m

function withExpoDownloadManageriOS(config) {
    config = withInfoPlist(config, (config) => {
        const modes = Array.isArray(config.modResults.UIBackgroundModes)
            ? config.modResults.UIBackgroundModes
            : []

        if (!modes.includes("fetch")) {
            config.modResults.UIBackgroundModes = [...modes, "fetch"]
        }

        return config
    })

    return withDangerousMod(config, [
        "ios",
        (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile")
            let podfile = fs.readFileSync(podfilePath, "utf-8")

            if (POD_REGEX.test(podfile)) {
                if (!podfile.includes(POD_LINE)) {
                    podfile = podfile.replace(POD_REGEX, POD_LINE)
                    fs.writeFileSync(podfilePath, podfile)
                }
                return config
            }

            const anchor = "use_expo_modules!"
            const anchorIndex = podfile.indexOf(anchor)
            if (anchorIndex === -1) {
                throw new Error("[withExpoDownloadManageriOS] Could not find 'use_expo_modules!' in Podfile")
            }

            const insertAt = anchorIndex + anchor.length
            podfile = podfile.slice(0, insertAt) + "\n" + POD_LINE + "\n" + podfile.slice(insertAt)
            fs.writeFileSync(podfilePath, podfile)
            return config
        },
    ])
}

module.exports = withExpoDownloadManageriOS
