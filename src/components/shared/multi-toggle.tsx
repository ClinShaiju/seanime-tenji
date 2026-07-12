import { PillSelector } from "@/components/shared/pill-selector"
import * as React from "react"

type MultiToggleProps<T extends string> = {
    options: { value: T; label: string }[]
    values: T[]
    onToggle: (value: T) => void
}

export function MultiToggle<T extends string>({ options, values, onToggle }: MultiToggleProps<T>) {
    return (
        <PillSelector
            options={options}
            isSelected={value => values.includes(value)}
            onPress={onToggle}
        />
    )
}
