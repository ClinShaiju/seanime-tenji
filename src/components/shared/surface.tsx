import { cn } from "@/lib/utils"
import * as React from "react"
import { View } from "react-native"

type SurfaceVariant = "card" | "muted" | "brand" | "danger"

type SurfaceProps = React.ComponentPropsWithoutRef<typeof View> & {
    variant?: SurfaceVariant
}

const VARIANT_CLASSES: Record<SurfaceVariant, string> = {
    card: "rounded-2xl border border-border/50 bg-card/30",
    muted: "rounded-2xl border border-border/50 bg-card/30",
    // muted: "rounded-2xl border border-white/10 bg-white/5",
    brand: "rounded-2xl border border-brand-300/20 bg-brand-300/[0.04]",
    danger: "rounded-2xl border border-red-500/20 bg-red-500/[0.04]",
}

export function Surface({ variant = "card", className, ...props }: SurfaceProps) {
    return (
        <View
            className={cn(VARIANT_CLASSES[variant], className)}
            {...props}
        />
    )
}
