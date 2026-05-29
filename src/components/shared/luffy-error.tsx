import { IMAGES } from "@/constants/images"
import * as React from "react"
import { Image, Text, View } from "react-native"

type LuffyErrorProps = {
    title?: string
    description?: string
    children?: React.ReactNode
}

export function LuffyError({ title = "Oops!", description, children }: LuffyErrorProps) {
    return (
        <View className="mt-10 w-full items-center gap-4 px-8">
            <View style={{ width: 128, height: 128 }}>
                <Image
                    source={IMAGES.luffy01}
                    resizeMode="contain"
                    style={{ width: "100%", height: "100%" }}
                />
            </View>
            <View className="items-center gap-3">
                <Text className="text-xl font-bold text-foreground text-center">{title}</Text>
                {!!description && (
                    <Text className="text-sm leading-5 text-white/40 text-center">{description}</Text>
                )}
                {children}
            </View>
        </View>
    )
}