import { cn } from "@/lib/utils"
import * as React from "react"
import { View } from "react-native"

type RowDividerProps = {
    className?: string
}

export function RowDivider({ className }: RowDividerProps) {
    return <View className={cn("h-px bg-white/5 mx-4", className)} />
}
