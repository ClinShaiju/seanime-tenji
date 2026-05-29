import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import React from "react"
import { Pressable, View } from "react-native"

///////////////////////////////////////////////////////////////////////////////
// ChipOption
///////////////////////////////////////////////////////////////////////////////

export type ChipOption<T extends string = string> = {
    value: T
    label: string
    icon?: React.ComponentProps<typeof Ionicons>["name"]
}

///////////////////////////////////////////////////////////////////////////////
// ChipSelector
// A wrapping row of selectable chip buttons, replaces inline radio patterns.
// Selected chip uses primary brand color; idle chips use the subtle surface.
///////////////////////////////////////////////////////////////////////////////

type ChipSelectorProps<T extends string = string> = {
    options: ChipOption<T>[]
    value: T
    onSelect: (value: T) => void
    className?: string
}

export function ChipSelector<T extends string = string>({
    options,
    value,
    onSelect,
    className,
}: ChipSelectorProps<T>) {
    return (
        <View className={cn("flex-row flex-wrap gap-2", className)}>
            {options.map(option => {
                const selected = value === option.value
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onSelect(option.value)}
                        className={cn(
                            "h-10 flex-row items-center gap-1.5 rounded-full border px-4",
                            selected
                                ? "border-primary bg-primary active:opacity-80"
                                : "border-white/10 bg-white/[0.04] active:bg-white/10",
                        )}
                    >
                        {option.icon && (
                            <Ionicons
                                name={option.icon}
                                size={13}
                                color={selected ? "#09090b" : "rgba(255,255,255,0.6)"}
                            />
                        )}
                        <Text
                            className={cn(
                                "text-sm font-medium",
                                selected ? "text-primary-foreground" : "text-foreground/80",
                            )}
                        >
                            {option.label}
                        </Text>
                    </Pressable>
                )
            })}
        </View>
    )
}
