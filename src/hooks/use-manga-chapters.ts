import { ExtensionRepo_MangaProviderExtensionItem, Manga_MangaLatestChapterNumberItem, Nullish } from "@/api/generated/types"
import { useListMangaProviderExtensions } from "@/api/hooks/extensions.hooks"
import { useGetMangaEntryChapters } from "@/api/hooks/manga.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { createAtomStorage } from "@/atoms/storage"
import { useAtom } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import uniq from "lodash/uniq"
import uniqBy from "lodash/uniqBy"
import React from "react"

const __manga_entryProviderAtom = atomWithStorage<Record<string, string>>(
    "sea-manga-entry-provider",
    {},
    createAtomStorage<Record<string, string>>(),
    { getOnInit: true },
)

export type MangaEntryFilters = {
    scanlators: string[]
    language: string
}

const __manga_entryFiltersAtom = atomWithStorage<Record<string, MangaEntryFilters>>(
    "sea-manga-entry-filters",
    {},
    createAtomStorage<Record<string, MangaEntryFilters>>(),
    { getOnInit: true },
)

function pickHighestChapter(
    items: Array<Manga_MangaLatestChapterNumberItem>,
): Manga_MangaLatestChapterNumberItem | null {
    return items.reduce<Manga_MangaLatestChapterNumberItem | null>((current, item) => {
        if (!current || item.number > current.number) {
            return item
        }

        return current
    }, null)
}

export function useStoredMangaSelectionState() {
    const [storedProviders] = useAtom(__manga_entryProviderAtom)
    const [storedFilters] = useAtom(__manga_entryFiltersAtom)

    return {
        storedProviders,
        storedFilters,
    }
}

export function getMangaEntryLatestChapterNumber(
    mangaId: string | number,
    latestChapterNumbers: Record<number, Array<Manga_MangaLatestChapterNumberItem>> | undefined,
    storedProviders: Record<string, string>,
    storedFilters: Record<string, MangaEntryFilters>,
) {
    const mediaKey = String(mangaId)
    const provider = storedProviders[mediaKey]

    if (!provider || !latestChapterNumbers) return null

    const providerChapterNumbers = latestChapterNumbers[Number(mangaId)]?.filter(item => item.provider === provider) ?? []
    if (providerChapterNumbers.length === 0) return null

    const filters = storedFilters[`${mediaKey}$${provider}`]

    let found: Manga_MangaLatestChapterNumberItem | null = null

    if (filters) {
        if (filters.scanlators[0] && filters.language) {
            found = providerChapterNumbers.find(item => (
                item.scanlator === filters.scanlators[0] && item.language === filters.language
            )) ?? null
        }

        if (!found && filters.language) {
            found = pickHighestChapter(providerChapterNumbers.filter(item => item.language === filters.language))
        }

        if (!found && filters.scanlators[0]) {
            found = pickHighestChapter(providerChapterNumbers.filter(item => item.scanlator === filters.scanlators[0]))
        }
    }

    return (found ?? pickHighestChapter(providerChapterNumbers))?.number ?? null
}

function useSelectedMangaProvider(mId: Nullish<string | number>) {
    const serverStatus = useServerStatus()
    const { data: _extensions, isLoading: extensionsLoading } = useListMangaProviderExtensions()

    const extensions = React.useMemo(() => {
        return [...(_extensions ?? [])].sort((a, b) => a.name.localeCompare(b.name))
    }, [_extensions])

    const [storedProvider, setStoredProvider] = useAtom(__manga_entryProviderAtom)
    const mediaKey = mId == null ? null : String(mId)
    const selectedProviderId = mediaKey ? (storedProvider?.[mediaKey] ?? null) : null
    const defaultMangaProvider = serverStatus?.settings?.manga?.defaultMangaProvider

    React.useEffect(() => {
        if (!mediaKey || extensionsLoading || !serverStatus) return

        if (extensions.length === 0) {
            setStoredProvider(prev => {
                if (!(mediaKey in prev)) return prev

                const next = { ...prev }
                delete next[mediaKey]
                return next
            })
            return
        }

        const firstExt = ((!!extensions?.length && extensions?.length > 1)
            ? extensions?.filter(n => n.id !== "local-manga")?.[0]
            : extensions?.[0])

        const defaultExt = defaultMangaProvider
            ? extensions?.find(n => n.id === defaultMangaProvider)
            : null

        const defaultProvider = defaultExt?.id || firstExt?.id || null

        if (!defaultProvider) return

        if (!selectedProviderId) {
            setStoredProvider(prev => prev[mediaKey] === defaultProvider ? prev : {
                ...prev,
                [mediaKey]: defaultProvider,
            })
        } else {
            const isProviderAvailable = extensions.some(provider => provider.id === selectedProviderId)
            if (!isProviderAvailable) {
                setStoredProvider(prev => prev[mediaKey] === defaultProvider ? prev : {
                    ...prev,
                    [mediaKey]: defaultProvider,
                })
            }
        }
    }, [defaultMangaProvider, extensions, extensionsLoading, mediaKey, selectedProviderId, serverStatus, setStoredProvider])

    return {
        selectedExtension: extensions?.find(provider => provider.id === selectedProviderId),
        selectedProvider: selectedProviderId,
        setSelectedProvider: ({ mId: mediaId, provider }: { mId: Nullish<string | number>, provider: string }) => {
            if (!mediaId) return
            setStoredProvider(prev => ({
                ...prev,
                [String(mediaId)]: provider,
            }))
        },
    }
}

function useSelectedMangaFilters(
    mId: Nullish<string | number>,
    selectedExtension: Nullish<ExtensionRepo_MangaProviderExtensionItem>,
    selectedProvider: Nullish<string>,
    isLoaded: boolean,
) {
    const [storedFilters, setStoredFilters] = useAtom(__manga_entryFiltersAtom)

    const mediaKey = mId == null ? null : String(mId)
    const key = mediaKey && selectedProvider ? `${mediaKey}$${selectedProvider}` : null
    const supportsFilters = Boolean(
        selectedExtension?.settings?.supportsMultiScanlator || selectedExtension?.settings?.supportsMultiLanguage,
    )
    const storedFilterEntry = key ? storedFilters[key] : undefined

    React.useEffect(() => {
        if (!isLoaded || !key || !supportsFilters) return

        const defaultFilters: MangaEntryFilters = {
            scanlators: [],
            language: "",
        }

        if (storedFilterEntry) {
            return
        }

        setStoredFilters(prev => prev[key] ? prev : {
            ...prev,
            [key]: defaultFilters,
        })
    }, [isLoaded, key, setStoredFilters, storedFilterEntry, supportsFilters])

    return {
        selectedFilters: (key ? storedFilters[key] : null) || { scanlators: [], language: "" },
        setSelectedScanlator: ({ mId: mediaId, scanlators }: { mId: Nullish<string | number>, scanlators: string[] }) => {
            if (!mediaId || !key) return
            setStoredFilters(prev => ({
                ...prev,
                [key]: { ...prev[key], scanlators },
            }))
        },
        setSelectedLanguage: ({ mId: mediaId, language }: { mId: Nullish<string | number>, language: string }) => {
            if (!mediaId || !key) return
            setStoredFilters(prev => ({
                ...prev,
                [key]: { ...prev[key], language },
            }))
        },
    }
}


function useHandleMangaProviderExtensions() {
    const { data: providerExtensions, isLoading: providerExtensionsLoading } = useListMangaProviderExtensions()

    const providerOptions = React.useMemo(() => {
        return (providerExtensions ?? []).map(provider => ({
            label: provider.name,
            value: provider.id,
        })).sort((a, b) => a.label.localeCompare(b.label))
    }, [providerExtensions])

    return {
        providerExtensions,
        providerOptions,
        providerExtensionsLoading,
    }
}


export function useHandleMangaChapters(mediaId: string | null) {

    const { providerExtensions, providerOptions, providerExtensionsLoading } = useHandleMangaProviderExtensions()

    const {
        selectedExtension,
        selectedProvider,
        setSelectedProvider,
    } = useSelectedMangaProvider(mediaId)

    const {
        data: chapterContainer,
        isLoading: chapterContainerLoading,
        isError: chapterContainerError,
    } = useGetMangaEntryChapters({
        mediaId: Number(mediaId),
        provider: selectedProvider || undefined,
    })

    // scanlator options (only when extension supports multi-scanlator)
    const _scanlatorOptions = React.useMemo(() => {
        if (!selectedExtension?.settings?.supportsMultiScanlator) return []
        const scanlators = uniq(chapterContainer?.chapters?.map(ch => ch.scanlator)?.filter(Boolean) || [])
        return scanlators.map(s => ({ value: s!, label: s! }))
    }, [selectedExtension, chapterContainer])

    // language options (only when extension supports multi-language)
    const _languageOptions = React.useMemo(() => {
        if (!selectedExtension?.settings?.supportsMultiLanguage) return []
        const languages = chapterContainer?.chapters
            ?.map(ch => ch.language ? { language: ch.language, scanlator: ch.scanlator } : null)
            ?.filter(Boolean) || []
        return languages.map(lang => ({ value: lang!, label: lang!.language }))
    }, [selectedExtension, chapterContainer])

    const { setSelectedScanlator, setSelectedLanguage, selectedFilters } = useSelectedMangaFilters(
        mediaId,
        selectedExtension,
        selectedProvider,
        !chapterContainerLoading,
    )

    // filter chapters based on selected scanlator and language
    const filteredChapterContainer = React.useMemo(() => {
        if (!chapterContainer) return chapterContainer

        const filteredChapters = chapterContainer.chapters?.filter(ch => {
            if (selectedExtension?.settings?.supportsMultiLanguage && selectedFilters.language) {
                if (ch.language !== selectedFilters.language) return false
            }
            if (selectedExtension?.settings?.supportsMultiScanlator && selectedFilters.scanlators[0]) {
                if (ch.scanlator !== selectedFilters.scanlators[0]) return false
            }
            return true
        })

        return {
            ...chapterContainer,
            chapters: filteredChapters,
        }
    }, [chapterContainer, selectedExtension, selectedFilters])

    // filter language options by selected scanlator
    const languageOptions = React.useMemo(() => {
        return uniqBy(
            _languageOptions
                .filter(lang => {
                    if (selectedFilters?.scanlators?.[0]?.length) {
                        return lang.value!.scanlator === selectedFilters.scanlators[0]
                    }
                    return true
                })
                .map(lang => ({ value: lang.value!.language, label: lang.label })),
            "value",
        ).filter(n => typeof n.label === "string" && typeof n.value === "string")
    }, [_languageOptions, selectedFilters])

    // filter scanlator options by selected language
    const scanlatorOptions = React.useMemo(() => {
        return uniqBy(
            _scanlatorOptions.filter(scanlator => {
                if (selectedFilters?.language?.length) {
                    return _languageOptions.filter(n =>
                        n.value!.scanlator === scanlator.value
                        && n.value!.language === selectedFilters.language,
                    ).length > 0
                }
                return true
            }).map(s => ({ value: s.value, label: s.label })),
            "value",
        ).filter(n => typeof n.label === "string" && typeof n.value === "string")
    }, [_scanlatorOptions, selectedFilters, _languageOptions])

    return {
        selectedExtension,
        providerExtensions,
        providerExtensionsLoading,
        providerOptions,
        selectedProvider,
        setSelectedProvider,
        selectedFilters,
        setSelectedLanguage,
        setSelectedScanlator,
        languageOptions,
        scanlatorOptions,
        chapterContainer: filteredChapterContainer,
        chapterContainerLoading,
        chapterContainerError,
    }
}
