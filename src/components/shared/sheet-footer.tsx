import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import * as React from "react"
import { View } from "react-native"

////////////////////////// Container

type SheetFooterProps = {
    children: React.ReactNode
    className?: string
}

export function SheetFooter({ children, className }: SheetFooterProps) {
    return <View className={cn("flex-row gap-3", className)}>{children}</View>
}

////////////////////////// Footer button

type SheetFooterButtonVariant = "cancel" | "primary" | "destructive"

type SheetFooterButtonProps = {
    variant?: SheetFooterButtonVariant
    children: React.ReactNode
    onPress: () => void
    disabled?: boolean
    className?: string
}

const VARIANT_CLASSES: Record<SheetFooterButtonVariant, string> = {
    cancel: "h-13 flex-1 rounded-2xl border border-white/10 bg-white/5 active:bg-white/10",
    primary: "h-13 flex-1 rounded-2xl bg-primary active:opacity-80",
    destructive: "h-13 flex-1 rounded-2xl bg-red-500/10 border border-red-500/20 active:opacity-80",
}

export function SheetFooterButton({
    variant = "primary",
    children,
    onPress,
    disabled,
    className,
}: SheetFooterButtonProps) {
    return (
        <Button
            variant="unstyled"
            className={cn(VARIANT_CLASSES[variant], className)}
            onPress={onPress}
            disabled={disabled}
        >
            {children}
        </Button>
    )
}
