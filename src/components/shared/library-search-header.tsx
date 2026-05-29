import * as React from "react"
import { View } from "react-native"
import { LibrarySearchBar, type LibrarySearchBarProps } from "./library-search-bar"

const LIBRARY_SEARCH_HEADER_FADE_HEIGHT = 34
export const LIBRARY_SEARCH_HEADER_TOTAL_HEIGHT = 70

export function LibrarySearchHeader(props: LibrarySearchBarProps) {
    return (
        <View className="absolute left-0 right-0 top-0 z-20" pointerEvents="box-none">
            <View className="bg-background px-4 pt-4 pb-3">
                <LibrarySearchBar {...props} />
            </View>

            {/* <LinearGradient
             pointerEvents="none"
             colors={[
             "rgba(12,12,12,0.98)",
             "rgba(12,12,12,0.84)",
             "rgba(12,12,12,0.42)",
             "rgba(12,12,12,0)",
             ]}
             start={{ x: 0.5, y: 0 }}
             end={{ x: 0.5, y: 1 }}
             style={{ height: LIBRARY_SEARCH_HEADER_FADE_HEIGHT }}
             /> */}
        </View>
    )
}
