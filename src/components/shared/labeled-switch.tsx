import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, Text, View } from "react-native"

type LabeledSwitchProps = {
    label: string
    checked: boolean
    onToggle: () => void
    disabled?: boolean
    helper?: string
}

/**
 * Reusable full-width row with a label on the left and a Switch on the right.
 * The entire row is tappable to toggle the switch.
 */
export function LabeledSwitch({ label, checked, onToggle, disabled, helper }: LabeledSwitchProps) {
    return (
        <Pressable
            onPress={onToggle}
            disabled={disabled}
            className="flex-row items-center justify-between gap-3"
        >
            <View className="flex-1 gap-0.5">
                <Text className={cn("text-sm font-medium", checked ? "text-white" : "text-white/70")}>
                    {label}
                </Text>
                {!!helper && (
                    <Text className="text-xs leading-4 text-white/35">
                        {helper}
                    </Text>
                )}
            </View>
            <Switch checked={checked} onCheckedChange={onToggle} disabled={disabled} />
        </Pressable>
    )
}
