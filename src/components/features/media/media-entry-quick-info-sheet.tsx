import { AL_BaseAnime, AL_BaseManga, AL_MediaFormat, AL_MediaStatus } from "@/api/generated/types"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetMangaEntry } from "@/api/hooks/manga.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { SheetFooter, SheetFooterButton } from "@/components/shared/sheet-footer"
import { Surface } from "@/components/shared/surface"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import { LinearGradient } from "expo-linear-gradient"
import { router } from "expo-router"
import * as React from "react"
import { ActivityIndicator, Image, Linking, Pressable, View } from "react-native"
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated"
import { EditAnilistEntry } from "./edit-anilist-entry"
import { MediaEntryAudienceScore } from "./media-entry-score"

const FORMAT_LABELS: Record<AL_MediaFormat, string> = {
    TV: "TV",
    TV_SHORT: "TV Short",
    MOVIE: "Movie",
    SPECIAL: "Special",
    OVA: "OVA",
    ONA: "ONA",
    MUSIC: "Music",
    MANGA: "Manga",
    NOVEL: "Novel",
    ONE_SHOT: "One Shot",
}

const STATUS_LABELS: Record<AL_MediaStatus, string> = {
    FINISHED: "Finished",
    RELEASING: "Releasing",
    NOT_YET_RELEASED: "Upcoming",
    CANCELLED: "Cancelled",
    HIATUS: "On Hiatus",
}

const STATUS_COLORS: Record<AL_MediaStatus, string> = {
    FINISHED: "text-white/50",
    RELEASING: "text-brand-300",
    NOT_YET_RELEASED: "text-brand-300",
    CANCELLED: "text-red-300",
    HIATUS: "text-amber-300",
}

function formatDate(date?: { year?: number; month?: number; day?: number }) {
    if (!date?.year) return null
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    if (date.month && date.day) {
        return `${months[date.month - 1]} ${date.day}, ${date.year}`
    }
    if (date.month) return `${months[date.month - 1]} ${date.year}`
    return String(date.year)
}

function MetaPill({
    label,
    value,
    content,
    valueClass,
}: {
    label: string
    value?: string | number | null
    content?: React.ReactNode
    valueClass?: string
}) {
    if (!value && !content) return null
    return (
        <View className="items-center gap-0.5 flex-1">
            <Text className="text-xs text-white/35 uppercase tracking-widest font-semibold">{label}</Text>
            {value && <Text className={cn("text-sm font-semibold text-white/80", valueClass)}>{value}</Text>}
            {content && <View className="mt-0.5">{content}</View>}
        </View>
    )
}

function TitleRow({ label, value }: { label: string; value?: string | null }) {
    if (!value) return null
    return (
        <View className="flex-row items-start gap-2 py-1">
            <Text numberOfLines={2} className="w-14 flex-none pt-0.5 text-xs font-semibold uppercase tracking-wide text-white/35">
                {label}
            </Text>
            <Text className="text-sm text-white/70 flex-1 leading-5">{value}</Text>
        </View>
    )
}

type MediaEntryQuickInfoSheetProps<T extends "anime" | "manga"> = {
    type: T
    media: (T extends "anime" ? AL_BaseAnime : AL_BaseManga) | null
    open: boolean
    onOpenChange: (open: boolean) => void
    preferFetchedMedia?: boolean
}

export function MediaEntryQuickInfoSheet<T extends "anime" | "manga">({
    type,
    media,
    open,
    onOpenChange,
    preferFetchedMedia,
}: MediaEntryQuickInfoSheetProps<T>) {
    if (!media) return null

    const serverStatus = useServerStatus()
    const { data: animeEntry, isLoading: animeEntryLoading } = useGetAnimeEntry(type === "anime" && open ? media.id : undefined)
    const { data: mangaEntry, isLoading: mangaEntryLoading } = useGetMangaEntry(type === "manga" && open ? media.id : undefined)
    const entry = type === "anime" ? animeEntry : mangaEntry
    const entryLoading = (type === "anime" ? animeEntryLoading : mangaEntryLoading) && !entry
    const displayMedia = (preferFetchedMedia && entry?.media ? entry.media : media) as T extends "anime" ? AL_BaseAnime : AL_BaseManga

    const anime = type === "anime" ? (displayMedia as AL_BaseAnime) : null
    const manga = type === "manga" ? (displayMedia as AL_BaseManga) : null

    const coverUri = displayMedia.coverImage?.extraLarge || displayMedia.coverImage?.large
    const bannerUri = displayMedia.bannerImage || null
    const startDate = formatDate(displayMedia.startDate)
    const endDate = formatDate(displayMedia.endDate)
    const statusLabel = displayMedia.status ? STATUS_LABELS[displayMedia.status] : null
    const statusColor = displayMedia.status ? STATUS_COLORS[displayMedia.status] : undefined
    const formatLabel = displayMedia.format ? FORMAT_LABELS[displayMedia.format] : null
    const genres = displayMedia.genres?.filter(Boolean).slice(0, 5) ?? []
    const hideAudienceScore = serverStatus?.settings?.anilist?.hideAudienceScore ?? false

    function navigateToEntry() {
        onOpenChange(false)
        setTimeout(() => {
            router.push(
                type === "manga"
                    ? `/(app)/entry/manga/${displayMedia.id}`
                    : `/(app)/entry/anime/${displayMedia.id}`,
            )
        }, 200)
    }

    function openOnAniList() {
        if (displayMedia.siteUrl) Linking.openURL(displayMedia.siteUrl)
    }

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={["60%", "90%"]}
            footer={
                <SheetFooter>
                    <SheetFooterButton variant="primary" onPress={navigateToEntry}>
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="open-outline" size={16} color="#fff" />
                            <Text className="font-semibold text-sm text-primary-foreground">Open</Text>
                        </View>
                    </SheetFooterButton>
                    {(open && entry) && <EditAnilistEntry entry={entry} type={type} buttonClassName="h-13 rounded-2xl bg-white/5" />}
                    {(open && entryLoading) && (
                        <View className="h-13 flex-1 rounded-2xl bg-white/5 items-center justify-center">
                            <ActivityIndicator size="small" color="rgba(255,255,255,0.4)" />
                        </View>
                    )}
                    {!!displayMedia.siteUrl && (
                        <Pressable
                            className="w-14 rounded-2xl border border-white/10 bg-white/5 items-center justify-center active:bg-white/10"
                            onPress={openOnAniList}
                        >
                            <Ionicons name="globe-outline" size={18} color="rgba(255,255,255,0.5)" />
                        </Pressable>
                    )}
                </SheetFooter>
            }
        >

            <Animated.View entering={FadeIn.duration(300)} className="mb-4">

                {bannerUri ? (
                    <View
                        style={{
                            marginHorizontal: -16,
                            marginTop: -4,
                            height: 60,
                            overflow: "hidden",
                            marginBottom: 16,
                        }}
                    >
                        <Image
                            source={{ uri: bannerUri }}
                            resizeMode="cover"
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%" }}
                        />

                        <View
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)" }}
                            pointerEvents="none"
                        />

                        <LinearGradient
                            colors={["rgba(0,0,0,0.72)", "rgba(0,0,0,0.22)", "transparent"]}
                            locations={[0, 0.4, 1]}
                            style={{ flex: 1 }}
                        />
                        <LinearGradient
                            colors={["transparent", "rgba(0,0,0,0.22)", "rgba(0,0,0,0.72)"]}
                            locations={[0, 1, 1]}
                            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                        />
                        {/* <View
                         style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, backgroundColor: "rgba(0,0,0,0.55)" }}
                         pointerEvents="none"
                         /> */}
                    </View>
                ) : null}


                <View className="flex-row gap-4 items-start">
                    <View
                        className="rounded-xl overflow-hidden shadow-lg -mt-12"
                        style={{ width: 80, height: 120, flexShrink: 0 }}
                    >
                        {coverUri ? (
                            <Image
                                source={{ uri: coverUri }}
                                style={{ width: "100%", height: "100%" }}
                            />
                        ) : (
                            <View className="w-full h-full bg-white/5 items-center justify-center">
                                <Ionicons name="image-outline" size={24} color="rgba(255,255,255,0.2)" />
                            </View>
                        )}
                    </View>
                    <View className="flex-1 pt-1 gap-1">
                        <Text className="text-base font-bold leading-snug text-white">
                            {displayMedia.title?.userPreferred}
                        </Text>
                        {displayMedia.title?.romaji !== displayMedia.title?.userPreferred && (
                            <Text className="text-sm leading-5 text-white/45">
                                {displayMedia.title?.romaji}
                            </Text>
                        )}

                        {genres.length > 0 && (
                            <View className="flex-row flex-wrap gap-1.5 mt-1.5">
                                {genres.map(g => (
                                    <View key={g} className="rounded-full px-1">
                                        <Text className="text-xs text-white/50 font-medium">{g}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            </Animated.View>


            <Animated.View entering={FadeInUp.delay(80).duration(300)}>
                <Surface variant="muted" className="flex-row py-3 px-2 mb-4">
                    <MetaPill label="Format" value={formatLabel} />
                    <View className="w-px bg-white/10 self-stretch mx-1" />
                    <MetaPill
                        label="Status"
                        value={statusLabel}
                        valueClass={statusColor}
                    />
                    <View className="w-px bg-white/10 self-stretch mx-1" />
                    {anime && (
                        <MetaPill
                            label="Episodes"
                            value={anime.episodes ?? "-"}
                        />
                    )}
                    {manga && (
                        <MetaPill
                            label="Chapters"
                            value={manga.chapters ?? "-"}
                        />
                    )}
                    {!hideAudienceScore ? (
                        <>
                            <View className="w-px bg-white/10 self-stretch mx-1" />
                            <MetaPill
                                label="Score"
                                // value={media.meanScore ? `${media.meanScore}%` : null}
                                content={<MediaEntryAudienceScore score={displayMedia.meanScore} />}
                            />
                        </>
                    ) : null}
                </Surface>
            </Animated.View>


            <Animated.View entering={FadeInUp.delay(140).duration(300)}>
                <Surface variant="card" className="mb-4 px-3 py-2 overflow-hidden">
                    {/* <FormSectionLabel className="mb-2">Titles</FormSectionLabel> */}
                    <TitleRow label="EN" value={displayMedia.title?.english} />
                    <TitleRow label="RO" value={displayMedia.title?.romaji} />
                    {/* {media.synonyms?.filter(Boolean).slice(0, 2).map((syn, i) => (
                     <TitleRow key={i} label={i === 0 ? "AKA" : ""} value={syn} />
                     ))} */}
                </Surface>
            </Animated.View>


            {(startDate || endDate) && (
                <Animated.View entering={FadeInUp.delay(180).duration(300)}>
                    <Surface variant="card" className="mb-4 px-3 py-2">
                        {/* <FormSectionLabel className="mb-2">Dates</FormSectionLabel> */}
                        <TitleRow label="Start" value={startDate} />
                        <TitleRow label="End" value={endDate} />
                        {anime?.season && (
                            <TitleRow
                                label="Season"
                                value={`${anime.season.charAt(0) + anime.season.slice(1).toLowerCase()} ${anime.seasonYear ?? ""}`}
                            />
                        )}
                    </Surface>
                </Animated.View>
            )}
        </SeaBottomSheet>
    )
}
