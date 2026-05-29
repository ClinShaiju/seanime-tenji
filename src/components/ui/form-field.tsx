import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { View } from "react-native"

///////////////////////////////////////////////////////////////////////////////
// FormSectionLabel
// Uppercase tracking label with optional leading icon and trailing slot.
// Used as group headings inside forms and bottom sheets.
///////////////////////////////////////////////////////////////////////////////

type FormSectionLabelProps = {
    children: React.ReactNode
    icon?: React.ComponentProps<typeof Ionicons>["name"]
    trailing?: React.ReactNode
    className?: string
}

export function FormSectionLabel({ children, icon, trailing, className }: FormSectionLabelProps) {
    return (
        <View className={cn("flex-row items-center justify-between", className)}>
            <View className="flex-row items-center gap-2">
                {icon && (
                    <Ionicons name={icon} size={14} color="rgba(255,255,255,0.45)" />
                )}
                <Text className="text-xs font-semibold uppercase tracking-widest text-white/40">
                    {children}
                </Text>
            </View>
            {trailing}
        </View>
    )
}

///////////////////////////////////////////////////////////////////////////////
// FormField
// Wraps a control with an optional label and optional hint text.
//
// Pass `icon` to render the label as a FormSectionLabel (uppercase style).
// Without `icon`, the label renders as a quieter text-sm field label.
// The `trailing` slot sits to the right of the label (e.g. "/ 12 episodes").
///////////////////////////////////////////////////////////////////////////////

type FormFieldProps = {
    children: React.ReactNode
    label?: string
    icon?: React.ComponentProps<typeof Ionicons>["name"]
    trailing?: React.ReactNode
    hint?: string
    className?: string
}

export function FormField({ children, label, icon, trailing, hint, className }: FormFieldProps) {
    return (
        <View className={cn("gap-2", className)}>
            {label !== undefined && (
                icon ? (
                    <FormSectionLabel icon={icon} trailing={trailing}>{label}</FormSectionLabel>
                ) : (
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-medium text-white/70">{label}</Text>
                        {trailing}
                    </View>
                )
            )}
            {children}
            {hint !== undefined && (
                <Text className="text-xs leading-4 text-white/35">{hint}</Text>
            )}
        </View>
    )
}
