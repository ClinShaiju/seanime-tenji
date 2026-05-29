import * as React from "react"
import { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, StyleProp, View, ViewStyle } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

const ZOOM_THRESHOLD = 1.01
const ZOOM_TIMING_CONFIG = {
    duration: 180,
    easing: Easing.inOut(Easing.quad),
}

function clampZoomValue(value: number, min: number, max: number): number {
    "worklet"

    return Math.min(Math.max(value, min), max)
}

function getEffectiveAndroidTranslate(translate: number, focal: number, scale: number): number {
    "worklet"

    return translate + focal * (1 - scale)
}

type MangaReaderZoomSurfaceProps = {
    children: React.ReactNode
    instanceKey?: string
    disabled?: boolean
    onTap?: () => void
    onZoomChange?: (zoomed: boolean) => void
    maxScale?: number
    pinchEnabled?: boolean
    style?: StyleProp<ViewStyle>
    contentContainerStyle?: StyleProp<ViewStyle>
    onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
    removeClippedSubviews?: boolean
    scrollEventThrottle?: number
    tapViewportHeight?: number
    tapExclusionTop?: number
    tapExclusionBottom?: number
    scrollViewRef?: React.RefObject<ScrollView | null>
}

export function MangaReaderZoomSurface({
    children,
    instanceKey,
    disabled,
    onTap,
    onZoomChange,
    maxScale = 4,
    pinchEnabled = false,
    style,
    contentContainerStyle,
    onScroll,
    removeClippedSubviews = false,
    scrollEventThrottle = 16,
    tapViewportHeight = 0,
    tapExclusionTop = 0,
    tapExclusionBottom = 0,
    scrollViewRef,
}: MangaReaderZoomSurfaceProps) {
    const surfaceKey = instanceKey ?? "default"
    const isNativePinch = pinchEnabled && Platform.OS === "ios" && !disabled
    const isCustomPinch = pinchEnabled && Platform.OS !== "ios" && !disabled
    const hasScrollableContainer = Boolean(onScroll || scrollViewRef)
    const nativeScrollRef = React.useRef<ScrollView | null>(null)
    const zoomedRef = React.useRef(false)
    const [androidZoomed, setAndroidZoomed] = React.useState(false)

    const androidScale = useSharedValue(1)
    const androidInitialFocalX = useSharedValue(0)
    const androidInitialFocalY = useSharedValue(0)
    const androidSavedFocalX = useSharedValue(0)
    const androidSavedFocalY = useSharedValue(0)
    const androidFocalX = useSharedValue(0)
    const androidFocalY = useSharedValue(0)
    const androidSavedTranslateX = useSharedValue(0)
    const androidSavedTranslateY = useSharedValue(0)
    const androidTranslateX = useSharedValue(0)
    const androidTranslateY = useSharedValue(0)
    const androidSavedScale = useSharedValue(1)
    const androidContainerX = useSharedValue(0)
    const androidContainerY = useSharedValue(0)
    const androidContainerWidth = useSharedValue(0)
    const androidContainerHeight = useSharedValue(0)
    const androidScrollOffsetX = useSharedValue(0)
    const androidScrollOffsetY = useSharedValue(0)

    const setScrollViewNode = React.useCallback((node: ScrollView | null) => {
        nativeScrollRef.current = node

        if (scrollViewRef) {
            scrollViewRef.current = node
        }
    }, [scrollViewRef])

    const reportZoomChange = React.useCallback((zoomed: boolean) => {
        setAndroidZoomed(current => current === zoomed ? current : zoomed)

        if (zoomedRef.current === zoomed) return
        zoomedRef.current = zoomed
        onZoomChange?.(zoomed)
    }, [onZoomChange])

    const resetAndroidZoom = React.useCallback((animated: boolean = true) => {
        "worklet"

        if (animated) {
            androidScale.value = withTiming(1, ZOOM_TIMING_CONFIG)
            androidTranslateX.value = withTiming(0, ZOOM_TIMING_CONFIG)
            androidTranslateY.value = withTiming(0, ZOOM_TIMING_CONFIG)
            androidFocalX.value = withTiming(0, ZOOM_TIMING_CONFIG)
            androidFocalY.value = withTiming(0, ZOOM_TIMING_CONFIG)
        } else {
            androidScale.value = 1
            androidTranslateX.value = 0
            androidTranslateY.value = 0
            androidFocalX.value = 0
            androidFocalY.value = 0
        }

        androidSavedScale.value = 1
        androidSavedTranslateX.value = 0
        androidSavedTranslateY.value = 0
        androidSavedFocalX.value = 0
        androidSavedFocalY.value = 0
        androidInitialFocalX.value = 0
        androidInitialFocalY.value = 0

        runOnJS(reportZoomChange)(false)
    }, [
        androidFocalX,
        androidFocalY,
        androidInitialFocalX,
        androidInitialFocalY,
        androidSavedFocalX,
        androidSavedFocalY,
        androidSavedScale,
        androidSavedTranslateX,
        androidSavedTranslateY,
        androidScale,
        androidTranslateX,
        androidTranslateY,
        reportZoomChange,
    ])

    const clampAndroidZoomIntoView = React.useCallback((animated: boolean = true) => {
        "worklet"

        if (androidScale.value <= ZOOM_THRESHOLD
            || androidContainerWidth.value <= 0
            || androidContainerHeight.value <= 0) {
            resetAndroidZoom(animated)
            return
        }

        // clamp after each gesture
        const rightLimit = (androidContainerWidth.value * (androidScale.value - 1)) / 2
        const leftLimit = -rightLimit
        const bottomLimit = (androidContainerHeight.value * (androidScale.value - 1)) / 2
        const topLimit = -bottomLimit

        const totalTranslateX = getEffectiveAndroidTranslate(androidTranslateX.value, androidFocalX.value, androidScale.value)
        const totalTranslateY = getEffectiveAndroidTranslate(androidTranslateY.value, androidFocalY.value, androidScale.value)
        const nextTranslateX = clampZoomValue(totalTranslateX, leftLimit, rightLimit)
        const nextTranslateY = clampZoomValue(totalTranslateY, topLimit, bottomLimit)

        if (animated) {
            androidTranslateX.value = withTiming(nextTranslateX, ZOOM_TIMING_CONFIG)
            androidTranslateY.value = withTiming(nextTranslateY, ZOOM_TIMING_CONFIG)
            androidFocalX.value = withTiming(0, ZOOM_TIMING_CONFIG)
            androidFocalY.value = withTiming(0, ZOOM_TIMING_CONFIG)
        } else {
            androidTranslateX.value = nextTranslateX
            androidTranslateY.value = nextTranslateY
            androidFocalX.value = 0
            androidFocalY.value = 0
        }

        runOnJS(reportZoomChange)(true)
    }, [
        androidContainerHeight,
        androidContainerWidth,
        androidFocalX,
        androidFocalY,
        androidScale,
        androidTranslateX,
        androidTranslateY,
        reportZoomChange,
        resetAndroidZoom,
    ])

    const handleAndroidZoomLayout = React.useCallback((event: LayoutChangeEvent) => {
        const { x, y, width, height } = event.nativeEvent.layout
        androidContainerX.set(x)
        androidContainerY.set(y)
        androidContainerWidth.set(width)
        androidContainerHeight.set(height)
    }, [androidContainerHeight, androidContainerWidth, androidContainerX, androidContainerY])

    const handleAndroidScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        androidScrollOffsetX.set(event.nativeEvent.contentOffset.x)
        androidScrollOffsetY.set(event.nativeEvent.contentOffset.y)
        onScroll?.(event)
    }, [androidScrollOffsetX, androidScrollOffsetY, onScroll])

    const resetNativeZoomSurface = React.useCallback(() => {
        if (!isNativePinch) return

        const scrollNode = nativeScrollRef.current
        if (!scrollNode) return

        scrollNode.setNativeProps({ zoomScale: 1 })
        scrollNode.scrollTo({ x: 0, y: 0, animated: false })
    }, [isNativePinch])

    const handleNativeZoomScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const zoomScale = event.nativeEvent.zoomScale ?? 1
        reportZoomChange(zoomScale > 1.01)
        onScroll?.(event)
    }, [onScroll, reportZoomChange])

    const tapGesture = React.useMemo(() => Gesture.Tap()
        .enabled(!disabled)
        .numberOfTaps(1)
        .maxDuration(220)
        .maxDistance(24)
        .onEnd((event, success) => {
            const insideTopExclusion = tapExclusionTop > 0 && event.y <= tapExclusionTop
            const insideBottomExclusion = tapExclusionBottom > 0
                && tapViewportHeight > 0
                && event.y >= tapViewportHeight - tapExclusionBottom

            if (success && onTap) {
                if (insideTopExclusion || insideBottomExclusion) return
                runOnJS(onTap)()
            }
        }), [disabled, onTap, tapExclusionBottom, tapExclusionTop, tapViewportHeight])

    React.useEffect(() => {
        if (disabled) {
            reportZoomChange(false)
        }
    }, [disabled, reportZoomChange])

    React.useEffect(() => {
        reportZoomChange(false)
    }, [instanceKey, reportZoomChange])

    React.useEffect(() => {
        if (!isCustomPinch) return

        androidScale.set(1)
        androidTranslateX.set(0)
        androidTranslateY.set(0)
        androidFocalX.set(0)
        androidFocalY.set(0)
        androidSavedScale.set(1)
        androidSavedTranslateX.set(0)
        androidSavedTranslateY.set(0)
        androidSavedFocalX.set(0)
        androidSavedFocalY.set(0)
        androidInitialFocalX.set(0)
        androidInitialFocalY.set(0)
        reportZoomChange(false)
    }, [
        androidFocalX,
        androidFocalY,
        androidInitialFocalX,
        androidInitialFocalY,
        androidSavedFocalX,
        androidSavedFocalY,
        androidSavedScale,
        androidSavedTranslateX,
        androidSavedTranslateY,
        androidScale,
        androidTranslateX,
        androidTranslateY,
        isCustomPinch,
        instanceKey,
        reportZoomChange,
    ])

    React.useEffect(() => {
        if (!isNativePinch) return

        const frame = requestAnimationFrame(() => {
            resetNativeZoomSurface()
        })

        return () => cancelAnimationFrame(frame)
    }, [isNativePinch, instanceKey, resetNativeZoomSurface])

    React.useEffect(() => () => {
        reportZoomChange(false)
    }, [reportZoomChange])

    const androidTapGesture = React.useMemo(() => Gesture.Tap()
        .enabled(Boolean(onTap) && !disabled)
        .numberOfTaps(1)
        .maxDuration(220)
        .maxDistance(24)
        .onEnd((event, success) => {
            const insideTopExclusion = tapExclusionTop > 0 && event.y <= tapExclusionTop
            const insideBottomExclusion = tapExclusionBottom > 0
                && tapViewportHeight > 0
                && event.y >= tapViewportHeight - tapExclusionBottom

            if (success && onTap) {
                if (insideTopExclusion || insideBottomExclusion) return
                runOnJS(onTap)()
            }
        }), [disabled, onTap, tapExclusionBottom, tapExclusionTop, tapViewportHeight])

    const androidPanOnlyGesture = React.useMemo(() => Gesture.Pan()
        .enabled(isCustomPinch)
        .averageTouches(true)
        .enableTrackpadTwoFingerGesture(true)
        .minPointers(1)
        .maxPointers(1)
        .onTouchesDown((_, manager) => {
            if (androidScale.value <= ZOOM_THRESHOLD) {
                manager.fail()
            }
        })
        .onStart(() => {
            androidSavedTranslateX.value = androidTranslateX.value
            androidSavedTranslateY.value = androidTranslateY.value
            runOnJS(reportZoomChange)(true)
        })
        .onUpdate((event) => {
            androidTranslateX.value = androidSavedTranslateX.value + event.translationX
            androidTranslateY.value = androidSavedTranslateY.value + event.translationY
        })
        .onEnd(() => {
            clampAndroidZoomIntoView()
        }), [
        androidSavedTranslateX,
        androidSavedTranslateY,
        androidScale,
        androidTranslateX,
        androidTranslateY,
        isCustomPinch,
        clampAndroidZoomIntoView,
        reportZoomChange,
    ])

    const androidPinchGesture = React.useMemo(() => Gesture.Pinch()
        .enabled(isCustomPinch)
        .onStart((event) => {
            const effectiveTranslateX = getEffectiveAndroidTranslate(androidTranslateX.value, androidFocalX.value, androidScale.value)
            const effectiveTranslateY = getEffectiveAndroidTranslate(androidTranslateY.value, androidFocalY.value, androidScale.value)

            const nextFocalX = androidScrollOffsetX.value + event.focalX - androidContainerX.value - androidContainerWidth.value / 2
            const nextFocalY = androidScrollOffsetY.value + event.focalY - androidContainerY.value - androidContainerHeight.value / 2

            androidSavedScale.value = androidScale.value
            androidSavedFocalX.value = nextFocalX
            androidSavedFocalY.value = nextFocalY
            androidSavedTranslateX.value = effectiveTranslateX - nextFocalX * (1 - androidSavedScale.value)
            androidSavedTranslateY.value = effectiveTranslateY - nextFocalY * (1 - androidSavedScale.value)
            androidInitialFocalX.value = event.focalX
            androidInitialFocalY.value = event.focalY
            androidTranslateX.value = androidSavedTranslateX.value
            androidTranslateY.value = androidSavedTranslateY.value
            androidFocalX.value = androidSavedFocalX.value
            androidFocalY.value = androidSavedFocalY.value
            runOnJS(reportZoomChange)(true)
        })
        .onUpdate((event) => {
            const nextScale = clampZoomValue(androidSavedScale.value * event.scale, 1, maxScale)

            if (androidSavedScale.value > ZOOM_THRESHOLD && event.scale < 1) {
                const remainingZoom = androidSavedScale.value - 1
                const progress = remainingZoom > 0
                    ? clampZoomValue((nextScale - 1) / remainingZoom, 0, 1)
                    : 0
                const savedEffectiveTranslateX = getEffectiveAndroidTranslate(androidSavedTranslateX.value,
                    androidSavedFocalX.value,
                    androidSavedScale.value)
                const savedEffectiveTranslateY = getEffectiveAndroidTranslate(androidSavedTranslateY.value,
                    androidSavedFocalY.value,
                    androidSavedScale.value)

                androidScale.value = nextScale
                androidTranslateX.value = savedEffectiveTranslateX * progress
                androidTranslateY.value = savedEffectiveTranslateY * progress
                androidFocalX.value = 0
                androidFocalY.value = 0
                return
            }

            androidScale.value = nextScale
            androidTranslateX.value = androidSavedTranslateX.value + (event.focalX - androidInitialFocalX.value)
            androidTranslateY.value = androidSavedTranslateY.value + (event.focalY - androidInitialFocalY.value)
            androidFocalX.value = androidSavedFocalX.value
            androidFocalY.value = androidSavedFocalY.value
        })
        .onEnd(() => {
            androidTranslateX.value += androidFocalX.value * (1 - androidScale.value)
            androidTranslateY.value += androidFocalY.value * (1 - androidScale.value)
            androidFocalX.value = 0
            androidFocalY.value = 0
            clampAndroidZoomIntoView()
        }), [
        androidFocalX,
        androidFocalY,
        androidInitialFocalX,
        androidInitialFocalY,
        androidSavedFocalX,
        androidSavedFocalY,
        androidSavedScale,
        androidSavedTranslateX,
        androidSavedTranslateY,
        androidScrollOffsetX,
        androidScrollOffsetY,
        androidScale,
        androidTranslateX,
        androidTranslateY,
        isCustomPinch,
        clampAndroidZoomIntoView,
        maxScale,
        reportZoomChange,
    ])

    const androidAnimatedStyle = useAnimatedStyle(() => ({
        // translate to the pinch focus then scale then translate back
        transform: [
            { translateX: androidTranslateX.value },
            { translateY: androidTranslateY.value },
            { translateX: androidFocalX.value },
            { translateY: androidFocalY.value },
            { scale: androidScale.value },
            { translateX: -androidFocalX.value },
            { translateY: -androidFocalY.value },
        ],
    }), [androidFocalX, androidFocalY, androidScale, androidTranslateX, androidTranslateY])

    if (isCustomPinch) {
        const androidGesture = Gesture.Race(
            androidPinchGesture,
            androidPanOnlyGesture,
            androidTapGesture,
        )

        if (hasScrollableContainer) {
            return (
                <GestureDetector key={surfaceKey} gesture={androidGesture}>
                    <ScrollView
                        alwaysBounceHorizontal={false}
                        alwaysBounceVertical={false}
                        bounces={false}
                        className="overflow-hidden"
                        contentInsetAdjustmentBehavior="never"
                        contentContainerStyle={contentContainerStyle}
                        onScroll={handleAndroidScroll}
                        ref={setScrollViewNode}
                        removeClippedSubviews={removeClippedSubviews && !androidZoomed}
                        scrollEnabled={!androidZoomed}
                        scrollEventThrottle={scrollEventThrottle}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        style={style}
                    >
                        <Animated.View
                            collapsable={false}
                            onLayout={handleAndroidZoomLayout}
                            style={[{ width: "100%" }, androidAnimatedStyle]}
                        >
                            {children}
                        </Animated.View>
                    </ScrollView>
                </GestureDetector>
            )
        }

        return (
            <GestureDetector key={surfaceKey} gesture={androidGesture}>
                <View className="overflow-hidden" style={style}>
                    <Animated.View
                        collapsable={false}
                        onLayout={handleAndroidZoomLayout}
                        style={[contentContainerStyle, androidAnimatedStyle]}
                    >
                        {children}
                    </Animated.View>
                </View>
            </GestureDetector>
        )
    }

    if (!isNativePinch) {
        return (
            <GestureDetector key={surfaceKey} gesture={tapGesture}>
                <View className="overflow-hidden" style={style}>
                    {children}
                </View>
            </GestureDetector>
        )
    }

    return (
        <GestureDetector key={surfaceKey} gesture={tapGesture}>
            <ScrollView
                alwaysBounceHorizontal={false}
                alwaysBounceVertical={false}
                bounces={false}
                bouncesZoom={false}
                className="overflow-hidden"
                contentInsetAdjustmentBehavior="never"
                contentContainerStyle={contentContainerStyle}
                directionalLockEnabled
                maximumZoomScale={maxScale}
                minimumZoomScale={1}
                onMomentumScrollEnd={handleNativeZoomScroll}
                onScroll={handleNativeZoomScroll}
                onScrollEndDrag={handleNativeZoomScroll}
                pinchGestureEnabled
                ref={setScrollViewNode}
                scrollEventThrottle={scrollEventThrottle}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                style={style}
            >
                <View collapsable={false}>
                    {children}
                </View>
            </ScrollView>
        </GestureDetector>
    )
}
