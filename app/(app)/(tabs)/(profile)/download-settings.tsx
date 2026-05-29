import { downloadSettingsAtom } from "@/atoms/download-settings.atoms"
import { ProfileMenuSection, ProfileMenuToggle, ProfileSubpageHeader, RowDivider } from "@/components/features/profile/profile-menu"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import { useAtom } from "jotai"
import * as React from "react"
import { ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function DownloadSettingsScreen() {
    const insets = useSafeAreaInsets()
    const [downloadSettings, setDownloadSettings] = useAtom(downloadSettingsAtom)

    useIOSScrollRefreshRateWorkaround()

    return (
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            <ProfileSubpageHeader
                title="Download Settings"
                detail="Control anime and manga downloads."
            />

            <ScrollView
                className="flex-1 bg-background"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                contentInsetAdjustmentBehavior="automatic"
            >
                <View className="mx-4 mt-4 gap-4">
                    <ProfileMenuSection title="Network">
                        <ProfileMenuToggle
                            icon="wifi-outline"
                            label="Only Download on Wi-Fi"
                            detail="Block new downloads when you are on cellular data"
                            value={downloadSettings.wifiOnly}
                            onToggle={(value) => setDownloadSettings(current => ({ ...current, wifiOnly: value }))}
                        />
                    </ProfileMenuSection>

                    <ProfileMenuSection title="Queue">
                        <ProfileMenuToggle
                            icon="albums-outline"
                            label="Background Downloading"
                            detail="Keep queued downloads running when the app is backgrounded, where supported"
                            value={downloadSettings.backgroundDownloading}
                            onToggle={(value) => setDownloadSettings(current => ({ ...current, backgroundDownloading: value }))}
                        />
                        <RowDivider />
                        <ProfileMenuToggle
                            icon="git-branch-outline"
                            label="Parallel Downloading"
                            detail="Download multiple episodes or chapters at the same time"
                            value={downloadSettings.parallelDownloading}
                            onToggle={(value) => setDownloadSettings(current => ({ ...current, parallelDownloading: value }))}
                        />
                    </ProfileMenuSection>

                    <Text className="px-1 text-xs leading-5 text-white/35">
                        Background downloading is enabled by default, but actual behavior still depends on platform background execution limits.
                    </Text>
                </View>
            </ScrollView>
        </View>
    )
}
