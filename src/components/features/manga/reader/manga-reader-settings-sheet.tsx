import { MANGA_PAGE_FIT, MANGA_READING_DIRECTION, MANGA_READING_MODE, type MangaReaderSettings } from "@/components/features/manga/reader/manga-reader-state"
import { RowDivider } from "@/components/shared/row-divider"
import { Surface } from "@/components/shared/surface"
import { SeaBottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { FormSectionLabel } from "@/components/ui/form-field"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import Ionicons from "@expo/vector-icons/Ionicons"
import Slider from "@react-native-community/slider"
import * as React from "react"
import { Pressable, Text, View } from "react-native"

type MangaReaderSettingsSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    settings: MangaReaderSettings
    defaults: MangaReaderSettings
    onSettingChange: <Key extends keyof MangaReaderSettings>(
        key: Key,
        value: MangaReaderSettings[Key],
    ) => void
    onReset: () => void
}

export function MangaReaderSettingsSheet({
    open,
    onOpenChange,
    settings,
    defaults,
    onSettingChange,
    onReset,
}: MangaReaderSettingsSheetProps) {
    const hasCustomSettings = JSON.stringify(settings) !== JSON.stringify(defaults)

    return (
        <SeaBottomSheet
            open={open}
            onOpenChange={onOpenChange}
            title="Reader Settings"
            snapPoints={["82%"]}
            footer={
                <View className="flex-row items-center gap-3">
                    <Button
                        variant="secondary"
                        className="flex-1 rounded-xl"
                        onPress={onReset}
                        disabled={!hasCustomSettings}
                    >
                        <Text className="text-secondary-foreground text-sm font-medium">Reset</Text>
                    </Button>
                    <Button className="flex-1 rounded-xl" onPress={() => onOpenChange(false)}>
                        <Text className="text-primary-foreground text-sm font-semibold">Done</Text>
                    </Button>
                </View>
            }
        >
            <View className="gap-5 pb-4">
                <SettingsSection title="Reading Mode">
                    <OptionGrid
                        options={[
                            { value: MANGA_READING_MODE.LONG_STRIP, label: "Long Strip", icon: "swap-vertical" },
                            { value: MANGA_READING_MODE.PAGED, label: "Single Page", icon: "albums-outline" },
                            { value: MANGA_READING_MODE.DOUBLE_PAGE, label: "Double Page", icon: "book-outline" },
                        ]}
                        value={settings.readingMode}
                        onChange={(value) => onSettingChange("readingMode", value)}
                    />
                </SettingsSection>

                <SettingsSection title="Reading Direction">
                    <OptionGrid
                        options={[
                            { value: MANGA_READING_DIRECTION.RTL, label: "Right to Left", icon: "arrow-back" },
                            { value: MANGA_READING_DIRECTION.LTR, label: "Left to Right", icon: "arrow-forward" },
                        ]}
                        value={settings.readingDirection}
                        onChange={(value) => onSettingChange("readingDirection", value)}
                        columns={2}
                    />
                </SettingsSection>

                <SettingsSection title="Page Fit">
                    <OptionGrid
                        options={[
                            { value: MANGA_PAGE_FIT.CONTAIN, label: "Contain", icon: "scan-outline" },
                            { value: MANGA_PAGE_FIT.OVERFLOW, label: "Overflow", icon: "expand-outline" },
                            { value: MANGA_PAGE_FIT.COVER, label: "Cover", icon: "crop-outline" },
                            { value: MANGA_PAGE_FIT.TRUE_SIZE, label: "True size", icon: "resize-outline" },
                        ]}
                        value={settings.pageFit}
                        onChange={(value) => onSettingChange("pageFit", value)}
                        columns={2}
                    />
                </SettingsSection>

                <SettingsSection title="Display">
                    <Surface className="overflow-hidden">
                        <ToggleRow
                            title="Reading progress bar"
                            value={settings.showProgressBar}
                            onValueChange={(value) => onSettingChange("showProgressBar", value)}
                        />
                        <RowDivider />
                        <ToggleRow
                            title="Page gaps"
                            value={settings.pageGap}
                            onValueChange={(value) => onSettingChange("pageGap", value)}
                        />
                        {settings.pageGap && (
                            <>
                                <RowDivider />
                                <SliderRow
                                    title="Gap amount"
                                    description="Adjust the spacing between reader pages."
                                    value={settings.pageGapAmount}
                                    min={0}
                                    max={24}
                                    step={1}
                                    formatValue={(value) => `${value}px`}
                                    onChange={(value) => onSettingChange("pageGapAmount", value)}
                                />
                                <RowDivider />
                                <ToggleRow
                                    title="Gap shadow"
                                    value={settings.pageGapShadow}
                                    onValueChange={(value) => onSettingChange("pageGapShadow", value)}
                                />
                            </>
                        )}
                    </Surface>
                </SettingsSection>

                {settings.readingMode === MANGA_READING_MODE.DOUBLE_PAGE && (
                    <SettingsSection title="Double Page Offset">
                        <Surface className="overflow-hidden">
                            <StepperRow
                                title="Leading solo pages"
                                description="Adjusts spread pairing when a chapter begins with a cover."
                                min={0}
                                max={6}
                                step={1}
                                value={settings.doublePageOffset}
                                formatValue={(value) => `${value}`}
                                onChange={(value) => onSettingChange("doublePageOffset", value)}
                            />
                        </Surface>
                    </SettingsSection>
                )}
            </View>
        </SeaBottomSheet>
    )
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View className="gap-2">
            <FormSectionLabel className="px-1">{title}</FormSectionLabel>
            {children}
        </View>
    )
}

function ToggleRow({
    title,
    value,
    onValueChange,
}: {
    title: string
    value: boolean
    onValueChange: (value: boolean) => void
}) {
    return (
        <View className="flex-row items-center justify-between px-4 py-3.5">
            <Text className="text-sm font-medium text-foreground">{title}</Text>
            <Switch checked={value} onCheckedChange={onValueChange} />
        </View>
    )
}

function SliderRow({
    title,
    description,
    value,
    min,
    max,
    step,
    formatValue,
    onChange,
}: {
    title: string
    description: string
    value: number
    min: number
    max: number
    step: number
    formatValue: (value: number) => string
    onChange: (value: number) => void
}) {
    return (
        <View className="px-4 py-3.5 gap-3">
            <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1 gap-0.5">
                    <Text className="text-sm font-medium text-foreground">{title}</Text>
                    <Text className="text-xs text-muted-foreground">{description}</Text>
                </View>
                <Text className="text-xs font-semibold text-white/40">{formatValue(value)}</Text>
            </View>
            <Slider
                minimumValue={min}
                maximumValue={max}
                step={step}
                value={value}
                onValueChange={onChange}
                minimumTrackTintColor="rgb(199,194,255)"
                maximumTrackTintColor="rgba(255,255,255,0.12)"
                thumbTintColor="rgb(199,194,255)"
            />
        </View>
    )
}

function StepperRow({
    title,
    description,
    min,
    max,
    step,
    value,
    formatValue,
    onChange,
}: {
    title: string
    description: string
    min: number
    max: number
    step: number
    value: number
    formatValue: (value: number) => string
    onChange: (value: number) => void
}) {
    return (
        <View className="px-4 py-3.5 gap-3">
            <View className="gap-0.5">
                <Text className="text-sm font-medium text-foreground">{title}</Text>
                <Text className="text-xs text-muted-foreground">{description}</Text>
            </View>
            <View className="flex-row items-center gap-3">
                <StepperButton
                    icon="remove"
                    disabled={value <= min}
                    onPress={() => onChange(Math.max(min, value - step))}
                />
                <View className="flex-1 items-center">
                    <Text className="text-base font-semibold text-foreground">{formatValue(value)}</Text>
                </View>
                <StepperButton
                    icon="add"
                    disabled={value >= max}
                    onPress={() => onChange(Math.min(max, value + step))}
                />
            </View>
        </View>
    )
}

function StepperButton({
    icon,
    disabled,
    onPress,
}: {
    icon: React.ComponentProps<typeof Ionicons>["name"]
    disabled?: boolean
    onPress: () => void
}) {
    return (
        <Pressable
            onPress={disabled ? undefined : onPress}
            className={cn(
                "h-10 w-10 items-center justify-center rounded-full bg-white/5",
                disabled && "opacity-30",
            )}
        >
            <Ionicons name={icon} size={17} color="rgba(255,255,255,0.80)" />
        </Pressable>
    )
}

function OptionGrid<TValue extends string>({
    options,
    value,
    onChange,
    columns = 3,
}: {
    options: Array<{ value: TValue; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }>
    value: TValue
    onChange: (value: TValue) => void
    columns?: 2 | 3
}) {
    return (
        <View className={cn("gap-2", columns === 2 ? "flex-row flex-wrap" : "")}>
            {options.map(option => {
                const active = option.value === value
                return (
                    <Pressable
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        className={cn(
                            "rounded-2xl border px-3.5 py-3",
                            active
                                ? "border-brand-300/40 bg-brand-300/10"
                                : "border-border/50 bg-card/30",
                        )}
                        style={columns === 2 ? { width: "48.5%" } : undefined}
                    >
                        <View className="flex-row items-center gap-3">
                            <View
                                className={cn(
                                    "h-8 w-8 items-center justify-center rounded-xl",
                                    active ? "bg-brand-300/15" : "bg-white/[0.05]",
                                )}
                            >
                                <Ionicons
                                    name={option.icon}
                                    size={16}
                                    color={active ? "rgb(199,194,255)" : "rgba(255,255,255,0.55)"}
                                />
                            </View>
                            <View className="flex-1">
                                <Text
                                    className={cn(
                                        "text-sm font-medium",
                                        active ? "text-white" : "text-white/70",
                                    )}
                                >
                                    {option.label}
                                </Text>
                            </View>
                            {active && (
                                <Ionicons name="checkmark" size={14} color="rgb(199,194,255)" />
                            )}
                        </View>
                    </Pressable>
                )
            })}
        </View>
    )
}
