import {
    useNakamaCreateWatchRoom,
    useNakamaJoinWatchRoom,
    useNakamaLeaveWatchRoom,
    useNakamaSetWatchRoomAutoSkip,
    useNakamaSetWatchRoomControl,
    useNakamaSetWatchRoomForceTracks,
    useNakamaWatchRoomList,
} from "@/api/hooks/nakama.hooks"
import type { Nakama_RoomCard, Nakama_RoomParticipant } from "@/api/generated/types"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { currentWatchRoomAtom, getClientId, NAKAMA_ROOM_EVENTS, optedOutStreamRoomIdAtom, useRoomStreamJoin, useRoomWsListener } from "@/lib/nakama/watch-room"
import { cn } from "@/lib/utils"
import { Image } from "expo-image"
import { useAtom, useSetAtom } from "jotai"
import { Crown, Lock, Users } from "lucide-react-native"
import React from "react"
import { Pressable, View } from "react-native"

const ACCENT = "#facc15"

export function WatchRoomsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
    const [currentRoom, setCurrentRoom] = useAtom(currentWatchRoomAtom)

    return (
        <SeaBottomSheet open={open} onOpenChange={onOpenChange} title="Watch rooms" snapPoints={["75%"]}>
            {currentRoom
                ? <InRoomPanel onLeft={() => setCurrentRoom(null)} />
                : <DiscoveryPanel onJoined={room => setCurrentRoom(room)} />}
        </SeaBottomSheet>
    )
}

// ---------------------------------------------------------------------------
// Discovery: room cards + inline create
// ---------------------------------------------------------------------------
function DiscoveryPanel({ onJoined }: { onJoined: (room: NonNullable<ReturnType<typeof useNakamaJoinWatchRoom>["data"]>) => void }) {
    const { data: rooms, refetch } = useNakamaWatchRoomList()
    const join = useNakamaJoinWatchRoom()
    const setOptedOut = useSetAtom(optedOutStreamRoomIdAtom)

    // Room-list changes are pushed pool-wide.
    useRoomWsListener(NAKAMA_ROOM_EVENTS.ROOMS_UPDATED, () => { void refetch() })

    return (
        <View className="gap-3">
            <CreateRoomRow onCreated={onJoined} />

            {(!rooms || rooms.length === 0) && (
                <Text className="text-muted-foreground text-sm py-6 text-center">No active rooms. Create one above.</Text>
            )}

            {rooms?.map(room => (
                <RoomCard key={room.id} room={room} joining={join.isPending} onJoin={password => {
                    join.mutate({ roomId: room.id, password: password ?? "", clientId: getClientId() }, {
                        onSuccess: r => {
                            if (!r) return
                            // Joining a room that already has a live stream is button-only (don't
                            // force-open): pre-opt-out so the heartbeat doesn't auto-pull us in.
                            setOptedOut(r.playbackActive ? r.id : null)
                            onJoined(r)
                        },
                    })
                }} />
            ))}
        </View>
    )
}

function CreateRoomRow({ onCreated }: { onCreated: (room: NonNullable<ReturnType<typeof useNakamaCreateWatchRoom>["data"]>) => void }) {
    const create = useNakamaCreateWatchRoom()
    const [name, setName] = React.useState("")
    const [password, setPassword] = React.useState("")
    const [withPassword, setWithPassword] = React.useState(false)

    return (
        <View className="rounded-xl border border-border bg-background p-3 gap-2">
            <Input value={name} onChangeText={setName} placeholder="New room name" />
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                    <Switch checked={withPassword} onCheckedChange={setWithPassword} />
                    <Text className="text-sm text-foreground">Password</Text>
                </View>
                {withPassword && (
                    <Input value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry className="flex-1 ml-3" />
                )}
            </View>
            <Button
                disabled={!name.trim() || create.isPending}
                onPress={() => create.mutate(
                    { name: name.trim(), password: withPassword ? password : "", clientId: getClientId() },
                    { onSuccess: r => { if (r) onCreated(r) } },
                )}
            >
                <Text>Create room</Text>
            </Button>
        </View>
    )
}

function RoomCard({ room, joining, onJoin }: { room: Nakama_RoomCard; joining: boolean; onJoin: (password?: string) => void }) {
    const [showPw, setShowPw] = React.useState(false)
    const [password, setPassword] = React.useState("")

    return (
        <View className="rounded-xl border border-border bg-background overflow-hidden">
            <View className="flex-row p-3 gap-3">
                {room.coverImage
                    ? <Image source={{ uri: room.coverImage }} style={{ width: 44, height: 62, borderRadius: 6 }} contentFit="cover" />
                    : <View style={{ width: 44, height: 62, borderRadius: 6 }} className="bg-muted" />}
                <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                        <Text className="text-foreground font-semibold flex-1" numberOfLines={1}>{room.name}</Text>
                        {room.hasPassword && <Lock size={14} color={ACCENT} />}
                    </View>
                    <Text className="text-muted-foreground text-xs">Host: {room.hostUsername}</Text>
                    {!!room.title && (
                        <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                            {room.title}{room.episodeNumber ? ` · E${room.episodeNumber}` : ""}
                        </Text>
                    )}
                    <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-row items-center gap-1">
                            <Users size={13} color="#888" />
                            <Text className="text-muted-foreground text-xs">{room.memberCount}</Text>
                        </View>
                        <Button
                            size="sm"
                            disabled={joining}
                            onPress={() => room.hasPassword && !showPw ? setShowPw(true) : onJoin(password)}
                        >
                            <Text>Join</Text>
                        </Button>
                    </View>
                </View>
            </View>
            {room.hasPassword && showPw && (
                <View className="px-3 pb-3">
                    <Input value={password} onChangeText={setPassword} placeholder="Room password" secureTextEntry autoFocus />
                </View>
            )}
        </View>
    )
}

// ---------------------------------------------------------------------------
// In-room: members + (host) control panel + force-tracks + autoskip vote
// ---------------------------------------------------------------------------
function InRoomPanel({ onLeft }: { onLeft: () => void }) {
    const [room] = useAtom(currentWatchRoomAtom)
    const leave = useNakamaLeaveWatchRoom()
    const setControl = useNakamaSetWatchRoomControl()
    const setForceTracks = useNakamaSetWatchRoomForceTracks()
    const setAutoSkip = useNakamaSetWatchRoomAutoSkip()
    const setOptedOut = useSetAtom(optedOutStreamRoomIdAtom)
    const roomStreamJoin = useRoomStreamJoin()
    const clientId = getClientId()

    if (!room) return null

    const entries = Object.entries(room.participants ?? {})
    const myEntry = entries.find(([, p]) => p.clientId === clientId)
    const amHost = !!myEntry?.[1]?.isHost
    const myPref = myEntry?.[1]?.autoSkipPref ?? "auto"
    const everyoneControls = entries.every(([k, p]) => k === room.hostKey || p.canControl)

    return (
        <View className="gap-3">
            <View className="flex-row items-center justify-between">
                <View className="flex-1">
                    <Text className="text-foreground text-lg font-semibold">{room.name}</Text>
                    {room.hasPassword && <Text className="text-xs text-muted-foreground">Password protected</Text>}
                </View>
                <Button size="sm" variant="destructive" disabled={leave.isPending}
                    onPress={() => leave.mutate({ roomId: room.id }, {
                        // Always drop local room state — the leave is idempotent server-side, and
                        // if the room is already gone (host closed it) we still want out.
                        onSuccess: () => { setOptedOut(null); onLeft() },
                        onError: () => { setOptedOut(null); onLeft() },
                    })}>
                    <Text>Leave</Text>
                </Button>
            </View>

            {roomStreamJoin.canJoin && (
                <Button disabled={roomStreamJoin.isPending} onPress={roomStreamJoin.join}>
                    <Text>{roomStreamJoin.isPending ? "Joining..." : "Join room stream"}</Text>
                </Button>
            )}

            {/* Members */}
            <Text className="text-muted-foreground text-xs uppercase mt-1">Members ({entries.length})</Text>
            <View className="gap-2">
                {entries.map(([key, p]) => (
                    <MemberRow
                        key={key}
                        participant={p}
                        isController={room.controllerKey === key}
                        showControlToggle={amHost && !p.isHost}
                        onToggleControl={canControl => setControl.mutate({ roomId: room.id, targetKey: key, canControl, all: false })}
                    />
                ))}
            </View>

            {/* Host control panel */}
            {amHost && (
                <View className="rounded-xl border border-border bg-background p-3 gap-3 mt-1">
                    <Row label="Everyone can control">
                        <Switch checked={everyoneControls}
                            onCheckedChange={v => setControl.mutate({ roomId: room.id, targetKey: "", canControl: v, all: true })} />
                    </Row>
                    <Row label="Force my audio/subtitle tracks">
                        <Switch checked={!!room.forceHostTracks}
                            onCheckedChange={v => setForceTracks.mutate({ roomId: room.id, forceHostTracks: v })} />
                    </Row>
                </View>
            )}

            {/* Auto-skip vote */}
            <View className="rounded-xl border border-border bg-background p-3 gap-2 mt-1">
                <Row label="Auto-skip OP/ED">
                    <Text className="text-xs text-muted-foreground">
                        {room.effectiveAutoSkip ? "On" : "Off"} · {room.autoSkipVotesOn} on / {room.autoSkipVotesOff} off
                    </Text>
                </Row>
                <View className="flex-row gap-2">
                    {(["on", "auto", "off"] as const).map(pref => (
                        <Pressable
                            key={pref}
                            onPress={() => setAutoSkip.mutate({ roomId: room.id, pref })}
                            className={cn(
                                "flex-1 items-center py-2 rounded-lg border",
                                myPref === pref ? "border-primary bg-primary/15" : "border-border",
                            )}
                        >
                            <Text className={cn("text-sm capitalize", myPref === pref ? "text-primary" : "text-foreground")}>{pref}</Text>
                        </Pressable>
                    ))}
                </View>
            </View>
        </View>
    )
}

function MemberRow({ participant, isController, showControlToggle, onToggleControl }: {
    participant: Nakama_RoomParticipant
    isController: boolean
    showControlToggle: boolean
    onToggleControl: (canControl: boolean) => void
}) {
    return (
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1">
                {participant.isHost
                    ? <Crown size={14} color={ACCENT} />
                    : <View style={{ width: 14 }} />}
                <Text className="text-foreground text-sm" numberOfLines={1}>{participant.user.username}</Text>
                {isController && <Text className="text-[10px] text-primary">driving</Text>}
            </View>
            {showControlToggle && (
                <Switch checked={participant.canControl} onCheckedChange={onToggleControl} />
            )}
        </View>
    )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View className="flex-row items-center justify-between">
            <Text className="text-sm text-foreground flex-1">{label}</Text>
            {children}
        </View>
    )
}
