import { requireNativeViewManager } from "expo-modules-core"
import React from "react"
import type { MpvPlayerViewProps, MpvPlayerViewRef } from "./MpvPlayer.types"

const NativeView: React.ComponentType<MpvPlayerViewProps & { ref?: React.Ref<any> }> =
    requireNativeViewManager<MpvPlayerViewProps>("ExpoMpvPlayer")

export const MpvPlayerView = React.forwardRef<MpvPlayerViewRef, MpvPlayerViewProps>(
    function MpvPlayerView(props, ref) {
        const nativeRef = React.useRef<any>(null)

        React.useImperativeHandle(ref, () => ({
            // playback
            play: () => nativeRef.current?.play() ?? Promise.resolve(),
            pause: () => nativeRef.current?.pause() ?? Promise.resolve(),
            seekTo: (position: number) => nativeRef.current?.seekTo(position) ?? Promise.resolve(),
            seekBy: (offset: number) => nativeRef.current?.seekBy(offset) ?? Promise.resolve(),
            setSpeed: (speed: number) => nativeRef.current?.setSpeed(speed) ?? Promise.resolve(),
            getSpeed: () => nativeRef.current?.getSpeed() ?? Promise.resolve(1),
            isPaused: () => nativeRef.current?.isPaused() ?? Promise.resolve(true),
            getCurrentPosition: () => nativeRef.current?.getCurrentPosition() ?? Promise.resolve(0),
            getDuration: () => nativeRef.current?.getDuration() ?? Promise.resolve(0),

            // PiP
            startPictureInPicture: () => nativeRef.current?.startPictureInPicture() ?? Promise.resolve(),
            stopPictureInPicture: () => nativeRef.current?.stopPictureInPicture() ?? Promise.resolve(),
            isPictureInPictureSupported: () => nativeRef.current?.isPictureInPictureSupported() ?? Promise.resolve(false),
            isPictureInPictureActive: () => nativeRef.current?.isPictureInPictureActive() ?? Promise.resolve(false),

            // subtitle controls
            getSubtitleTracks: () => nativeRef.current?.getSubtitleTracks() ?? Promise.resolve([]),
            setSubtitleTrack: (trackId: number) => nativeRef.current?.setSubtitleTrack(trackId) ?? Promise.resolve(),
            disableSubtitles: () => nativeRef.current?.disableSubtitles() ?? Promise.resolve(),
            getCurrentSubtitleTrack: () => nativeRef.current?.getCurrentSubtitleTrack() ?? Promise.resolve(0),
            addSubtitleFile: (url: string, select: boolean) =>
                nativeRef.current?.addSubtitleFile(url, select) ?? Promise.resolve(),
            setSubtitleDelay: (delay: number) => nativeRef.current?.setSubtitleDelay(delay) ?? Promise.resolve(),
            setSubtitleFontSize: (size: number) => nativeRef.current?.setSubtitleFontSize(size) ?? Promise.resolve(),
            setSubtitleVisibility: (visible: boolean) =>
                nativeRef.current?.setSubtitleVisibility(visible) ?? Promise.resolve(),
            setSubtitlePosition: (position: number) =>
                nativeRef.current?.setSubtitlePosition(position) ?? Promise.resolve(),
            setSubtitleScale: (scale: number) => nativeRef.current?.setSubtitleScale(scale) ?? Promise.resolve(),
            setSubtitleMarginY: (margin: number) => nativeRef.current?.setSubtitleMarginY(margin) ?? Promise.resolve(),
            setSubtitleAlignX: (alignment: "left" | "center" | "right") =>
                nativeRef.current?.setSubtitleAlignX(alignment) ?? Promise.resolve(),
            setSubtitleAlignY: (alignment: "top" | "center" | "bottom") =>
                nativeRef.current?.setSubtitleAlignY(alignment) ?? Promise.resolve(),

            // audio controls
            getAudioTracks: () => nativeRef.current?.getAudioTracks() ?? Promise.resolve([]),
            setAudioTrack: (trackId: number) => nativeRef.current?.setAudioTrack(trackId) ?? Promise.resolve(),
            getCurrentAudioTrack: () => nativeRef.current?.getCurrentAudioTrack() ?? Promise.resolve(0),
            setAudioDelay: (delay: number) => nativeRef.current?.setAudioDelay(delay) ?? Promise.resolve(),

            // zoom
            setVideoZoom: (scale: number) => nativeRef.current?.setVideoZoom(scale) ?? Promise.resolve(),
            setZoomedToFill: (zoomed: boolean) => nativeRef.current?.setZoomedToFill(zoomed) ?? Promise.resolve(),
            isZoomedToFill: () => nativeRef.current?.isZoomedToFill() ?? Promise.resolve(false),

            // technical info
            getTechnicalInfo: () => nativeRef.current?.getTechnicalInfo() ?? Promise.resolve({}),
        }))

        return <NativeView ref={nativeRef} {...props} />
    },
)
