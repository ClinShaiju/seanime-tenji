import { PillSelector } from "@/components/shared/pill-selector"
import { Ionicons } from "@expo/vector-icons"
import React from "react"

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
        <PillSelector
            variant="solid"
            className={className}
            options={options.map(option => {
                const selected = value === option.value
                return {
                    value: option.value,
                    label: option.label,
                    icon: option.icon ? (
                        <Ionicons
                            name={option.icon}
                            size={13}
                            color={selected ? "#09090b" : "rgba(255,255,255,0.6)"}
                        />
                    ) : undefined,
                }
            })}
            isSelected={opt => opt === value}
            onPress={onSelect}
        />
    )
}
