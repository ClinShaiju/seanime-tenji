import { useAnizipArtwork } from "@/api/hooks/anizip.hooks"
import { Image } from "expo-image"
import { LinearGradient } from "expo-linear-gradient"
import React from "react"
import { ActivityIndicator, StyleSheet, Text, View } from "react-native"
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from "react-native-reanimated"

type PlayerLoadingScreenProps = {
    /** AniList media id to fetch ani.zip artwork for. */
    mediaId?: number | null
    /** Current per-step loading status text (already truthful; from the stream session machinery). */
    statusText?: string | null
    /** Resolved torrent/debrid name, shown as a small caption. */
    torrentName?: string | null
    /** Fallback title when ani.zip has no clearlogo (e.g. AniList userPreferred title). */
    fallbackTitle?: string | null
    /** Fallback backdrop when ani.zip has no fanart (e.g. AniList banner/cover). */
    fallbackImage?: string | null
}

const BACKDROP_DIM = 0.4
const REVEAL_MS = 900
const LOGO_REVEAL_MS = 700

const FALLBACK_GRADIENT = ["#0b0f1a", "#141b2e", "#0b0f1a"] as const
const SCRIM_GRADIENT = ["transparent", "rgba(0,0,0,0.85)"] as const

/**
 * Stremio-style stream loading screen: a dimmed ani.zip fanart backdrop + clearlogo behind the
 * per-step status text, with a load-gated fade-in (revealed only once the backdrop — and the logo,
 * when present — have loaded), an animated gradient fallback when artwork is absent/unloaded, and a
 * torrent-name caption. Purely a visual layer over the existing loading state; renders nothing
 * blocking when there is no artwork beyond the same status text the bare screen showed.
 */
export function PlayerLoadingScreen({ mediaId, statusText, torrentName, fallbackTitle, fallbackImage }: PlayerLoadingScreenProps) {
    const { data: artwork } = useAnizipArtwork(mediaId)

    const backdrop = artwork?.fanart || fallbackImage || undefined
    const logo = artwork?.logo || undefined
    const title = artwork?.title || fallbackTitle || undefined

    const hasBackdrop = !!backdrop

    const [backdropLoaded, setBackdropLoaded] = React.useState(false)
    const [logoLoaded, setLogoLoaded] = React.useState(false)

    // Reset the load gate whenever the artwork source changes (e.g. next episode).
    React.useEffect(() => {
        setBackdropLoaded(false)
        setLogoLoaded(false)
    }, [backdrop, logo])

    // Gate: reveal only once the backdrop and (if present) the logo have both finished loading.
    const artworkReady = hasBackdrop && backdropLoaded && (logo ? logoLoaded : true)

    // Fade-in driver for backdrop + scrim + logo/title.
    const reveal = useSharedValue(0)
    React.useEffect(() => {
        reveal.value = withTiming(artworkReady ? 1 : 0, { duration: REVEAL_MS })
    }, [artworkReady, reveal])

    // Slow "breathing" of the fallback gradient so an artwork-less start isn't a dead black screen.
    const pulse = useSharedValue(0.4)
    React.useEffect(() => {
        pulse.value = withRepeat(
            withSequence(withTiming(0.55, { duration: 5000 }), withTiming(0.35, { duration: 5000 })),
            -1,
            true,
        )
    }, [pulse])

    const backdropStyle = useAnimatedStyle(() => ({ opacity: reveal.value * BACKDROP_DIM }))
    const scrimStyle = useAnimatedStyle(() => ({ opacity: reveal.value }))
    const logoStyle = useAnimatedStyle(() => ({ opacity: reveal.value }))
    const fallbackStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))

    const showFallback = !hasBackdrop
    const showSpinnerBadge = artworkReady || showFallback

    return (
        <View style={StyleSheet.absoluteFill} className="bg-black">
            {/* Animated gradient fallback when no artwork is available */}
            {showFallback && (
                <Animated.View style={[StyleSheet.absoluteFill, fallbackStyle]} pointerEvents="none">
                    <LinearGradient
                        colors={FALLBACK_GRADIENT}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            )}

            {/* Dimmed backdrop */}
            {hasBackdrop && (
                <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]} pointerEvents="none">
                    <Image
                        source={{ uri: backdrop }}
                        onLoad={() => setBackdropLoaded(true)}
                        contentFit="cover"
                        transition={0}
                        style={StyleSheet.absoluteFill}
                    />
                </Animated.View>
            )}

            {/* Bottom scrim so the status text stays legible over the backdrop */}
            {hasBackdrop && (
                <Animated.View
                    style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" }, scrimStyle]}
                    pointerEvents="none"
                >
                    <LinearGradient colors={SCRIM_GRADIENT} style={{ flex: 1 }} />
                </Animated.View>
            )}

            {/* Hidden logo preloader — drives the logoLoaded gate; the visible logo renders below. */}
            {logo && (
                <Image source={{ uri: logo }} onLoad={() => setLogoLoaded(true)} style={{ width: 1, height: 1, opacity: 0 }} />
            )}

            {/* Center content */}
            <View style={StyleSheet.absoluteFill} className="items-center justify-center px-8 gap-6" pointerEvents="none">
                {artworkReady && logo ? (
                    <Animated.View style={[{ width: "60%", height: "35%" }, logoStyle]}>
                        <Image source={{ uri: logo }} contentFit="contain" transition={0} style={StyleSheet.absoluteFill} />
                    </Animated.View>
                ) : artworkReady && title ? (
                    <Animated.View style={logoStyle} className="max-w-[80%]">
                        <Text className="text-2xl font-bold text-white text-center" numberOfLines={3}>
                            {title}
                        </Text>
                    </Animated.View>
                ) : statusText ? (
                    <ActivityIndicator size="large" color="#ffffff" />
                ) : null}

                {!!statusText && (
                    <View className="items-center gap-1.5">
                        <View className="flex-row items-center gap-3">
                            {showSpinnerBadge && <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />}
                            <Text className="text-sm font-medium tracking-wide text-white/80 text-center">{statusText}</Text>
                        </View>
                        {!!torrentName && (
                            <Text className="text-xs text-white/40 text-center max-w-[75%]" numberOfLines={1}>
                                {torrentName}
                            </Text>
                        )}
                    </View>
                )}
            </View>
        </View>
    )
}
