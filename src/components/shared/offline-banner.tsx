import { useServerConnectionState } from "@/lib/offline"
import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { Text, View } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"

export function OfflineBanner() {
    const connectionState = useServerConnectionState()

    if (connectionState !== "disconnected") return null

    return (
        <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            className="bg-gray-600/70"
        >
            <View className="flex-row items-center justify-center gap-2 px-4 py-1.5">
                <Ionicons name="cloud-offline-outline" size={13} color="rgba(255,255,255,0.7)" />
                <Text className="text-xs font-medium text-white/70">
                    Offline
                </Text>
            </View>
        </Animated.View>
    )
}
