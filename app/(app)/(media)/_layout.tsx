import { Stack } from "expo-router"

export default function MediaLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            {/* devnote: disabling swipe-back on the player to prevent accidental exits */}
            <Stack.Screen name="player" options={{ gestureEnabled: false }} />
        </Stack>
    )
}
