import { useCurrentUser } from "@/atoms/server.atoms"
import { AppTabConfig, TabBar } from "@/components/layout/tabs"
import { Tabs } from "expo-router"
import * as React from "react"

export default function TabLayout() {

    const user = useCurrentUser()

    const tabs: AppTabConfig[] = [
        {
            show: true,
            name: "(library)",
            displayName: "Anime",
            icon: "tv",
        },
        {
            show: true,
            name: "(manga)",
            displayName: "Manga",
            icon: "book",
        },
        {
            show: true,
            name: "schedule",
            displayName: "Schedule",
            icon: "calendar",
        },
        {
            show: true,
            name: "discover",
            displayName: "Discover",
            icon: "compass",
        },
        {
            show: true,
            name: "(profile)",
            displayName: "Profile",
            icon: "cog-outline",
        },
    ]

    return (
        <Tabs
            initialRouteName="(library)"
            screenOptions={{ headerShown: false, freezeOnBlur: true }}
            tabBar={props => <TabBar user={user} tabs={tabs} {...props} />}
        >
            {tabs.map(tab => (
                <Tabs.Screen
                    key={tab.name}
                    name={tab.name}
                    options={{
                        ...tab.options,
                        headerTitle: tab.displayName,
                    }}
                />
            ))}
        </Tabs>
    )
}

