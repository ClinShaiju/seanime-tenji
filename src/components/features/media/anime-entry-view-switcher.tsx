import { TabBarIcon } from "@/components/navigation/tab-bar-icon"
import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import * as React from "react"
import { Platform, Pressable, View } from "react-native"
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated"

export type AnimeEntryView = "library" | "torrentstream" | "onlinestream" | "info" | "downloaded"

type AnimeEntryViewSwitcherProps = {
    currentView: AnimeEntryView
    onViewChange: (view: AnimeEntryView) => void
    bottomInset: number
    isOffline?: boolean
    hiddenViews?: Set<AnimeEntryView>
}

const VIEW_ITEMS: Array<{ label: string, icon: React.ComponentProps<typeof Ionicons>["name"], view: AnimeEntryView }> = [
    { label: "Library", icon: "library-outline", view: "library" },
    { label: "Stream", icon: "play-circle-outline", view: "torrentstream" },
    { label: "Online", icon: "globe-outline", view: "onlinestream" },
    { label: "Info", icon: "information-circle-outline", view: "info" },
    { label: "Downloads", icon: "download-outline", view: "downloaded" },
]

const OFFLINE_DISABLED_VIEWS: Set<AnimeEntryView> = new Set(["library", "torrentstream", "onlinestream"])

export function AnimeEntryViewSwitcher({ currentView, onViewChange, bottomInset, isOffline, hiddenViews }: AnimeEntryViewSwitcherProps) {
    const visibleItems = React.useMemo(
        () => hiddenViews?.size ? VIEW_ITEMS.filter(item => !hiddenViews.has(item.view)) : VIEW_ITEMS,
        [hiddenViews],
    )

    return (
        <View
            pointerEvents="box-none"
            className="absolute left-4 right-4"
            style={{
                bottom: Math.max(bottomInset, Platform.OS === "ios" ? 20 : 10),
            }}
        >
            <View
                className="flex-row justify-between overflow-hidden rounded-full bg-background px-5 py-4"
                style={{ elevation: 10 }}
            >
                {visibleItems.map(item => {
                    const disabled = isOffline && OFFLINE_DISABLED_VIEWS.has(item.view)
                    return (
                        <AnimeEntryViewButton
                            key={item.view}
                            label={item.label}
                            icon={item.icon}
                            active={currentView === item.view}
                            onPress={() => onViewChange(item.view)}
                            disabled={disabled}
                        />
                    )
                })}
            </View>
        </View>
    )
}

type AnimeEntryViewButtonProps = {
    label: string
    icon: React.ComponentProps<typeof Ionicons>["name"]
    active: boolean
    onPress: () => void
    disabled?: boolean
}

function AnimeEntryViewButton({ label, icon, active, onPress, disabled }: AnimeEntryViewButtonProps) {
    const scale = useSharedValue(active ? 0 : 1)

    React.useEffect(() => {
        scale.set(withSpring(active ? 0 : 1, { duration: 350 }))
    }, [active, scale])

    const animatedIconStyle = useAnimatedStyle(() => {
        return {
            transform: [{ scale: interpolate(scale.value, [0, 1], [1.2, 1]) }],
            top: interpolate(scale.value, [0, 1], [1, 9]),
            opacity: disabled ? 0.25 : 1,
        }
    })

    const animatedTextStyle = useAnimatedStyle(() => {
        return {
            opacity: disabled ? 0 : interpolate(scale.value, [0, 1], [1, 0]),
            top: interpolate(scale.value, [1, 0], [20, 4]),
        }
    })

    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            className="flex-1 items-center justify-center gap-1"
        >
            <Animated.View style={animatedIconStyle}>
                <TabBarIcon
                    name={icon}
                    size={24}
                    className={cn("text-gray", { "text-brand-300": active && !disabled })}
                />
            </Animated.View>
            <Animated.Text
                className={cn("text-xs text-gray", { "text-brand-300": active && !disabled })}
                style={animatedTextStyle}
            >
                {label}
            </Animated.Text>
        </Pressable>
    )
}