# @anticlock/react-native-clip-editor

An in-repo TurboModule (new architecture only) that runs the Reels editor's
heavy media work on the device. Nothing is sent to a server until the user
publishes.

| Capability | iOS (AVFoundation) | Android (Media3 Transformer) |
| --- | --- | --- |
| Video info (duration, upright size, audio) | `AVURLAsset` | `MediaMetadataRetriever` |
| Thumbnail strip across segments | `AVAssetImageGenerator` | `MediaMetadataRetriever` (scaled frames on API 27+) |
| Trim + concat recorded segments | `AVMutableComposition` | `EditedMediaItemSequence` + `ClippingConfiguration` |
| Music mix (start offset, loop, volume) | composition audio track + `AVMutableAudioMix` | looping audio sequence + `ChannelMixingAudioProcessor` |
| Original audio volume / mute | `AVMutableAudioMix` | `ChannelMixingAudioProcessor` / `setRemoveAudio` |
| Output | H.264/AAC MP4 at 30 fps, long side ≤ 1920 px, short side ≤ 1080 px, SDR BT.709 | H.264/AAC MP4 at 6 Mbps, same size limits, HDR tone-mapped to SDR |
| Cover frame | JPEG taken from the exported file | JPEG taken from the exported file |

## JS API

```ts
import {
  exportClip,
  generateThumbnails,
  getVideoInfo,
  cancelExport,
  isClipEditorAvailable,
} from "@anticlock/react-native-clip-editor";

const result = await exportClip(
  {
    sources: ["file:///…/take1.mp4", "file:///…/take2.mp4"],
    trimStartMs: 0,
    trimEndMs: 15000,
    music: { uri: "file:///…/track.m4a", startMs: 12000, volume: 0.8 },
    originalVolume: 0.5,
    coverAtMs: 1000,
  },
  (progress) => console.log(progress), // 0..1
);
// result: { uri, durationMs, width, height, byteSize, coverUri }
```

`trimStartMs` and `trimEndMs` apply to the timeline made by joining all the
sources in order. Music can be a local file, an `http(s)` URL (downloaded to
the cache first) or a bundled asset (resolve it with
`Image.resolveAssetSource`).

## Setup

The app's autolinking (`use_native_modules!` / RN Gradle plugin) picks the
module up from `apps/mobile/package.json` (`workspace:*`). After you add it or
change native code:

```sh
pnpm install
cd apps/mobile/ios && pod install    # then rebuild the iOS app
cd apps/mobile/android && ./gradlew assembleDebug
```

On Android, Media3 defaults to **1.8.0** so it matches `react-native-video`'s
`RNVideo_media3Version`. To change it, set `ext.media3Version` in
`android/build.gradle`, and keep both libraries on the same version.

## Fallback: ffmpeg (not used)

If a future editor feature needs filters that AVFoundation or Media3 can't
handle (complex overlays, speed ramps with pitch control and similar), the
documented fallback is an ffmpeg-kit build that you compile yourself. The
public `ffmpeg-kit-react-native` binaries were retired in 2025. An ffmpeg
build would add roughly 20–60 MB per ABI and bring GPL/LGPL licensing
decisions. That is why v1 doesn't use it.
