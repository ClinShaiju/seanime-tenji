const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins")
const fs = require("node:fs")
const path = require("node:path")

const NETWORK_SECURITY_CONFIG = "network_security_config.xml"
const NETWORK_SECURITY_CONFIG_REFERENCE = "@xml/network_security_config"
const { getMainApplicationOrThrow } = AndroidConfig.Manifest

function withAndroidLanCleartext(config) {
    return withAndroidManifest(config, async config => {
        config.modResults = await applyAndroidNetworkSecurityConfig(config, config.modResults)
        return config
    })
}

async function applyAndroidNetworkSecurityConfig(config, androidManifest) {
    const sourcePath = path.join(__dirname, NETWORK_SECURITY_CONFIG)
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Android network security config source file was not found: ${sourcePath}`)
    }

    const resourceFolder = await AndroidConfig.Paths.getResourceFolderAsync(config.modRequest.projectRoot)
    const destinationFolder = path.join(resourceFolder, "xml")
    const destinationPath = path.join(destinationFolder, NETWORK_SECURITY_CONFIG)

    try {
        await fs.promises.mkdir(destinationFolder, { recursive: true })
        await fs.promises.copyFile(sourcePath, destinationPath)
    } catch (error) {
        throw new Error(
            `Failed to install Android network security config at ${destinationPath}`,
            { cause: error },
        )
    }

    const app = getMainApplicationOrThrow(androidManifest)
    app.$ ??= {}

    const existingConfig = app.$["android:networkSecurityConfig"]
    if (existingConfig && existingConfig !== NETWORK_SECURITY_CONFIG_REFERENCE) {
        throw new Error(
            `AndroidManifest.xml already declares android:networkSecurityConfig="${existingConfig}". `
            + `Refusing to replace it with "${NETWORK_SECURITY_CONFIG_REFERENCE}".`,
        )
    }

    app.$["android:usesCleartextTraffic"] = "true"
    app.$["android:networkSecurityConfig"] = NETWORK_SECURITY_CONFIG_REFERENCE

    return androidManifest
}

module.exports = withAndroidLanCleartext
