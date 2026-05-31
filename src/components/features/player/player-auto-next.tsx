import { Button } from "@/components/ui/button"
import React from "react"
import { Text, useWindowDimensions, View } from "react-native"
import Animated, { FadeIn, FadeOut } from "react-native-reanimated"

interface AutoNextCardProps {
    countdown: number
    nextEpisodeLabel: string
    controlsVisible: boolean
    controlsLocked: boolean
    padR: number
    insets: { bottom: number }
    onCancel: () => void
    onPlayNow: () => void
}

interface NextEpisodeConfirmCardProps {
    title: string
    description: string
    confirmLabel: string
    insets: { top: number; bottom: number; left: number; right: number }
    onCancel: () => void
    onConfirm: () => void
}

export function AutoNextCard({
    countdown, nextEpisodeLabel, controlsVisible, controlsLocked,
    padR, insets, onCancel, onPlayNow,
}: AutoNextCardProps) {
    const { width: screenWidth } = useWindowDimensions()
    const cardWidth = Math.min(340, Math.max(260, screenWidth * 0.38))

    return (
        <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(160)}
            className="absolute"
            style={{
                right: padR,
                bottom: Math.max(insets.bottom, 16) + (controlsVisible && !controlsLocked ? 112 : 18),
                width: cardWidth,
            }}
        >
            <View className="w-full gap-2.5 rounded-2xl border border-white/10 bg-black/90 px-4 py-3.5">
                <View className="gap-1">
                    <Text className="text-xs font-bold uppercase tracking-wide text-white/50">
                        Up next
                    </Text>
                    <Text className="text-sm font-bold text-white" numberOfLines={1}>
                        {nextEpisodeLabel}
                    </Text>
                    <Text className="text-xs text-white/40" numberOfLines={1}>
                        Playing automatically in {countdown}s
                    </Text>
                </View>

                <View className="w-full flex-row gap-2">
                    <Button variant="outline" className="min-w-0 flex-1" onPress={onCancel}>
                        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
                            Cancel
                        </Text>
                    </Button>

                    <Button className="min-w-0 flex-1" onPress={onPlayNow}>
                        <Text className="text-sm font-bold" numberOfLines={1}>
                            Play now
                        </Text>
                    </Button>
                </View>
            </View>
        </Animated.View>
    )
}

export function NextEpisodeConfirmCard({
    title,
    description,
    confirmLabel,
    insets,
    onCancel,
    onConfirm,
}: NextEpisodeConfirmCardProps) {
    return (
        <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(140)}
            className="absolute inset-0 items-center justify-center"
            style={{
                paddingTop: insets.top + 20,
                paddingBottom: insets.bottom + 20,
                paddingLeft: insets.left + 20,
                paddingRight: insets.right + 20,
            }}
        >
            <View className="absolute inset-0 bg-black/70" />

            <View className="w-full max-w-sm gap-4 rounded-[28px] border border-white/10 bg-black/95 px-5 py-5">
                <View className="gap-1.5">
                    <Text className="text-lg font-bold text-white">
                        {title}
                    </Text>
                    <Text className="text-sm leading-5 text-white/60">
                        {description}
                    </Text>
                </View>

                <View className="flex-row gap-3">
                    <Button variant="outline" className="flex-1" onPress={onCancel}>
                        <Text className="text-sm font-semibold text-foreground">Cancel</Text>
                    </Button>

                    <Button className="flex-1" onPress={onConfirm}>
                        <Text className="text-sm font-bold">Play now</Text>
                    </Button>
                </View>
            </View>
        </Animated.View>
    )
}
