import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable, View } from "react-native"

// Internal primitive shared by MultiToggle, InlineSelect, and ChipSelector — the three
// pill-selector implementations were near-identical (same wrapping-row-of-pressables
// pattern, two of them byte-identical). Each still owns its own selection semantics
// (multi vs. single vs. single-nullable) and public prop shape; this only consolidates
// the rendering + styling so a visual/theme fix lands once.

export type PillSelectorOption<T extends string> = {
    value: T
    label: string
    icon?: React.ReactNode
}

export type PillSelectorVariant = "outline" | "solid"

type PillSelectorProps<T extends string> = {
    options: PillSelectorOption<T>[]
    isSelected: (value: T) => boolean
    onPress: (value: T) => void
    variant?: PillSelectorVariant
    className?: string
}

const VARIANT_STYLES: Record<PillSelectorVariant, {
    pill: string
    selectedPill: string
    unselectedPill: string
    selectedText: string
    unselectedText: string
}> = {
    outline: {
        pill: "h-9 px-4 rounded-xl border items-center justify-center active:opacity-70",
        selectedPill: "border-brand-500/70 bg-brand-500/20",
        unselectedPill: "border-white/10 bg-white/[0.04]",
        selectedText: "text-brand-400",
        unselectedText: "text-white/65",
    },
    solid: {
        pill: "h-10 flex-row items-center gap-1.5 rounded-full border px-4",
        selectedPill: "border-primary bg-primary active:opacity-80",
        unselectedPill: "border-white/10 bg-white/[0.04] active:bg-white/10",
        selectedText: "text-primary-foreground",
        unselectedText: "text-foreground/80",
    },
}

export function PillSelector<T extends string>({
    options,
    isSelected,
    onPress,
    variant = "outline",
    className,
}: PillSelectorProps<T>) {
    const styles = VARIANT_STYLES[variant]
    return (
        <View className={cn("flex-row flex-wrap gap-2", className)}>
            {options.map(opt => {
                const selected = isSelected(opt.value)
                return (
                    <Pressable
                        key={opt.value}
                        onPress={() => onPress(opt.value)}
                        className={cn(styles.pill, selected ? styles.selectedPill : styles.unselectedPill)}
                    >
                        {opt.icon}
                        <Text
                            className={cn(
                                "text-sm font-medium",
                                selected ? styles.selectedText : styles.unselectedText,
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
