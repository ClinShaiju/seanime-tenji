import { useLogin, useLogout } from "@/api/hooks/auth.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { ProfileMenuSection } from "@/components/features/profile/profile-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { toast } from "@/lib/utils/toast"
import * as React from "react"
import { Alert, Linking, View } from "react-native"

// AniList connect/disconnect for the current profile — the RN counterpart to seanime-web's
// integrations-settings.tsx. Same token-paste flow (no OAuth webview): "Get token" opens the
// AniList PIN page, the user pastes the returned access token, and useLogin({ token }) hits the
// per-user /auth/login. Disconnect confirms into useLogout. Gated on user.isSimulated, mirroring
// web (connected = a real, non-simulated AniList account is linked).
const ANILIST_PIN_URL = "https://anilist.co/api/v2/oauth/authorize?client_id=13985&response_type=token"

export function AniListConnectionSection() {
    const serverStatus = useServerStatus()
    const user = serverStatus?.user
    const isConnected = !!user && !user.isSimulated

    const { mutate: login, isPending: isLoggingIn } = useLogin()
    const { mutate: logout, isPending: isLoggingOut } = useLogout()

    const [expanded, setExpanded] = React.useState(false)
    const [token, setToken] = React.useState("")

    function handleContinue() {
        const t = token.trim()
        if (!t) return toast.error("Paste your AniList token")
        login({ token: t }, { onSuccess: () => { setToken(""); setExpanded(false) } })
    }

    function handleDisconnect() {
        Alert.alert(
            "Disconnect AniList",
            "Your AniList account will be unlinked from this profile. You can reconnect anytime.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Disconnect", style: "destructive", onPress: () => logout(undefined) },
            ],
        )
    }

    return (
        <ProfileMenuSection title="AniList">
            <View className="gap-2.5 px-4 py-3.5">
                <Text className="text-sm text-foreground">
                    {isConnected ? `Connected as ${user?.viewer?.name ?? "AniList user"}` : "Not connected"}
                </Text>
                <Text className="text-xs text-white/40">
                    {isConnected
                        ? "Your AniList account is linked to this profile."
                        : "Connect your AniList account to sync your lists, progress, and scores."}
                </Text>

                {isConnected ? (
                    <Button variant="destructive" onPress={handleDisconnect} disabled={isLoggingOut}>
                        <Text>{isLoggingOut ? "Disconnecting..." : "Disconnect"}</Text>
                    </Button>
                ) : !expanded ? (
                    <Button variant="default" onPress={() => setExpanded(true)}>
                        <Text>Connect with AniList</Text>
                    </Button>
                ) : (
                    <View className="gap-3 mt-1">
                        <Button variant="secondary" onPress={() => Linking.openURL(ANILIST_PIN_URL)}>
                            <Text>Get AniList token</Text>
                        </Button>
                        <Input
                            placeholder="Paste your AniList token"
                            autoCapitalize="none"
                            autoCorrect={false}
                            multiline
                            value={token}
                            onChangeText={setToken}
                            className="h-24 py-3"
                            textAlignVertical="top"
                        />
                        <View className="flex-row gap-2">
                            <Button variant="ghost" className="flex-1" onPress={() => { setExpanded(false); setToken("") }}>
                                <Text>Cancel</Text>
                            </Button>
                            <Button variant="default" className="flex-1" onPress={handleContinue} disabled={isLoggingIn}>
                                <Text>{isLoggingIn ? "Connecting..." : "Continue"}</Text>
                            </Button>
                        </View>
                    </View>
                )}
            </View>
        </ProfileMenuSection>
    )
}
