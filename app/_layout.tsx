import "../global.css"
import { ServerUrlWrapper } from "@/api/components/server-data-wrapper"
import { WebsocketProvider } from "@/api/components/websocket-provider"
import { hydrateSecureTokens } from "@/atoms/secure-tokens"
import { SERVER_AUTH_TOKEN_STORAGE_KEY, SESSION_TOKEN_STORAGE_KEY } from "@/atoms/server.atoms"
import { getStoredTheme } from "@/atoms/storage"
import { setAndroidNavigationBar } from "@/lib/android-navigation-bar"
import { AnilistRateLimitBanner } from "@/components/shared/anilist-rate-limit-banner"
import { AppReleaseUpdatePrompt } from "@/lib/app-release-updates"
import { useConnectionStateMonitor } from "@/lib/connection-state"
import { NAV_THEME } from "@/lib/constants"
import { OtaUpdatePrompt } from "@/lib/ota/updates"
import { hydrateQueryClient, OFFLINE_QUERY_KEYS, setupQueryPersistence } from "@/lib/query-persistence"
import { useColorScheme } from "@/lib/useColorScheme"
import { Ionicons } from "@expo/vector-icons"
import { DefaultTheme, Theme, ThemeProvider } from "@react-navigation/native"
import { PortalHost } from "@rn-primitives/portal"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Slot, SplashScreen } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { createStore, Provider as JotaiProvider } from "jotai"
import * as React from "react"
import { StyleSheet, Text, View } from "react-native"
import { GestureHandlerRootView } from "react-native-gesture-handler"
import Toast from "react-native-toast-message"
import type { BaseToastProps } from "react-native-toast-message"
import "react-native-reanimated"

const DARK_THEME: Theme = {
    ...DefaultTheme,
    dark: true,
    colors: NAV_THEME.dark,
}

const LIGHT_THEME: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: NAV_THEME.light,
}

export {
    // Catch any errors thrown by the Layout component.
    ErrorBoundary,
} from "expo-router"

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            refetchOnWindowFocus: false,
            retry: 0,
            staleTime: 0,
        },
    },
})

// Restore cached query data from MMKV for instant offline-ready UI
hydrateQueryClient(queryClient, OFFLINE_QUERY_KEYS)
// Auto-persist successful query results to MMKV
setupQueryPersistence(queryClient)
// Load the bearer tokens from the iOS Keychain into the sync mirror (migrating any legacy
// plaintext MMKV copy). Kicked off at module load so it resolves during the splash/auth
// gate, before authenticated requests fire. Fail-safe: on error the user simply re-logs in.
const hydratePromise = hydrateSecureTokens([SERVER_AUTH_TOKEN_STORAGE_KEY, SESSION_TOKEN_STORAGE_KEY])

function CompactToast({ icon, iconColor, text }: { icon: React.ComponentProps<typeof Ionicons>["name"]; iconColor: string; text: string }) {
    return (
        <View
            className="max-w-80 self-center flex-row items-center gap-2 rounded-xl bg-gray-800/95 px-3.5 py-2.5"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 }}
        >
            <Ionicons name={icon} size={16} color={iconColor} />
            <Text className="shrink text-sm font-medium text-white/95" numberOfLines={2}>
                {text}
            </Text>
        </View>
    )
}

const toastConfig = {
    success: (props: BaseToastProps) => (
        <CompactToast icon="checkmark-circle" iconColor="#4ade80" text={props.text2 || ""} />
    ),
    error: (props: BaseToastProps) => (
        <CompactToast icon="close-circle" iconColor="#f87171" text={props.text2 || ""} />
    ),
    info: (props: BaseToastProps) => (
        <CompactToast icon="information-circle" iconColor="rgba(97,82,223,0.9)" text={props.text2 || ""} />
    ),
    warning: (props: BaseToastProps) => (
        <CompactToast icon="warning" iconColor="#fbbf24" text={props.text2 || ""} />
    ),
}

// Prevent the splash screen from auto-hiding before getting the color scheme.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
    const { setColorScheme, isDarkColorScheme } = useColorScheme()
    const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false)

    const [store] = React.useState(createStore())

    useConnectionStateMonitor()

    React.useEffect(() => {
        (async () => {
            const storedTheme = getStoredTheme() ?? "dark"
            setColorScheme(storedTheme)
            setAndroidNavigationBar(storedTheme)
            await hydratePromise
            setIsColorSchemeLoaded(true)
        })().finally(() => {
            SplashScreen.hideAsync()
        })
    }, [])

    if (!isColorSchemeLoaded) {
        return null
    }

    return (
        <GestureHandlerRootView style={styles.container}>
            <View className="flex-1 bg-background">
                <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
                    <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
                    <JotaiProvider store={store}>
                        <QueryClientProvider client={queryClient}>
                            <WebsocketProvider>
                                <ServerUrlWrapper>
                                    <OtaUpdatePrompt />
                                    <AppReleaseUpdatePrompt />
                                    <AnilistRateLimitBanner />
                                    <Slot />
                                    <PortalHost />
                                </ServerUrlWrapper>
                            </WebsocketProvider>
                        </QueryClientProvider>
                    </JotaiProvider>
                    <Toast config={toastConfig} />
                </ThemeProvider>
            </View>
        </GestureHandlerRootView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
})
