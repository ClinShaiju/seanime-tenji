import { Anime_Entry } from "@/api/generated/types"
import * as React from "react"

type AnimeEntryScreenContextValue = {
    id: string
    entry: Anime_Entry
    isFetching: boolean
    refetch: () => Promise<unknown>
}

const AnimeEntryScreenContext = React.createContext<AnimeEntryScreenContextValue | null>(null)

type AnimeEntryScreenProviderProps = {
    value: AnimeEntryScreenContextValue
    children: React.ReactNode
}

export function AnimeEntryScreenProvider({ value, children }: AnimeEntryScreenProviderProps) {
    return (
        <AnimeEntryScreenContext.Provider value={value}>
            {children}
        </AnimeEntryScreenContext.Provider>
    )
}

export function useAnimeEntryScreen() {
    const value = React.useContext(AnimeEntryScreenContext)

    if (!value) {
        throw new Error("useAnimeEntryScreen must be used within AnimeEntryScreenProvider")
    }

    return value
}