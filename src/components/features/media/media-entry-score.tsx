import { getScoreColor } from "@/components/helpers/score"
import { Ionicons } from "@/lib/icons/Ionicons"
import { cn } from "@/lib/utils"
import { Text, View } from "react-native"

type MediaEntryScoreProps = {
    score: number | undefined
}

export function MediaEntryScore({ score }: MediaEntryScoreProps) {
    if (!score) return null

    return (
        <View
            className={cn(
                "h-7 px-2 w-fit rounded-tl-lg flex justify-center items-center",
                "flex flex-row items-center gap-1",
                // "border-l border-t border-muted-foreground",
                getScoreColor(score || 0, "user"),
            )}
        >
            <Ionicons name={score > 82 ? "star" : "star-outline"} size={12} color="white" />
            <Text className="text-lg font-bold text-white">
                {score / 10}
            </Text>
        </View>
    )
}

export function MediaEntryAudienceScore({ score }: MediaEntryScoreProps) {
    if (!score) return null

    return (
        <View
            className={cn(
                "h-7 px-0 w-fit rounded-full flex justify-center items-center",
                "flex flex-row items-center gap-2",
            )}
        >
            <Ionicons name="heart-outline" size={12} colorClassName={getScoreColor(score || 0, "audience-icon")} />
            <Text className={cn("text-md font-bold text-white", getScoreColor(score || 0, "audience"))}>
                {score / 10}
            </Text>
        </View>
    )
}
