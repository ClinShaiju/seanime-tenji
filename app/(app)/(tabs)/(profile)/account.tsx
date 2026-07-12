import { useUserChangePassword, useUserSaveDebrid } from "@/api/hooks/user-auth.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { AniListConnectionSection } from "@/components/features/profile/anilist-connection"
import { ProfileMenuSection, ProfileMenuToggle, ProfileSubpageHeader, RowDivider } from "@/components/features/profile/profile-menu"
import { InlineSelect } from "@/components/shared/inline-select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import { toast } from "@/lib/utils/toast"
import * as React from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const DEBRID_PROVIDER_OPTIONS = [
    { label: "TorBox", value: "torbox" },
    { label: "Real-Debrid", value: "realdebrid" },
    { label: "AllDebrid", value: "alldebrid" },
] as const

// Account management for a signed-in Seanime user: change password + (non-admin only)
// the per-user debrid override. Mirrors seanime-web's user settings tabs.
export default function AccountScreen() {
    const insets = useSafeAreaInsets()
    const serverStatus = useServerStatus()

    useIOSScrollRefreshRateWorkaround()

    // Password form
    const [oldPassword, setOldPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const { mutate: changePassword, isPending: isChangingPassword } = useUserChangePassword()

    function handleChangePassword() {
        if (!newPassword.trim()) return toast.error("Enter a new password")
        if (newPassword !== confirmPassword) return toast.error("Passwords don't match")
        changePassword({ oldPassword, newPassword }, {
            onSuccess: () => {
                setOldPassword("")
                setNewPassword("")
                setConfirmPassword("")
            },
        })
    }

    // Debrid override form (non-admin users only — admins configure the shared server debrid)
    const userDebrid = serverStatus?.userDebrid
    const [useServerDebrid, setUseServerDebrid] = React.useState(userDebrid?.useServerDebrid ?? true)
    const [provider, setProvider] = React.useState(userDebrid?.provider ?? "")
    const [apiKey, setApiKey] = React.useState("")
    const [useServerAutoSelect, setUseServerAutoSelect] = React.useState(userDebrid?.useServerAutoSelect ?? true)
    const { mutate: saveDebrid, isPending: isSavingDebrid } = useUserSaveDebrid()

    // Re-seed the form when the status refreshes with different override state
    const seededRef = React.useRef(false)
    React.useEffect(() => {
        if (!userDebrid || seededRef.current) return
        seededRef.current = true
        setUseServerDebrid(userDebrid.useServerDebrid)
        setProvider(userDebrid.provider ?? "")
        setUseServerAutoSelect(userDebrid.useServerAutoSelect ?? true)
    }, [userDebrid])

    function handleSaveDebrid() {
        if (!useServerDebrid && !provider) return toast.error("Pick a debrid provider")
        // Always the full shape — the server writes every field unconditionally
        // (a missing bool would decode as false and silently reset it).
        saveDebrid({
            useServerDebrid,
            provider: useServerDebrid ? "" : provider,
            apiKey: useServerDebrid ? "" : apiKey, // blank = keep the existing key
            useServerAutoSelect,
        }, {
            onSuccess: () => setApiKey(""),
        })
    }

    return (
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            <ProfileSubpageHeader
                title="Account"
                detail="Password and per-user streaming overrides."
            />

            <ScrollView
                className="flex-1 bg-background"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                contentInsetAdjustmentBehavior="automatic"
                keyboardShouldPersistTaps="handled"
            >
                <View className="mx-4 mt-4 gap-4">
                    <AniListConnectionSection />

                    <ProfileMenuSection title="Password">
                        <View className="gap-3 px-4 py-3.5">
                            <Input
                                placeholder="Current password (blank if none set)"
                                secureTextEntry
                                autoCapitalize="none"
                                value={oldPassword}
                                onChangeText={setOldPassword}
                            />
                            <Input
                                placeholder="New password"
                                secureTextEntry
                                autoCapitalize="none"
                                value={newPassword}
                                onChangeText={setNewPassword}
                            />
                            <Input
                                placeholder="Confirm new password"
                                secureTextEntry
                                autoCapitalize="none"
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                            <Button variant="default" onPress={handleChangePassword} disabled={isChangingPassword}>
                                <Text>{isChangingPassword ? "Saving..." : "Change password"}</Text>
                            </Button>
                        </View>
                    </ProfileMenuSection>

                    {userDebrid ? (
                        <ProfileMenuSection title="Debrid">
                            <ProfileMenuToggle
                                icon="cloud-outline"
                                label="Use server debrid"
                                detail="Stream through the server's shared debrid account"
                                value={useServerDebrid}
                                onToggle={setUseServerDebrid}
                            />
                            {!useServerDebrid ? (
                                <View className="gap-3 px-4 py-3.5">
                                    <Text className="text-xs text-white/40">Provider</Text>
                                    <InlineSelect
                                        options={[...DEBRID_PROVIDER_OPTIONS]}
                                        value={provider || null}
                                        nullable={false}
                                        onSelect={v => v && setProvider(v)}
                                    />
                                    <Input
                                        placeholder={userDebrid.hasApiKey ? "API key (blank = keep saved key)" : "API key"}
                                        secureTextEntry
                                        autoCapitalize="none"
                                        value={apiKey}
                                        onChangeText={setApiKey}
                                    />
                                </View>
                            ) : null}
                            <RowDivider />
                            <ProfileMenuToggle
                                icon="options-outline"
                                label="Use server auto-select"
                                detail="Use the server's auto-select preferences when picking a torrent"
                                value={useServerAutoSelect}
                                onToggle={setUseServerAutoSelect}
                            />
                            <View className="px-4 pb-3.5">
                                <Button variant="default" onPress={handleSaveDebrid} disabled={isSavingDebrid}>
                                    <Text>{isSavingDebrid ? "Saving..." : "Save debrid settings"}</Text>
                                </Button>
                            </View>
                        </ProfileMenuSection>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    )
}
