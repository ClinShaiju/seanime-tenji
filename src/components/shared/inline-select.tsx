import { PillSelector } from "@/components/shared/pill-selector"
import * as React from "react"

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
        <PillSelector
            options={options}
            isSelected={opt => value === opt}
            onPress={opt => onSelect(opt === value && nullable ? null : opt)}
        />
    )
}
