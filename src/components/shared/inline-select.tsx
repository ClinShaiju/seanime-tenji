import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, View } from "react-native"

type InlineSelectProps<T extends string> = {
    options: { value: T; label: string }[]
    value: T | null
    nullable?: boolean
    onSelect: (value: T | null) => void
}

export function InlineSelect<T extends string>({
    options,
    value,
    nullable = true,
    onSelect,
}: InlineSelectProps<T>) {
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map(opt => {
                const selected = value === opt.value
                return (
                    <Pressable
                        key={opt.value}
                        onPress={() => onSelect(selected && nullable ? null : opt.value)}
                        className={cn(
                            "h-9 px-4 rounded-xl border items-center justify-center active:opacity-70",
                            selected
                                ? "border-brand-500/70 bg-brand-500/20"
                                : "border-white/10 bg-white/[0.04]",
                        )}
                    >
                        <Text
                            className={cn(
                                "text-sm font-medium",
                                selected ? "text-brand-400" : "text-white/65",
                            )}
                        >
                            {opt.label}
                        </Text>
                    </Pressable>
                )
            })}
        </View>
    )
}
