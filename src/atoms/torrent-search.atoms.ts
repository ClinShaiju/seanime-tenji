import { createAtomStorage } from "@/atoms/storage"
import { atomWithStorage } from "jotai/utils"

export const torrentSearchAcrossProvidersAtom = atomWithStorage<boolean>(
    "sea-torrent-search-across-providers",
    false,
    createAtomStorage<boolean>(),
    { getOnInit: true },
)

export const torrentSearchExtraProviderIdsAtom = atomWithStorage<string[]>(
    "sea-torrent-search-extra-provider-ids",
    [],
    createAtomStorage<string[]>(),
    { getOnInit: true },
)
