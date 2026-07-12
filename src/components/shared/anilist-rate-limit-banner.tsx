import { Ionicons } from "@expo/vector-icons"
import { atom, useAtomValue } from "jotai"
import React from "react"
import { Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

// Set by the WS event router (websocket-event-router.ts) on every "anilist-rate-limit" event —
// a global broadcast the server sends whenever it backs off an AniList request. `at` makes the
// atom reference change even when `waitSeconds` repeats, so the banner always restarts its
// countdown on a fresh event instead of silently keeping the stale one running.
export const anilistRateLimitEventAtom = atom<{ waitSeconds: number, at: number } | null>(null)

// Mirrors web's rate-limit-loader.tsx: a small top-of-screen pill that counts down the AniList
// backoff so a stalled list/collection sync reads as "waiting on AniList", not a silent hang.
// Mounted once, app-wide (app/_layout.tsx).
export function AnilistRateLimitBanner() {
    const event = useAtomValue(anilistRateLimitEventAtom)
    const insets = useSafeAreaInsets()
    const [totalSeconds, setTotalSeconds] = React.useState(0)
    const [secondsRemaining, setSecondsRemaining] = React.useState(0)

    React.useEffect(() => {
        if (!event || !(event.waitSeconds > 0)) return
        setTotalSeconds(event.waitSeconds)
        setSecondsRemaining(event.waitSeconds)
    }, [event])

    React.useEffect(() => {
        if (secondsRemaining <= 0) return
        const interval = setInterval(() => {
            setSecondsRemaining(prev => (prev <= 1 ? 0 : prev - 1))
        }, 1000)
        return () => clearInterval(interval)
    }, [secondsRemaining])

    if (secondsRemaining <= 0) return null

    const progress = totalSeconds > 0 ? Math.max(0, Math.min(1, secondsRemaining / totalSeconds)) : 0

    return (
        <View
            style={{ position: "absolute", top: insets.top + 6, left: 0, right: 0, zIndex: 60, alignItems: "center" }}
            pointerEvents="none"
        >
            <View className="rounded-full bg-orange-950/90 border border-orange-500/30 px-3 py-1.5 flex-row items-center gap-1.5 shadow-lg">
                <Ionicons name="time-outline" size={14} color="#fb923c" />
                <Text className="text-xs font-medium text-orange-200">
                    AniList rate limit: retrying in {secondsRemaining}s
                </Text>
            </View>
            <View className="h-0.5 mt-1 rounded-full bg-orange-950/40" style={{ width: 120 }}>
                <View className="h-0.5 rounded-full bg-orange-500" style={{ width: `${progress * 100}%` }} />
            </View>
        </View>
    )
}
