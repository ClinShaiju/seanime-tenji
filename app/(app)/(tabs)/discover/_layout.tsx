import { Stack } from "expo-router"

export default function DiscoverLayout() {
    return (
        <Stack screenOptions={{ headerBackTitle: "Discover" }}>
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="search"
                options={{
                    headerShown: false,
                    animation: "fade",
                }}
            />
        </Stack>
    )
}
