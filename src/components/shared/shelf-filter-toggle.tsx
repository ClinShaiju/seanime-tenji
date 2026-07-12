import { Text } from "@/components/ui/text"
import { Ionicons } from "@/lib/icons/Ionicons"
import { cn } from "@/lib/utils"
import * as React from "react"
import { Pressable } from "react-native"

type ShelfFilterToggleProps = {
    active: boolean
    activeLabel: string
    inactiveLabel: string
    onPress: () => void
    className?: string
}

/**
 * Small pill toggle for a per-shelf filter (e.g. anime library "Show unwatched only", manga
 * library "Unread chapters only"). Mirrors the DropdownMenu affordance on web's currently-watching
 * / currently-reading shelf, adapted to a single-tap chip for the mobile shelf header row.
 */
export function ShelfFilterToggle({ active, activeLabel, inactiveLabel, onPress, className }: ShelfFilterToggleProps) {
    return (
        <Pressable
            onPress={onPress}
            className={cn(
                "min-h-9 rounded-xl border px-3 flex-row items-center gap-1.5 active:opacity-75",
                active
                    ? "border-brand-500/70 bg-brand-500/18"
                    : "border-white/10 bg-white/[0.04]",
                className,
            )}
        >
            <Ionicons
                name="filter-outline"
                size={13}
                colorClassName={active ? "text-brand-400" : "text-white/65"}
            />
            <Text className={cn("text-sm font-medium", active ? "text-brand-400" : "text-white/65")}>
                {active ? activeLabel : inactiveLabel}
            </Text>
        </Pressable>
    )
}
