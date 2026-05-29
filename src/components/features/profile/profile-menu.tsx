import { RowDivider } from "@/components/shared/row-divider"
import { Surface } from "@/components/shared/surface"
import { FormSectionLabel } from "@/components/ui/form-field"
import { Switch } from "@/components/ui/switch"
import { Ionicons } from "@expo/vector-icons"
import { router } from "expo-router"
import * as React from "react"
import { Pressable, Text, TouchableOpacity, View } from "react-native"

export function ProfileMenuSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View>
            <FormSectionLabel className="mb-2 px-1">{title}</FormSectionLabel>
            <Surface variant="muted" className="overflow-hidden">
                {children}
            </Surface>
        </View>
    )
}

export function ProfileMenuItem({
    icon,
    label,
    detail,
    accessory,
    onPress,
    hideChevron,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"]
    label: string
    detail?: string
    accessory?: React.ReactNode
    onPress?: () => void
    hideChevron?: boolean
}) {
    return (
        <Pressable
            className="flex-row items-center px-4 py-3.5 active:opacity-70"
            onPress={onPress}
        >
            <Ionicons name={icon} size={20} color="rgba(255,255,255,0.6)" />
            <View className="ml-3 flex-1">
                <Text className="text-foreground text-sm font-medium">{label}</Text>
                {detail ? (
                    <Text className="mt-0.5 text-xs text-white/40">{detail}</Text>
                ) : null}
            </View>
            {accessory ? (
                <View className="mr-2 flex-row items-center gap-2">
                    {accessory}
                </View>
            ) : null}
            {!hideChevron && <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.25)" />}
        </Pressable>
    )
}

export function ProfileMenuToggle({
    icon,
    label,
    detail,
    value,
    onToggle,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"]
    label: string
    detail?: string
    value: boolean
    onToggle: (value: boolean) => void
}) {
    return (
        <View className="flex-row items-center px-4 py-3.5">
            <Ionicons name={icon} size={20} color="rgba(255,255,255,0.6)" />
            <View className="ml-3 flex-1">
                <Text className="text-foreground text-sm font-medium">{label}</Text>
                {detail ? (
                    <Text className="mt-0.5 text-xs text-white/40">{detail}</Text>
                ) : null}
            </View>
            <Switch checked={value} onCheckedChange={onToggle} />
        </View>
    )
}

export function ProfileSubpageHeader({
    title,
    detail,
}: {
    title: string
    detail?: string
}) {
    return (
        <View className="flex-row items-center gap-3 px-4 py-3">
            <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
                <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <View className="flex-1">
                <Text className="text-xl font-bold text-foreground">{title}</Text>
                {detail ? (
                    <Text className="mt-0.5 text-xs text-white/40">{detail}</Text>
                ) : null}
            </View>
        </View>
    )
}

export { RowDivider }
