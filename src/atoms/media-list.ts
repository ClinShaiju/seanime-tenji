import { AL_BaseAnime, AL_BaseManga } from "@/api/generated/types"
import { atom } from "jotai"

export type MediaListPageContent = {
    title: string
    type: "anime" | "manga"
    media: Array<AL_BaseAnime | AL_BaseManga>
}

export const __media_listPageContentAtom = atom<MediaListPageContent | null>(null)
