import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import * as React from "react"
import { Pressable, Text } from "react-native"
import * as DropdownMenu from "zeego/dropdown-menu"

export type NativeSelectOption = {
    id: string
    label: string
    sublabel?: string
}

type NativeSelectProps = {
    options: NativeSelectOption[]
    selectedId: string
    onSelect: (id: string) => void
    title?: string
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function NativeSelect({
    options,
    selectedId,
    onSelect,
    placeholder = "Select...",
    className,
    disabled,
}: NativeSelectProps) {
    const selectedLabel = React.useMemo(
        () => options.find(o => o.id === selectedId)?.label ?? null,
        [options, selectedId],
    )

    return (
        <DropdownMenu.Root>
            <DropdownMenu.Trigger>
                <Pressable
                    disabled={disabled}
                    className={cn(
                        "flex-row items-center justify-between h-11 px-3.5 rounded-xl border border-white/10 bg-white/[0.04] active:bg-white/5",
                        disabled && "opacity-50",
                        className,
                    )}
                >
                    <Text
                        className={cn(
                            "text-sm font-medium flex-1",
                            selectedLabel ? "text-white" : "text-muted-foreground",
                        )}
                        numberOfLines={1}
                    >
                        {selectedLabel ?? placeholder}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.45)" />
                </Pressable>
            </DropdownMenu.Trigger>

            <DropdownMenu.Content>
                {options.map(option => (
                    <DropdownMenu.CheckboxItem
                        key={option.id}
                        value={option.id === selectedId ? "on" : "off"}
                        onValueChange={() => onSelect(option.id)}
                    >
                        <DropdownMenu.ItemTitle>{option.label}</DropdownMenu.ItemTitle>
                        {!!option.sublabel && (
                            <DropdownMenu.ItemSubtitle>{option.sublabel}</DropdownMenu.ItemSubtitle>
                        )}
                    </DropdownMenu.CheckboxItem>
                ))}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    )
}
