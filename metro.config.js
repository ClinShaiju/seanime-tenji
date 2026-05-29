const { getDefaultConfig } = require("expo/metro-config")
const { withUniwindConfig } = require("uniwind/metro")

const config = getDefaultConfig(__dirname)

if (process.env.SEANIME_DISABLE_WATCHMAN === "1") {
    config.resolver.useWatchman = false
}

module.exports = withUniwindConfig(config, {
    cssEntryFile: "./global.css",
    polyfills: { rem: 14 },
    dtsFile: "./uniwind-types.d.ts",
})
