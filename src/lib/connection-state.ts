import NetInfo, { type NetInfoState } from "@react-native-community/netinfo"
import { onlineManager } from "@tanstack/react-query"
import { useEffect } from "react"
import { getStoredManualOfflineMode } from "./offline/manual-offline-mode"

export type ServerReachability = "unknown" | "reachable" | "unreachable"

type ConnectionSnapshot = {
    hasNetwork: boolean
    serverReachability: ServerReachability
}

let snapshot: ConnectionSnapshot = {
    hasNetwork: true,
    serverReachability: "unknown",
}

const listeners = new Set<() => void>()

function syncOnlineManager(): void {
    onlineManager.setOnline(snapshot.hasNetwork && !getStoredManualOfflineMode())
}

function emitChange(): void {
    listeners.forEach(listener => listener())
}

function updateSnapshot(updater: (current: ConnectionSnapshot) => ConnectionSnapshot): void {
    const next = updater(snapshot)

    if (
        next.hasNetwork === snapshot.hasNetwork
        && next.serverReachability === snapshot.serverReachability
    ) {
        return
    }

    snapshot = next
    syncOnlineManager()
    emitChange()
}

function hasDeviceNetwork(state: NetInfoState): boolean {
    return state.isConnected !== false
}

function applyNetInfoState(state: NetInfoState): void {
    const nextHasNetwork = hasDeviceNetwork(state)
    setDeviceNetworkState(nextHasNetwork)
}

syncOnlineManager()

export function subscribeToConnectionState(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

export function getConnectionSnapshot(): ConnectionSnapshot {
    return snapshot
}

export function setDeviceNetworkState(hasNetwork: boolean): void {
    updateSnapshot(current => {
        if (!hasNetwork) {
            return {
                hasNetwork: false,
                serverReachability: "unreachable",
            }
        }

        return {
            hasNetwork: true,
            serverReachability: current.hasNetwork ? current.serverReachability : "unknown",
        }
    })
}

export function degradeServerReachability(): void {
    updateSnapshot(current => {
        if (!current.hasNetwork || current.serverReachability !== "reachable") {
            return current
        }

        return {
            ...current,
            serverReachability: "unknown",
        }
    })
}

export function markServerReachable(): void {
    updateSnapshot(current => {
        if (current.serverReachability === "reachable") {
            return current
        }

        return {
            ...current,
            serverReachability: "reachable",
        }
    })
}

export function markServerUnreachable(): void {
    updateSnapshot(current => {
        if (!current.hasNetwork || current.serverReachability === "unreachable") {
            return current
        }

        return {
            ...current,
            serverReachability: "unreachable",
        }
    })
}

export function isManualOfflineModeEnabled(): boolean {
    return getStoredManualOfflineMode()
}

export function isGlobalConnected(): boolean {
    return !isManualOfflineModeEnabled()
        && snapshot.hasNetwork
        && snapshot.serverReachability !== "unreachable"
}

export function syncManualOfflineConnectionState(): void {
    syncOnlineManager()
    emitChange()
}

export function useConnectionStateMonitor(): void {
    useEffect(() => {
        let mounted = true

        const handleState = (state: NetInfoState) => {
            if (!mounted) return
            applyNetInfoState(state)
        }

        const unsubscribe = NetInfo.addEventListener(handleState)

        NetInfo.fetch()
            .then(handleState)
            .catch(() => {
            })

        return () => {
            mounted = false
            unsubscribe()
        }
    }, [])
}
