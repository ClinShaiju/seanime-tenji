import { useDebridPrewarmStatus } from "@/api/hooks/debrid.hooks"
import { useServerStatus } from "@/atoms/server.atoms"
import { cn } from "@/lib/utils"
import { Flame } from "lucide-react-native"
import * as React from "react"
import { View } from "react-native"

type PrewarmBadgeProps = {
    mediaId?: number
    episodeNumber?: number
    className?: string
}

/**
 * PrewarmBadge shows a small circular fire badge when the given episode has been prewarmed (its
 * debrid stream is resolved ahead of time and will play instantly).
 *  - orange = prewarmed / ready (instant play)
 *  - red = fully hot (also metadata-warmed — the tier-1 target)
 *
 * Self-contained and self-gating: returns null when the episode isn't prewarmed, or when debrid /
 * preload is off. The underlying status query is shared (deduped) and only runs when preload is on.
 * Pass `className` (e.g. an absolute position) for placement.
 */
export function PrewarmBadge({ mediaId, episodeNumber, className }: PrewarmBadgeProps) {
    const serverStatus = useServerStatus()
    const enabled = !!serverStatus?.debridSettings?.enabled && !!serverStatus?.debridSettings?.preloadNextStream

    const { data } = useDebridPrewarmStatus(enabled)

    const match = React.useMemo(() => {
        if (!enabled || !mediaId || !episodeNumber || !data) return undefined
        return data.find(it => it.mediaId === mediaId && it.episodeNumber === episodeNumber)
    }, [enabled, data, mediaId, episodeNumber])

    if (!match) return null

    const hot = !!match.metadata

    return (
        <View
            className={cn(
                "h-8 w-8 items-center justify-center rounded-full border-2 border-black/40",
                hot ? "bg-[#940a00]" : "bg-[#c24e00]",
                className,
            )}
        >
            <Flame size={20} color="rgba(255,255,255,0.92)" />
        </View>
    )
}
