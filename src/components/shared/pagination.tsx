import React from "react"
import { StyleSheet, View } from "react-native"

export type PaginationDotStyle = {
    dotColor?: string
    activeDotColor?: string
    dotSize?: number
    activeDotSize?: number
}

const defaultDotStyle: Required<PaginationDotStyle> = {
    dotColor: "lightgray",
    activeDotColor: "darkgray",
    dotSize: 8,
    activeDotSize: 9,
}

type Props = {
    numPages: number
    currentIndex: number
    dotStyle?: PaginationDotStyle
}

export const Pagination = React.memo(
    ({ numPages, currentIndex, dotStyle }: Props) => {
        const { dotColor, activeDotColor, dotSize, activeDotSize } = {
            ...defaultDotStyle,
            ...dotStyle,
        }

        return (
            <View style={styles.paginationContainer}>
                {Array.from({ length: numPages }).map((_, index) => {
                    const isActive = index === currentIndex
                    return (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: isActive ? activeDotColor : dotColor,
                                    width: isActive ? activeDotSize : dotSize,
                                    height: isActive ? activeDotSize : dotSize,
                                },
                            ]}
                        />
                    )
                })}
            </View>
        )
    },
)

const styles = StyleSheet.create({
    paginationContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 16,
    },
    dot: {
        borderRadius: 50,
        marginHorizontal: 4,
    },
})
