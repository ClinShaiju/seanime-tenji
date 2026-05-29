import type { AL_BaseAnime, Anime_EntryListData, Anime_Episode, Onlinestream_VideoSource } from "@/api/generated/types"
import type { MobilePlaybackSource, MobileStreamKind } from "./types"

export function toSourceFromOnlineStream(params: {
    videoSource: Onlinestream_VideoSource
    mediaId: number
    episodeNumber: number
    media?: AL_BaseAnime
    episode?: Anime_Episode
    entryListData?: Anime_EntryListData
    episodes?: Anime_Episode[]
}): MobilePlaybackSource {
    const { videoSource, mediaId, episodeNumber, media, episode, entryListData } = params

    const isHls = videoSource.type === "m3u8" || videoSource.url.endsWith(".m3u8")
    const streamKind: MobileStreamKind = isHls ? "hls" : "http"

    return {
        id: `onlinestream-${mediaId}-${episodeNumber}-${videoSource.server}`,
        streamKind,
        url: videoSource.url,
        mimeType: isHls ? "application/x-mpegURL" : "video/mp4",
        headers: videoSource.headers,

        mediaId,
        episodeNumber,
        media,
        episode,
        entryListData,
        entryView: "onlinestream",
        nextEpisodeAction: "onlinestream-play",

        continuityKind: "onlinestream",

        externalSubtitles: videoSource.subtitles ?? undefined,
        episodes: params.episodes,
    }
}
