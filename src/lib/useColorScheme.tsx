import { Appearance } from "react-native"
import { Uniwind, useUniwind } from "uniwind"

export function useColorScheme() {
    const { theme, hasAdaptiveThemes } = useUniwind()
    const colorScheme: "light" | "dark" = hasAdaptiveThemes
        ? Appearance.getColorScheme() === "light" ? "light" : "dark"
        : theme === "light" ? "light" : "dark"

    return {
        colorScheme,
        isDarkColorScheme: colorScheme === "dark",
        setColorScheme: (nextColorScheme: "light" | "dark") => Uniwind.setTheme(nextColorScheme),
        toggleColorScheme: () => Uniwind.setTheme(colorScheme === "dark" ? "light" : "dark"),
    }
}
