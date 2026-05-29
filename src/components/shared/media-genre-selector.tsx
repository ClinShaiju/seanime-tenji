import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, ScrollView, View } from "react-native"

type MediaGenreSelectorOption = {
    value: string | null
    label: string
}

type MediaGenreSelectorProps = {
    options: MediaGenreSelectorOption[]
    value: string | null
    onChange: (value: string | null) => void
    className?: string
}

export function MediaGenreSelector({ options, value, onChange, className }: MediaGenreSelectorProps) {
    return (
        <View className={cn("mb-2", className)}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 6 }}
            >
                {options.map(option => {
                    const selected = option.value === value
                    return (
                        <Pressable
                            key={option.label}
                            onPress={() => onChange(option.value)}
                            className={cn(
                                "min-h-9 rounded-xl border px-4 items-center justify-center active:opacity-75",
                                selected
                                    ? "border-brand-500/70 bg-brand-500/18"
                                    : "border-white/10 bg-white/[0.04]",
                            )}
                        >
                            <Text
                                className={cn(
                                    "text-sm font-medium",
                                    selected ? "text-brand-400" : "text-white/65",
                                )}
                            >
                                {option.label}
                            </Text>
                        </Pressable>
                    )
                })}
            </ScrollView>
        </View>
    )
}