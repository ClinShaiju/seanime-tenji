import { atom } from "jotai"
import React from "react"

export const websocketAtom = atom<WebSocket | null>(null)

export const WebsocketContext = React.createContext<WebSocket | null>(null)
