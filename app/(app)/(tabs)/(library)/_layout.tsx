import { LayoutContainerView } from "@/components/layout/layout-view"
import { Stack } from "expo-router"

export default function LibraryLayout() {
    return (
        <LayoutContainerView>
            <Stack screenOptions={{}}>
                <Stack.Screen
                    name="index"
                    options={{
                        headerShown: false,
                    }}
                />
            </Stack>
        </LayoutContainerView>
    )
}
