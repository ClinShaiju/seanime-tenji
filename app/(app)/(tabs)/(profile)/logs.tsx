import { ProfileMenuItem, ProfileMenuSection, ProfileMenuToggle, ProfileSubpageHeader, RowDivider } from "@/components/features/profile/profile-menu"
import { useIOSScrollRefreshRateWorkaround } from "@/hooks/use-ios-scroll-refresh-rate-workaround"
import {
    clearOfflineLogs,
    copyOfflineLogTextToClipboard,
    getOfflineCrashText,
    getOfflineLogEntries,
    getOfflineLogText,
    isOfflineLoggingEnabled,
    setOfflineLoggingEnabled,
} from "@/lib/offline-logger"
import { toast } from "@/lib/utils/toast"
import * as React from "react"
import { Alert, ScrollView, Share, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

type LogSummary = {
    entries: number
    crashes: number
}

function readLogSummary(): LogSummary {
    const entries = getOfflineLogEntries()

    return {
        entries: entries.length,
        crashes: entries.filter(entry => entry.level === "fatal" || entry.scope.includes("crash")).length,
    }
}

function formatSummary(summary: LogSummary) {
    if (summary.entries === 0) return "No local logs saved"

    const entryLabel = summary.entries === 1 ? "1 entry" : `${summary.entries} entries`
    const crashLabel = summary.crashes === 0
        ? null
        : summary.crashes === 1 ? "1 crash" : `${summary.crashes} crashes`

    return crashLabel ? `${entryLabel} · ${crashLabel}` : entryLabel
}

function formatCrashSummary(crashes: number) {
    if (crashes === 0) return "No crash records saved"
    return crashes === 1 ? "1 crash record" : `${crashes} crash records`
}

export default function LogsScreen() {
    const insets = useSafeAreaInsets()
    const [loggingEnabled, setLoggingEnabledState] = React.useState(isOfflineLoggingEnabled)
    const [summary, setSummary] = React.useState(readLogSummary)
    const [copyingKind, setCopyingKind] = React.useState<"crash" | "logs" | null>(null)

    useIOSScrollRefreshRateWorkaround()

    const refreshSummary = React.useCallback(() => {
        setLoggingEnabledState(isOfflineLoggingEnabled())
        setSummary(readLogSummary())
    }, [])

    const handleToggleLogging = React.useCallback((enabled: boolean) => {
        setOfflineLoggingEnabled(enabled)
        refreshSummary()
        toast.info(enabled ? "Logging enabled" : "Logging disabled")
    }, [refreshSummary])

    const copyText = React.useCallback((kind: "crash" | "logs") => {
        if (copyingKind) return

        (async () => {
            setCopyingKind(kind)
            try {
                const text = kind === "crash" ? await getOfflineCrashText() : await getOfflineLogText()
                if (!text.trim()) {
                    toast.info(kind === "crash" ? "No crash records yet" : "No diagnostic logs yet")
                    return
                }

                const copied = copyOfflineLogTextToClipboard(text)
                if (copied) {
                    toast.success(kind === "crash" ? "Crash report copied" : "Logs copied")
                    return
                }

                await Share.share({ message: text })
                toast.success(kind === "crash" ? "Crash report ready to share" : "Logs ready to share")
            }
            catch {
                toast.error(kind === "crash" ? "Failed to copy crash report" : "Failed to copy logs")
            }
            finally {
                setCopyingKind(null)
                refreshSummary()
            }
        })()
    }, [copyingKind, refreshSummary])

    const handleClearLogs = React.useCallback(() => {
        Alert.alert(
            "Clear local logs?",
            "Crash records and diagnostic logs stored on this device will be removed.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear",
                    style: "destructive",
                    onPress: () => {
                        clearOfflineLogs()
                        refreshSummary()
                        toast.success("Logs cleared")
                    },
                },
            ],
        )
    }, [refreshSummary])

    return (
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
            <ProfileSubpageHeader
                title="Logs"
                detail="Crash records and temporary diagnostics."
            />

            <ScrollView
                className="flex-1 bg-background"
                contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View className="mx-4 mt-4 gap-4">
                    <ProfileMenuSection title="Capture">
                        <ProfileMenuToggle
                            icon="document-text-outline"
                            label="Enable Logging"
                            detail="Temporarily save app logs on this device"
                            value={loggingEnabled}
                            onToggle={handleToggleLogging}
                        />
                    </ProfileMenuSection>

                    <ProfileMenuSection title="Local Logs">
                        <ProfileMenuItem
                            icon="warning-outline"
                            label={copyingKind === "crash" ? "Preparing Crash Report" : "Copy Crash Report"}
                            detail={formatCrashSummary(summary.crashes)}
                            onPress={() => copyText("crash")}
                            hideChevron
                        />
                        <RowDivider />
                        <ProfileMenuItem
                            icon="copy-outline"
                            label={copyingKind === "logs" ? "Preparing Logs" : "Copy Diagnostic Logs"}
                            detail={formatSummary(summary)}
                            onPress={() => copyText("logs")}
                            hideChevron
                        />
                        <RowDivider />
                        <ProfileMenuItem
                            icon="trash-outline"
                            label="Clear Logs"
                            detail="Remove logs stored on this device"
                            onPress={handleClearLogs}
                            hideChevron
                        />
                    </ProfileMenuSection>

                    <Text className="px-1 text-xs leading-5 text-white/35">
                        Crash records are saved automatically. Continuous app logging is off unless enabled here.
                    </Text>
                </View>
            </ScrollView>
        </View>
    )
}
