import { useNakamaSendChatMessage } from "@/api/hooks/nakama.hooks"
import { Text } from "@/components/ui/text"
import { currentWatchRoomAtom, getClientId, useRoomWsListener } from "@/lib/nakama/watch-room"
import { cn } from "@/lib/utils"
import { atom, useAtom } from "jotai"
import { ChevronDown, MessageSquare, Send } from "lucide-react-native"
import React from "react"
import { Keyboard, Pressable, ScrollView, TextInput, View } from "react-native"

// Self-contained in-room text chat, the rooms-model counterpart to seanime-web's
// nakama-watch-party-chat.tsx. It sends through the existing /watch-party/chat hook and
// listens for the server's `nakama-watch-party-chat-message` broadcast. Mounted once,
// app-wide (alongside RoomStreamJoinFab) — it only renders while this client is in a room.
//
// NOTE: the send route lives on the legacy WatchPartyManager, which broadcasts the WS event
// used here; end-to-end delivery therefore depends on the server bridging the rooms model to
// that manager. The client UI is correct regardless and lights up as soon as messages flow.

// The server const is events.NakamaWatchPartyChatMessage; mirrors web's WSEvents value.
const WATCH_PARTY_CHAT_MESSAGE = "nakama-watch-party-chat-message"

type ChatMessage = {
    peerId: string
    username: string
    message: string
    timestamp: string
    messageId: string
}

const ACCENT = "#facc15"

const chatMessagesAtom = atom<ChatMessage[]>([])
const chatMinimizedAtom = atom<boolean>(true)
const chatUnreadAtom = atom<number>(0)

export function WatchPartyChat() {
    const [room] = useAtom(currentWatchRoomAtom)
    const [messages, setMessages] = useAtom(chatMessagesAtom)
    const [minimized, setMinimized] = useAtom(chatMinimizedAtom)
    const [unread, setUnread] = useAtom(chatUnreadAtom)
    const [input, setInput] = React.useState("")
    const [kbHeight, setKbHeight] = React.useState(0)
    const scrollRef = React.useRef<ScrollView>(null)

    const { mutate: sendChatMessage, isPending: isSending } = useNakamaSendChatMessage()

    // My display name (to tag own messages "Me"). The peer send stamps the pool username, so
    // matching on username identifies our own echoed messages without a peerId concept here.
    const clientId = getClientId()
    const myUsername = React.useMemo(() => {
        const entries = Object.values(room?.participants ?? {})
        return entries.find(p => p.clientId === clientId)?.user.username ?? ""
    }, [room, clientId])

    // Incoming messages. useWsMessageListener always invokes the latest closure, so reading
    // `minimized`/`myUsername` directly is safe (no stale capture).
    useRoomWsListener<ChatMessage>(WATCH_PARTY_CHAT_MESSAGE, data => {
        if (!data?.messageId) return
        setMessages(prev => [...prev, data])
        if (minimized && data.username !== myUsername) setUnread(c => c + 1)
    })

    // Reset when leaving the room.
    React.useEffect(() => {
        if (!room) {
            setMessages([])
            setUnread(0)
            setMinimized(true)
        }
    }, [room, setMessages, setUnread, setMinimized])

    // Lift the panel above the keyboard (absolute views aren't pushed automatically).
    React.useEffect(() => {
        const show = Keyboard.addListener("keyboardWillShow", e => setKbHeight(e.endCoordinates.height))
        const hide = Keyboard.addListener("keyboardWillHide", () => setKbHeight(0))
        return () => { show.remove(); hide.remove() }
    }, [])

    // Auto-scroll + clear unread when the panel is open.
    React.useEffect(() => {
        if (!minimized) {
            setUnread(0)
            requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }))
        }
    }, [messages, minimized, setUnread])

    const handleSend = React.useCallback(() => {
        const text = input.trim()
        if (!text || isSending) return
        sendChatMessage({ message: text }, { onSuccess: () => setInput("") })
    }, [input, isSending, sendChatMessage])

    if (!room) return null

    const bottom = kbHeight > 0 ? kbHeight + 12 : 96

    return (
        <View pointerEvents="box-none" style={{ position: "absolute", left: 12, bottom, zIndex: 50 }}>
            {minimized ? (
                <Pressable
                    onPress={() => setMinimized(false)}
                    className="flex-row items-center gap-1.5 rounded-full border border-border bg-background px-3.5 py-2 shadow-lg"
                >
                    <MessageSquare size={16} color="#fff" />
                    <Text className="text-foreground text-sm font-medium">Chat</Text>
                    {unread > 0 && (
                        <View className="min-w-[18px] h-[18px] px-1 items-center justify-center rounded-full bg-red-600">
                            <Text className="text-white text-[10px] font-bold">{unread > 9 ? "9+" : unread}</Text>
                        </View>
                    )}
                </Pressable>
            ) : (
                <View
                    className="rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
                    style={{ width: 320, maxWidth: 360, height: 380 }}
                >
                    <Pressable
                        onPress={() => setMinimized(true)}
                        className="flex-row items-center justify-between px-3.5 py-2.5 border-b border-border"
                    >
                        <View className="flex-row items-center gap-2">
                            <MessageSquare size={16} color="#fff" />
                            <Text className="text-foreground text-sm font-semibold">Watch Party Chat</Text>
                        </View>
                        <ChevronDown size={18} color="#888" />
                    </Pressable>

                    <ScrollView
                        ref={scrollRef}
                        className="flex-1 px-2.5 py-2"
                        keyboardShouldPersistTaps="handled"
                        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
                    >
                        {messages.length === 0 ? (
                            <View className="flex-1 items-center justify-center py-10">
                                <Text className="text-muted-foreground text-sm">No messages yet</Text>
                            </View>
                        ) : (
                            messages.map(msg => {
                                const isOwn = !!myUsername && msg.username === myUsername
                                const isHost = msg.peerId === "host"
                                return (
                                    <View key={msg.messageId} className={cn("rounded-lg px-2 py-1.5 mb-1", isOwn && "bg-white/[0.06]")}>
                                        <View className="flex-row items-baseline justify-between gap-2">
                                            <Text className="text-sm font-semibold" style={{ color: isHost ? ACCENT : "#fff" }} numberOfLines={1}>
                                                {isOwn ? "Me" : msg.username}{isHost ? " (Host)" : ""}
                                            </Text>
                                            <Text className="text-[10px] text-muted-foreground">
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </Text>
                                        </View>
                                        <Text className="text-sm text-foreground/90">{msg.message}</Text>
                                    </View>
                                )
                            })
                        )}
                    </ScrollView>

                    <View className="flex-row items-center gap-2 p-2 border-t border-border">
                        <TextInput
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={handleSend}
                            placeholder="Type a message..."
                            placeholderTextColor="#888"
                            editable={!isSending}
                            returnKeyType="send"
                            className="flex-1 h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-foreground"
                        />
                        <Pressable
                            onPress={handleSend}
                            disabled={!input.trim() || isSending}
                            className={cn("w-10 h-10 items-center justify-center rounded-xl bg-primary", (!input.trim() || isSending) && "opacity-40")}
                        >
                            <Send size={16} color="#fff" />
                        </Pressable>
                    </View>
                </View>
            )}
        </View>
    )
}
