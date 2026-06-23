import { ServerDataWrapper } from "@/api/components/server-data-wrapper"
import { useServerUrl } from "@/atoms/server.atoms"
import { useDownloadQueueResumeService } from "@/lib/downloads/download-queue-resume-service"
import { useDownloadSnapshotRefreshService, useOfflineSyncService, useServerLocalSyncService } from "@/lib/offline"
import { useWatchRoomLiveState } from "@/lib/nakama/watch-room"
import { usePlayerEventListener } from "@/lib/player"
import { Stack } from "expo-router"
import { View } from "react-native"

function BackgroundServices() {
    useOfflineSyncService()
    useDownloadSnapshotRefreshService()
    useServerLocalSyncService()
    useDownloadQueueResumeService()
    useWatchRoomLiveState() // keep currentWatchRoomAtom fresh while the player is open
    return null
}

function PlayerEventMount() {
    usePlayerEventListener()
    return null
}

export default function AppLayout() {
    const serverUrl = useServerUrl()

    // ServerUrlWrapper in root _layout handles redirect to set-server-url
    // when serverUrl is null. We just show nothing here while waiting.
    if (!serverUrl) {
        return <View className="bg-background flex-1" />
    }

    return (
        <ServerDataWrapper>
            <BackgroundServices />
            <PlayerEventMount />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false, freezeOnBlur: true }} />
                <Stack.Screen
                    name="entry"
                    options={{
                        headerShown: false,
                        animation: "slide_from_right",
                        freezeOnBlur: true,
                    }}
                />
                <Stack.Screen name="(media)" options={{ headerShown: false, freezeOnBlur: true }} />
            </Stack>
        </ServerDataWrapper>
    )
}
