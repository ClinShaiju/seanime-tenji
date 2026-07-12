// `import type` (not a value import) — Node 23 rejects the runtime directory-import
// of "expo/config", which breaks `eas`/expo config loading. These are types only.
import type { ConfigContext, ExpoConfig } from "expo/config"

// Fork: OTA runs through EAS Update under the @cvslinc/seanime-app project (not
// upstream seanime.app). Paste the project ID from `npx eas-cli project:info`
// (or the EAS dashboard) below; env var overrides it. Empty => OTA disabled.
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID || "112362af-08e4-4daa-a481-fc214e9fe092"

const updates: ExpoConfig["updates"] = EAS_PROJECT_ID
    ? {
        enabled: true,
        url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
        checkAutomatically: "NEVER",
        fallbackToCacheTimeout: 0,
        // Pin the OTA channel in the build itself. `eas build` would inject this
        // from eas.json, but locally-built IPAs (no Apple Dev account needed for
        // sideloading) won't — so set it here. Updates land via `eas update --channel stable`.
        requestHeaders: {
            "expo-channel-name": "stable",
        },
    }
    : { enabled: false }

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "Seanime",
    slug: "seanime-app",
    owner: "cvslinc",
    version: "0.1.24",
    orientation: "portrait",
    icon: "./src/assets/images/icon.png",
    scheme: "seanime",
    userInterfaceStyle: "automatic",
    jsEngine: "hermes",
    runtimeVersion: {
        policy: "appVersion",
    },
    updates,
    extra: {
        eas: {
            projectId: EAS_PROJECT_ID || undefined,
        },
    },
    ios: {
        buildNumber: "24",
        appleTeamId: process.env.EXPO_APPLE_TEAM_ID || "",
        supportsTablet: true,
        bundleIdentifier: "app.seanime.tenji",
        infoPlist: {
            NSLocalNetworkUsageDescription: "Seanime needs local network access to connect to your server on your home network.",
            UIBackgroundModes: [
                "audio",
            ],
            LSApplicationQueriesSchemes: [
                "vlc",
                "outplayer",
                "infuse",
                "nplayer-http",
                "oplayer",
                "mangoplayer",
            ],
            UISupportedInterfaceOrientations: [
                "UIInterfaceOrientationPortrait",
                "UIInterfaceOrientationPortraitUpsideDown",
                "UIInterfaceOrientationLandscapeLeft",
                "UIInterfaceOrientationLandscapeRight",
            ],
            "UISupportedInterfaceOrientations~ipad": [
                "UIInterfaceOrientationPortrait",
                "UIInterfaceOrientationPortraitUpsideDown",
                "UIInterfaceOrientationLandscapeLeft",
                "UIInterfaceOrientationLandscapeRight",
            ],
        },
    },
    android: {
        jsEngine: "hermes",
        versionCode: 24,
        usesCleartextTraffic: true,
        adaptiveIcon: {
            foregroundImage: "./src/assets/images/adaptive-icon.png",
            backgroundColor: "#171140",
        },
        permissions: [
            "WRITE_SETTINGS",
        ],
        package: "app.seanime.tenji",
    } as any,
    plugins: [
        "expo-router",
        [
            "expo-splash-screen",
            {
                image: "./src/assets/images/splash-logo.png",
                resizeMode: "contain",
                backgroundColor: "#070707",
                android: {
                    imageWidth: 200,
                    resizeMode: "contain",
                },
                ios: {
                    imageWidth: 100,
                    resizeMode: "contain",
                },
            },
        ],
        "@react-native-community/datetimepicker",
        "./plugins/withAndroidExternalPlayerQueries",
        "./plugins/withAndroidLanCleartext",
        "./plugins/withAndroidReactNativeArchitectures",
        "./plugins/withLibcppPickFirst",
        "./plugins/withPiPSupport",
        "./plugins/withMPVKitiOS",
        "./plugins/withExpoDownloadManageriOS",
        "./plugins/withExpoOfflineLoggeriOS",
        "expo-updates",
        "expo-image",
        "expo-secure-store",
    ],
    experiments: {
        typedRoutes: true,
        reactCompiler: true,
    },
});

