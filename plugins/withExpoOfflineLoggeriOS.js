const { withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const POD_LINE = "  pod 'ExpoOfflineLogger', :path => '../modules/expo-offline-logger/ios'"
const POD_REGEX = /^\s*pod 'ExpoOfflineLogger'.*$/m

function withExpoOfflineLoggeriOS(config) {
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
                throw new Error("[withExpoOfflineLoggeriOS] Could not find 'use_expo_modules!' in Podfile")
            }

            const insertAt = anchorIndex + anchor.length
            podfile = podfile.slice(0, insertAt) + "\n" + POD_LINE + podfile.slice(insertAt)
            fs.writeFileSync(podfilePath, podfile)
            return config
        },
    ])
}

module.exports = withExpoOfflineLoggeriOS