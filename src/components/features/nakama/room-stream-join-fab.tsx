import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { useRoomStreamJoin } from "@/lib/nakama/watch-room"
import { Play } from "lucide-react-native"
import { View } from "react-native"

// RoomStreamJoinFab is a global floating "Join room stream" button. It appears whenever the
// room you're in has a live stream you aren't watching (e.g. after you left it), so you can
// rejoin from anywhere without opening the rooms sheet. Mounted once, app-wide.
export function RoomStreamJoinFab() {
    const { canJoin, join, isPending } = useRoomStreamJoin()
    if (!canJoin) return null
    return (
        <View style={{ position: "absolute", bottom: 96, right: 16, zIndex: 50 }} pointerEvents="box-none">
            <Button size="sm" onPress={join} disabled={isPending} className="flex-row items-center gap-1.5 shadow-lg">
                <Play size={14} color="white" fill="white" />
                <Text>{isPending ? "Joining..." : "Join room stream"}</Text>
            </Button>
        </View>
    )
}
