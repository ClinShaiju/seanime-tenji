import { OptionRow } from "@/components/shared/option-row"
import { RowDivider } from "@/components/shared/row-divider"
import { Surface } from "@/components/shared/surface"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { type ExternalPlayerPreset, getPlatformExternalPlayers } from "@/lib/player/external-players"
import { getPlayerPreferences, setPlayerPreferences } from "@/lib/player/player-preferences"
import React from "react"
import { Text } from "react-native"

const CUSTOM_ID = "__custom__"

type ExternalPlayerPickerSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ExternalPlayerPickerSheet({ open, onOpenChange }: ExternalPlayerPickerSheetProps) {
    const presets = React.useMemo(() => getPlatformExternalPlayers(), [])

    const [selected, setSelected] = React.useState<string | null>(null)
    const [customTemplate, setCustomTemplate] = React.useState("")

    // load persisted values when sheet opens
    React.useEffect(() => {
        if (!open) return
        const prefs = getPlayerPreferences()
        const template = prefs.externalPlayerTemplate

        if (!template) {
            setSelected(null)
            setCustomTemplate("")
            return
        }

        const match = presets.find(p => p.urlTemplate === template)
        if (match) {
            setSelected(match.id)
            setCustomTemplate("")
        } else {
            setSelected(CUSTOM_ID)
            setCustomTemplate(template)
        }
    }, [open, presets])

    const handleSelect = (preset: ExternalPlayerPreset | null) => {
        if (preset === null) {
            setSelected(null)
            setCustomTemplate("")
            setPlayerPreferences({ externalPlayerTemplate: null })
        } else {
            setSelected(preset.id)
            setCustomTemplate("")
            setPlayerPreferences({ externalPlayerTemplate: preset.urlTemplate })
        }
    }

    const handleSelectCustom = () => {
        setSelected(CUSTOM_ID)
    }

    const handleCustomTemplateChange = (text: string) => {
        setCustomTemplate(text)
        setPlayerPreferences({ externalPlayerTemplate: text || null })
    }

    const isCustomActive = selected === CUSTOM_ID

    return (
        <SeaBottomSheet
            title="Media Player"
            open={open}
            onOpenChange={onOpenChange}
            snapPoints={["65%", "92%"]}
        >
            <Text className="text-white/50 text-sm mb-4 leading-5">
                When set, video URLs are handed off to the chosen external app instead of the in-app player.
                {/* Use <Text className="text-white/70 font-mono">{"{url}"}</Text> as the placeholder for the stream URL. */}
            </Text>


            <Surface variant="muted" className="overflow-hidden mb-3">
                <OptionRow
                    label="In-App player (mpv)"
                    active={selected === null}
                    onPress={() => handleSelect(null)}
                />
            </Surface>


            {presets.length > 0 && (
                <Surface variant="muted" className="overflow-hidden mb-3">
                    {presets.map((preset, i) => (
                        <React.Fragment key={preset.id}>
                            {i > 0 && <RowDivider />}
                            <OptionRow
                                label={preset.name}
                                detail={preset.urlTemplate}
                                active={selected === preset.id}
                                onPress={() => handleSelect(preset)}
                            />
                        </React.Fragment>
                    ))}
                </Surface>
            )}


            {/* <Surface variant="muted" className="overflow-hidden">
             <OptionRow
             label="Custom URL scheme"
             detail="Enter any scheme manually"
             active={isCustomActive}
             onPress={handleSelectCustom}
             />
             {isCustomActive && (
             <View className="px-4 pb-3 pt-1">
             <TextInput
             value={customTemplate}
             onChangeText={handleCustomTemplateChange}
             placeholder="e.g. myplayer://{url}"
             placeholderTextColor="rgba(255,255,255,0.25)"
             autoCapitalize="none"
             autoCorrect={false}
             keyboardType="url"
             className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-foreground text-sm font-mono"
             style={{ color: "#fff" }}
             />
             </View>
             )}
             </Surface> */}
        </SeaBottomSheet>
    )
}
