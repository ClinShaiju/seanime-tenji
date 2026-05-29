import { Manga_Entry } from "@/api/generated/types"
import * as React from "react"

type MangaEntryScreenContextValue = {
    id: string
    entry: Manga_Entry
    isFetching: boolean
    refetch: () => Promise<unknown>
}

const MangaEntryScreenContext = React.createContext<MangaEntryScreenContextValue | null>(null)

type MangaEntryScreenProviderProps = {
    value: MangaEntryScreenContextValue
    children: React.ReactNode
}

export function MangaEntryScreenProvider({ value, children }: MangaEntryScreenProviderProps) {
    return (
        <MangaEntryScreenContext.Provider value={value}>
            {children}
        </MangaEntryScreenContext.Provider>
    )
}

export function useMangaEntryScreen() {
    const value = React.useContext(MangaEntryScreenContext)

    if (!value) {
        throw new Error("useMangaEntryScreen must be used within MangaEntryScreenProvider")
    }

    return value
}
