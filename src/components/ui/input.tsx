import { cn } from "@/lib/utils"
import * as React from "react"
import { TextInput } from "react-native"
import { useCSSVariable } from "uniwind"

const Input = React.forwardRef<
    React.ElementRef<typeof TextInput>,
    React.ComponentPropsWithoutRef<typeof TextInput>
>(({ className, placeholderTextColor, ...props }, ref) => {
    const resolvedPlaceholderColor = useCSSVariable("--color-muted-foreground")

    return (
        <TextInput
            ref={ref}
            className={cn(
                "h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-foreground",
                props.editable === false && "opacity-50",
                className,
            )}
            placeholderTextColor={placeholderTextColor ?? (typeof resolvedPlaceholderColor === "string" ? resolvedPlaceholderColor : undefined)}
            textAlignVertical="center"
            {...props}
        />
    )
})

Input.displayName = "Input"

export { Input }

