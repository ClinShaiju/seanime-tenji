/**
 * mpv-android's newer libc++_shared.so
 *
 * mpv-android ships a newer libc++_shared.so than React Native bundles.
 * The newer version is backward-compatible but mpv needs symbols only present in the newer version.
 *
 * Use a custom Gradle task that runs after native lib merging
 * to replace the merged libc++_shared.so with the mpv-android version.
 */
const { withAppBuildGradle } = require("expo/config-plugins")

const GRADLE_SNIPPET = `
// expo-mpv-player: override libc++_shared.so with mpv-android's newer version
// The mpv-android native libs require a newer libc++ than React Native ships.
// After merge, we overwrite with the mpv-android copy which is backwards-compatible.
android.packagingOptions.jniLibs.pickFirsts.add('**/libc++_shared.so')

afterEvaluate {
    ['Debug', 'Release'].each { buildType ->
        def taskName = "merge\${buildType}NativeLibs"
        def mergeTask = tasks.findByName(taskName)
        if (mergeTask != null) {
            mergeTask.doLast {
                def mpvJniLibs = project(':expo-mpv-player').file('src/main/jniLibs')
                def outDir = it.outputDir.get().asFile
                ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'].each { abi ->
                    def src = new File(mpvJniLibs, "\${abi}/libc++_shared.so")
                    def dst = new File(outDir, "lib/\${abi}/libc++_shared.so")
                    if (src.exists() && dst.exists()) {
                        dst.bytes = src.bytes
                    }
                }
            }
        }
    }
}
`

module.exports = function withLibcppPickFirst(config) {
    return withAppBuildGradle(config, (config) => {
        const contents = config.modResults.contents

        if (!contents.includes("expo-mpv-player: override libc++_shared.so")) {
            config.modResults.contents = contents + "\n" + GRADLE_SNIPPET
        }

        return config
    })
}
