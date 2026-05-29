import { cn } from "@/lib/utils"
import * as React from "react"
import { TextInput } from "react-native"
import { useCSSVariable } from "uniwind"

const Textarea = React.forwardRef<
    React.ElementRef<typeof TextInput>,
    React.ComponentPropsWithoutRef<typeof TextInput>
>(({ className, multiline = true, numberOfLines = 4, placeholderTextColor, ...props }, ref) => {
    const resolvedPlaceholderColor = useCSSVariable("--color-muted-foreground")

    return (
        <TextInput
            ref={ref}
            className={cn(
                "web:flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base lg:text-sm native:text-lg native:leading-[1.25] text-foreground web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2",
                props.editable === false && "opacity-50 web:cursor-not-allowed",
                className,
            )}
            placeholderTextColor={placeholderTextColor ?? (typeof resolvedPlaceholderColor === "string" ? resolvedPlaceholderColor : undefined)}
            multiline={multiline}
            numberOfLines={numberOfLines}
            textAlignVertical="top"
            {...props}
        />
    )
})

Textarea.displayName = "Textarea"

export { Textarea }
