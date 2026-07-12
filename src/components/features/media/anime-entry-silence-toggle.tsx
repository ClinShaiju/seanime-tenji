import { useGetAnimeEntrySilenceStatus, useToggleAnimeEntrySilenceStatus } from "@/api/hooks/anime_entries.hooks"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import * as React from "react"
import { ActivityIndicator } from "react-native"

type AnimeEntrySilenceToggleProps = {
    mediaId: number
    className?: string
}

/**
 * Bell toggle mirroring seanime-web's anime-entry-silence-toggle.tsx — mutes
 * missing-episode notifications for this title without removing it from the library.
 */
export function AnimeEntrySilenceToggle({ mediaId, className }: AnimeEntrySilenceToggleProps) {
    const { isSilenced, isLoading } = useGetAnimeEntrySilenceStatus(mediaId)
    const { mutate, isPending } = useToggleAnimeEntrySilenceStatus()

    return (
        <Button
            variant="outline"
            size="icon"
            className={cn("h-8 w-8 rounded-full", className)}
            onPress={() => mutate({ mediaId })}
            disabled={isLoading || isPending}
        >
            {isPending ? (
                <ActivityIndicator size="small" color="rgba(255,255,255,0.6)" />
            ) : (
                <Ionicons
                    name={isSilenced ? "notifications-off-outline" : "notifications-outline"}
                    size={15}
                    color={isSilenced ? "rgba(250,204,21,0.85)" : "rgba(255,255,255,0.7)"}
                />
            )}
        </Button>
    )
}
