import { cn } from "@/lib/utils"
import { Ionicons } from "@expo/vector-icons"
import * as React from "react"
import { Text, TouchableOpacity, View } from "react-native"

type OptionRowProps = {
    label: string
    detail?: string
    active: boolean
    onPress: () => void
    className?: string
    monoDetail?: boolean
}

const BRAND_ACCENT = "rgb(97 82 223)"

/**
 * A single-select row for use inside a grouped Surface container.
 *
 * Shows a filled brand checkmark when active, an empty circle outline
 * when inactive. Pair with `RowDivider` between rows.
 *
 * @example
 * <Surface variant="muted" className="overflow-hidden">
 *   {options.map((opt, i) => (
 *     <React.Fragment key={opt.id}>
 *       {i > 0 && <RowDivider />}
 *       <OptionRow
 *         label={opt.label}
 *         detail={opt.sublabel}
 *         active={selected === opt.id}
 *         onPress={() => setSelected(opt.id)}
 *       />
 *     </React.Fragment>
 *   ))}
 * </Surface>
 */
export function OptionRow({
    label,
    detail,
    active,
    onPress,
    className,
    monoDetail = true,
}: OptionRowProps) {
    return (
        <TouchableOpacity
            className={cn("flex-row items-center px-4 py-3.5", className)}
            activeOpacity={0.7}
            onPress={onPress}
        >
            <View className="flex-1 mr-3">
                <Text className="text-foreground text-sm font-medium">{label}</Text>
                {/* {detail ? (
                 <Text
                 className={cn(
                 "text-white/35 text-xs mt-0.5",
                 monoDetail && "font-mono",
                 )}
                 numberOfLines={1}
                 >
                 {detail}
                 </Text>
                 ) : null} */}
            </View>
            {active ? (
                <Ionicons name="checkmark-circle" size={20} color={BRAND_ACCENT} />
            ) : (
                <View className="w-5 h-5 rounded-full border border-white/20" />
            )}
        </TouchableOpacity>
    )
}
