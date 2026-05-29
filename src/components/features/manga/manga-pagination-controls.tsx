import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import { Pressable, Text, View } from "react-native"

type MangaPaginationControlsProps = {
    page: number
    totalPages: number
    onPageChange: (page: number) => void
}

export function MangaPaginationControls({
    page,
    totalPages,
    onPageChange,
}: MangaPaginationControlsProps) {
    return (
        <View className="flex-row items-center justify-center gap-3 py-1">
            <Pressable
                onPress={() => onPageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                className={cn(
                    "h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/30",
                    page === 0 && "opacity-30",
                )}
            >
                <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.82)" />
            </Pressable>

            <Text className="min-w-16 text-center text-sm font-medium text-muted-foreground">
                {page + 1} / {totalPages}
            </Text>

            <Pressable
                onPress={() => onPageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page === totalPages - 1}
                className={cn(
                    "h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/30",
                    page === totalPages - 1 && "opacity-30",
                )}
            >
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.82)" />
            </Pressable>
        </View>
    )
}