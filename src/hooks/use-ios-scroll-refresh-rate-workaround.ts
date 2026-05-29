export function useIOSScrollRefreshRateWorkaround(enabled = false) {
    // devnote: disable for now, causes battery drain
    // useFrameCallback(() => {
    //     "worklet"
    // }, Platform.OS === "ios" && enabled)
}
