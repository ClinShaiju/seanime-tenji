/**
 * Expo Config Plugin: adds the MPVKit-GPL and local ExpoMpvPlayer CocoaPods
 * dependencies for iOS.
 *
 * MPVKit-GPL is published by the Streamyfin fork at
 * https://github.com/streamyfin/MPVKit as a podspec with pre-built
 * xcframeworks. This plugin injects both the MPVKit pod and the local
 * ExpoMpvPlayer pod into the Podfile so that `pod install` links the
 * native module even when local Expo module autolinking skips it.
 */
const { withDangerousMod } = require("expo/config-plugins")
const fs = require("fs")
const path = require("path")

const MPVKIT_POD_LINE =
    "  pod 'MPVKit-GPL', :podspec => 'https://raw.githubusercontent.com/streamyfin/MPVKit/0.40.0-av/MPVKit-GPL.podspec'"
const EXPO_MPV_PLAYER_POD_LINE = "  pod 'ExpoMpvPlayer', :path => '../modules/expo-mpv-player/ios'"
const MPVKIT_POD_REGEX = /^\s*pod 'MPVKit-GPL'.*$/m
const EXPO_MPV_PLAYER_POD_REGEX = /^\s*pod 'ExpoMpvPlayer'.*$/m

function withMPVKitiOS(config) {
    return withDangerousMod(config, [
        "ios",
        (config) => {
            const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile")
            let podfile = fs.readFileSync(podfilePath, "utf-8")
            let didChange = false

            if (MPVKIT_POD_REGEX.test(podfile) && !podfile.includes(MPVKIT_POD_LINE)) {
                podfile = podfile.replace(MPVKIT_POD_REGEX, MPVKIT_POD_LINE)
                didChange = true
            }

            if (EXPO_MPV_PLAYER_POD_REGEX.test(podfile) && !podfile.includes(EXPO_MPV_PLAYER_POD_LINE)) {
                podfile = podfile.replace(EXPO_MPV_PLAYER_POD_REGEX, EXPO_MPV_PLAYER_POD_LINE)
                didChange = true
            }

            // Skip if both pods are already present with the expected definitions
            if (podfile.includes(MPVKIT_POD_LINE) && podfile.includes(EXPO_MPV_PLAYER_POD_LINE)) {
                if (didChange) fs.writeFileSync(podfilePath, podfile)
                return config
            }

            // Insert the pod lines right after `use_expo_modules!`
            const anchor = "use_expo_modules!"
            const anchorIndex = podfile.indexOf(anchor)
            if (anchorIndex === -1) {
                throw new Error("[withMPVKitiOS] Could not find 'use_expo_modules!' in Podfile")
            }
            const insertAt = anchorIndex + anchor.length
            const podLines = [
                !podfile.includes("MPVKit-GPL") ? MPVKIT_POD_LINE : null,
                !podfile.includes("ExpoMpvPlayer") ? EXPO_MPV_PLAYER_POD_LINE : null,
            ]
                .filter(Boolean)
                .join("\n")

            podfile =
                podfile.slice(0, insertAt) +
                "\n" +
                podLines +
                "\n" +
                podfile.slice(insertAt)

            fs.writeFileSync(podfilePath, podfile)
            return config
        },
    ])
}

module.exports = withMPVKitiOS
