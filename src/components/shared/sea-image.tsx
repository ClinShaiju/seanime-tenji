import { Image as ExpoImage } from "expo-image"
import * as React from "react"
import { Image as RNImage, ImageResizeMode } from "react-native"

type SeaImageProps = React.ComponentProps<typeof ExpoImage>

function getRemoteUri(source: SeaImageProps["source"]): string {
    if (!source || Array.isArray(source) || typeof source === "number") {
        return ""
    }

    if (typeof source === "string") {
        return source.trim()
    }

    if ("uri" in source && typeof source.uri === "string") {
        return source.uri.trim()
    }

    return ""
}

function toResizeMode(contentFit: SeaImageProps["contentFit"]): ImageResizeMode {
    switch (contentFit) {
        case "contain":
            return "contain"
        case "fill":
            return "stretch"
        case "none":
            return "center"
        case "scale-down":
            return "contain"
        case "cover":
        default:
            return "cover"
    }
}

export function SeaImage({ source, style, contentFit, onError, ...expoProps }: SeaImageProps) {
    const uri = getRemoteUri(source)
    const [shouldFallback, setShouldFallback] = React.useState(false)

    React.useEffect(() => {
        setShouldFallback(false)
    }, [uri])

    const handleError = React.useCallback((event: Parameters<NonNullable<SeaImageProps["onError"]>>[0]) => {
        if (uri) {
            setShouldFallback(true)
        }

        onError?.(event)
    }, [onError, uri])

    if (!shouldFallback || !uri) {
        return (
            <ExpoImage
                {...expoProps}
                source={source}
                style={style}
                contentFit={contentFit}
                onError={handleError}
            />
        )
    }

    return (
        <RNImage
            source={{ uri }}
            style={style}
            resizeMode={toResizeMode(contentFit)}
        />
    )
}
