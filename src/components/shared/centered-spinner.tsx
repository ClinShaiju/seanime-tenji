import React from "react"
import { ActivityIndicator, View } from "react-native"

type CenteredSpinnerProps = {}

export function CenteredSpinner(props: CenteredSpinnerProps) {

    const {
        ...rest
    } = props

    return (
        <View className="flex justify-center py-8">
            <ActivityIndicator size="large" color="#fff" />
        </View>
    )
}
