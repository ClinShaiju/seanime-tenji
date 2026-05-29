import { Styles } from "@/components/shared/styles"
import React from "react"
import { Platform, View } from "react-native"
import { SafeAreaView, SafeAreaViewProps } from "react-native-safe-area-context"

export function LayoutContainerView({ children }: { children?: React.ReactNode }) {

    if (Platform.OS === "android") {
        return <View style={Styles.Container}>
            {children}
        </View>
    }

    if (Platform.OS === "ios") {
        return <View style={Styles.Container}>
            {children}
        </View>
    }

    return null
}

export function SafeView({ children, ...rest }: { children?: React.ReactNode } & SafeAreaViewProps) {
    return <SafeAreaView style={Styles.Container} edges={["top", "left", "right"]} {...rest}>
        {children}
    </SafeAreaView>
}
