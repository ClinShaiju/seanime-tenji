import { useServerUrl } from "@/atoms/server.atoms"
import { drainMutationQueue, getPendingMutationCount } from "@/lib/offline/mutation-queue"
import { logger } from "@/lib/utils/logger"
import { toast } from "@/lib/utils/toast"
import { useQueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useServerConnectionState } from "./use-offline"

/**
 * Sync service, drains the offline mutation queue when server reachability is re-established after being confirmed unavailable.
 *
 */
export function useOfflineSyncService() {
    const connectionState = useServerConnectionState()
    const serverUrl = useServerUrl()
    const queryClient = useQueryClient()
    const prevConnected = useRef(false)
    const draining = useRef(false)

    useEffect(() => {
        const isConnected = connectionState === "connected"

        // only trigger on reconnection
        const justReconnected = isConnected && !prevConnected.current
        prevConnected.current = isConnected

        if (!justReconnected || !serverUrl || draining.current) return

        const pendingCount = getPendingMutationCount()
        if (pendingCount === 0) return

        draining.current = true

        logger("sync-service").info(`Connection restored, draining ${pendingCount} pending mutations`)

        drainMutationQueue(serverUrl)
            .then(async (result) => {
                if (result.processed > 0) {
                    toast.success(`Synced ${result.processed} offline changes`)

                    await queryClient.invalidateQueries()
                }
                if (result.skippedConflicts > 0) {
                    toast.info(`${result.skippedConflicts} offline changes skipped because upstream changed`)
                    await queryClient.invalidateQueries()
                }
                if (result.remaining > 0) {
                    logger("sync-service").warning(
                        `${result.remaining} mutations still pending: ${result.error}`,
                    )
                }
            })
            .catch((err) => {
                logger("sync-service").error("Sync drain failed:", err)
            })
            .finally(() => {
                draining.current = false
            })
    }, [connectionState, serverUrl, queryClient])
}
