import { useDebridCancelStream } from "@/api/hooks/debrid.hooks"
import { useTorrentstreamStopStream } from "@/api/hooks/torrentstream.hooks"
import { ProfileSubpageHeader } from "@/components/features/profile/profile-menu"
import { Surface } from "@/components/shared/surface"
import { Button } from "@/components/ui/button"
import { useServerConnectionState } from "@/lib/offline"
import {
    activeStreamSessionAtom,
    debridStreamStateAtom,
    streamSessionModeAtom,
    torrentStreamIsLoadedAtom,
    torrentStreamIsPreparingAtom,
    torrentStreamLoadingStateAtom,
    torrentStreamLoadingTorrentNameAtom,
    torrentStreamPendingInfoAtom,
    torrentStreamStatusAtom,
} from "@/lib/player"
import { Ionicons } from "@expo/vector-icons"
import { useAtom, useAtomValue } from "jotai"
import * as React from "react"
import { Alert, ScrollView, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

export default function ActiveStreamScreen() {
    const insets = useSafeAreaInsets()
    const connectionState = useServerConnectionState()
    const [activeStream, setActiveStream] = useAtom(activeStreamSessionAtom)
    const [torrentStatus, setTorrentStatus] = useAtom(torrentStreamStatusAtom)
    const debridState = useAtomValue(debridStreamStateAtom)
    const [, setPendingInfo] = useAtom(torrentStreamPendingInfoAtom)
    const [, setStreamSessionMode] = useAtom(streamSessionModeAtom)
    const [, setIsPreparing] = useAtom(torrentStreamIsPreparingAtom)
    const [, setTorrentLoadingState] = useAtom(torrentStreamLoadingStateAtom)
    const [, setTorrentLoadingTorrentName] = useAtom(torrentStreamLoadingTorrentNameAtom)
    const [, setTorrentIsLoaded] = useAtom(torrentStreamIsLoadedAtom)
    const [, setDebridStreamState] = useAtom(debridStreamStateAtom)
    const stopTorrentStream = useTorrentstreamStopStream()
    const cancelDebridStream = useDebridCancelStream()
    const isConnected = connectionState === "connected"
    const isStopping = stopTorrentStream.isPending || cancelDebridStream.isPending

    const clearLocalStreamState = React.useCallback(() => {
            setActiveStream(null)
            setPendingInfo(null)
            setStreamSessionMode(null)
            setIsPreparing(false)
            setTorrentLoadingState(null)
            setTorrentLoadingTorrentName(null)
            setTorrentStatus(null)
            setTorrentIsLoaded(false)
            setDebridStreamState(null)
        },
        [setActiveStream, setDebridStreamState, setIsPreparing, setPendingInfo, setStreamSessionMode, setTorrentIsLoaded, setTorrentLoadingState,
            setTorrentLoadingTorrentName, setTorrentStatus])

    const handleStopStream = React.useCallback(() => {
        if (!activeStream || isStopping || !isConnected) return

        const stop = () => {
            if (activeStream.streamMode === "debrid") {
                cancelDebridStream.mutate({
                    options: {
                        removeTorrent: false,
                    },
                }, {
                    onSuccess: clearLocalStreamState,
                })
                return
            }

            stopTorrentStream.mutate(undefined, {
                onSuccess: clearLocalStreamState,
            })
        }

        Alert.alert(
            "Stop active stream?",
            "This stops the server-side stream session.",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Stop", style: "destructive", onPress: stop },
            ],
        )
    }, [activeStream, cancelDebridStream, clearLocalStreamState, isConnected, isStopping, stopTorrentStream])

    const statusLabel = activeStream ? getStatusLabel(activeStream.status) : "No stream"
    const statusDetail = React.useMemo(() => {
        if (!activeStream) return null

        if (activeStream.streamMode === "debrid") {
            return debridState?.message || activeStream.message || null
        }

        if (!torrentStatus) return activeStream.message || null

        const parts = [
            `${torrentStatus.progressPercentage.toFixed(1)}% ready`,
            `${torrentStatus.seeders} seeders`,
        ]

        if (torrentStatus.downloadSpeed) {
            parts.push(torrentStatus.downloadSpeed)
        }

        return parts.join(" · ")
    }, [activeStream, debridState?.message, torrentStatus])

    return (
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            <ProfileSubpageHeader
                title="Active Stream"
                detail="Server-side playback session"
            />

            <ScrollView
                className="flex-1 bg-background"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View className="mx-4 mt-4 gap-4">
                    {activeStream ? (
                        <Surface className="p-4">
                            <View className="flex-row items-start gap-3">
                                <View className="flex-1 gap-1">
                                    <Text className="text-lg font-bold text-white" numberOfLines={2}>
                                        {activeStream.title}
                                    </Text>
                                    <Text className="text-sm text-white/55" numberOfLines={2}>
                                        {activeStream.subtitle}
                                    </Text>
                                </View>
                            </View>

                            <View className="mt-5 gap-3">
                                <InfoRow label="Status" value={statusDetail || statusLabel} />
                                {!!activeStream.torrentName && activeStream.torrentName !== "-" ? (
                                    <InfoRow label="Release" value={activeStream.torrentName} />
                                ) : null}
                            </View>

                            {!isConnected ? (
                                <View className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3">
                                    <Text className="text-sm text-amber-100/80">
                                        Reconnect to the server to stop this stream.
                                    </Text>
                                </View>
                            ) : null}

                            <Button
                                variant="destructive"
                                className="mt-5 rounded-xl"
                                disabled={isStopping || !isConnected}
                                onPress={handleStopStream}
                                style={isStopping || !isConnected ? { opacity: 0.45 } : undefined}
                            >
                                <View className="flex-row items-center justify-center gap-2">
                                    <Ionicons name="stop-circle" size={17} color="white" />
                                    <Text className="text-sm font-semibold text-white">
                                        {isStopping ? "Stopping..." : "Stop Stream"}
                                    </Text>
                                </View>
                            </Button>
                        </Surface>
                    ) : (
                        <Surface className="items-center p-8">
                            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
                                <Ionicons name="checkmark-circle-outline" size={30} color="rgba(255,255,255,0.45)" />
                            </View>
                            <Text className="mt-4 text-base font-semibold text-white">
                                No active stream
                            </Text>
                        </Surface>
                    )}
                </View>
            </ScrollView>
        </View>
    )
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row gap-3">
            <Text className="w-20 text-xs font-medium text-white/35">
                {label}
            </Text>
            <Text className="flex-1 text-sm text-white/75" numberOfLines={2}>
                {value}
            </Text>
        </View>
    )
}

function getStatusLabel(status: "preparing" | "ready" | "playing"): string {
    switch (status) {
        case "preparing":
            return "Preparing"
        case "ready":
            return "Ready"
        case "playing":
            return "Active"
    }
}

function formatStartedAt(value: number): string {
    return new Date(value).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })
}
