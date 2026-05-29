import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, View } from "react-native"

type MultiToggleProps<T extends string> = {
    options: { value: T; label: string }[]
    values: T[]
    onToggle: (value: T) => void
}

export function MultiToggle<T extends string>({ options, values, onToggle }: MultiToggleProps<T>) {
    return (
        <View className="flex-row flex-wrap gap-2">
            {options.map(opt => {
                const selected = values.includes(opt.value)
                return (
                    <Pressable
                        key={opt.value}
                        onPress={() => onToggle(opt.value)}
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
