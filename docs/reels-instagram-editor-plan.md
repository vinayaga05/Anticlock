# Reels / Clips — Instagram-style camera + editor: analysis & plan (Phase 1)

_Branch: `cursor/reels-instagram-editor` (from `origin/main` @ `6dbc575`). Analysis only, no code changes yet.
PR #21 (`cursor/fix-ci-contracts-build`, CI fix) is still open. This plan does not depend on it, but CI on phase-2 PRs will be red until it merges._

---

## 1. Current state

### 1.1 Mobile flow (apps/mobile)
| Step | File | What it does today |
|---|---|---|
| Entry | `src/shared/navigation/TabSwipeNavigator.tsx:45` → `navigate('ClipComposer')`; deep link `reel/create` (`linking.ts:119`); root stack `RootNavigator.tsx:373` | Opens `ClipComposerScreen`. (`features/create/screens/CreateScreen.tsx` "Create Reel" only goes to the `PlayFeed` tab.) |
| Screen | `src/features/reels/screens/ClipComposerScreen.tsx` (941 lines) | 3-stage state machine `capture → editor → publish`, with a local draft in MMKV (`STORAGE_KEYS.CLIP_COMPOSER_DRAFT`, v1). |
| Capture | `src/features/reels/components/CreationCameraShell.tsx` | **Mock-up only.** It shows no live camera preview. The flash, flip, filters, settings and tool-rail buttons are no-ops. Pressing the shutter calls `captureClipVideo()`, which opens the **system camera** (`react-native-image-picker.launchCamera`, `durationLimit: 90`). The POST/REEL/STORY/INSTANTS mode picker is cosmetic. |
| Gallery | `src/features/reels/media/clipMediaPicker.ts` | `launchImageLibrary` returns one video, **MP4 only**, and the picker **rejects anything over 90 s** (no trim option). It reads `duration`/`width`/`height`/`fileSize` from the picker. There is an adapter hook (`setClipMediaPickerAdapter`) we can reuse. |
| Editor | `src/features/reels/components/ReelEditor.tsx` | **Static UI.** It plays the video. The "Drag handles to trim" bar is a plain view. Text, Effects, Music, Voiceover, Speed and Cover are inert buttons. The clips row shows numbers only (no thumbnails), and `onMove` is a no-op. |
| Publish | `ClipComposerScreen` publish stage | Sets caption, hashtags, tagged user IDs (raw UUIDs), location, visibility, identity (personal or provider) and cover (custom image or "use video frame"). |
| Upload | `src/shared/api/publishingHooks.ts` `uploadContentMedia()` | `POST /v1/content/uploads` → raw PUT to a presigned **R2** URL (native `{uri}` XHR body, no JS copy) → `POST /uploads/:id/complete`. Then `POST /v1/content/containers` + `/containers/:id/publish`. |
| Feed | `src/shared/api/hooks.ts:400` (`/v1/content/feeds/clip` + `/v1/reels`), `features/reels/screens/ReelFeedScreen.tsx` | Plays `playbackUrl` (an R2 MP4) with `react-native-video`. The music label is `item.title ? '♪ title' : '♪ Original audio'` (`ReelFeedScreen.tsx:629`), which reuses the title field and has no real music data. |

### 1.2 API (apps/api)
- **User clips do not go through Cloudflare Stream.** `routes/content.ts` (`contentMobileRoutes`) calls `media/MediaService.ts`. `createMobileContentUploadSession` writes a `media_assets` row and returns a presigned R2 PUT (or a local `/v1/content/uploads/:id/content` in dev).
- `completeUpload` (`MediaService.ts:290`) checks the MP4 magic bytes and validates size and duration. It then **reads the whole object into memory for a sha256** (up to 250 MB), moves it to its final key, and sets `processingStatus=ready`, `moderationStatus=approved` right away. There is **no transcode, no poster generation and no webhook** for user clips. `posterUrl` is null unless the user picked a custom cover, so the composer's "Use video frame" promise is not met.
- Clip rules: one video, `mediaType: 'video'` (`routes/content.ts:412,500`). `duplicateClusterId` = the source sha256.
- **Cloudflare Stream is used only for admin/CMS reels.** These use `reels` table + `reels/ReelService.ts` + `media/CloudflareStreamVideoProvider.ts` (direct creator upload, status, playback), with a webhook in `reels/streamWebhook.ts` mounted from `routes/reels.ts:347`. `routes/media.ts` is the admin Media Library.
- Limits: `MAX_REEL_VIDEO_DURATION_MS = 3 min` (`packages/contracts/src/media.ts:61`), enforced in `media/validateUpload.ts`. `MEDIA_UPLOAD_MAX_VIDEO_BYTES` defaults to 250 MB. `STREAM_MAX_DURATION_SECONDS=180`. Only `video/mp4` is accepted. The mobile app limits clips to **90 s**.
- Container: `node:22-alpine` (`apps/api/Dockerfile`), with no ffmpeg. Production uses `MEDIA_STORAGE=r2`.

### 1.3 Contracts / DB
- `packages/contracts/src/publishing.ts`: `CreateContentContainerRequestSchema` (format, mediaType, caption, mediaIds, thumbnailMediaId, hashtags, taggedUserIds, location, visibility) and `CreateContentUploadRequestSchema` (kind `video|image`, durationMs, width, height).
- `apps/api/src/db/schema.ts`: `media_assets` (has `durationMs`, `externalId` for the Stream UID, `thumbnailUrl`), `content_containers`, `content_posts`, `reels` (admin). Migrations are hand-written idempotent SQL in `src/db/migrate.ts` (88 CREATE/ALTER). There is no drizzle `out/` folder in use.
- **No music, audio, trim or edit fields exist anywhere**, in the schema, the contracts or the feed response.

### 1.4 Mobile stack inventory
| Item | Value |
|---|---|
| React Native | **0.86.0**, React 19.2.3, Hermes, **New Architecture ON** (`newArchEnabled=true`, `RCTNewArchEnabled`) |
| Already installed | `react-native-video` 6.19.2 (Fabric), `react-native-image-picker` 8.2.1, `react-native-reanimated` 4.6.0 + `react-native-worklets` 0.12.1 (pinned via pnpm override), `react-native-gesture-handler` 3.2.1, `react-native-svg` 15, **`react-native-nitro-modules` 0.37** (via mmkv 4), `react-native-mmkv` 4.3 |
| Not installed | vision-camera, skia, ffmpeg, any trim or thumbnail lib |
| iOS | deployment target **15.1** (`min_ios_version_supported`), `use_frameworks!` linkage from env, Xcode 26.6, CocoaPods 1.16.2, Pods present |
| Android | minSdk **24**, compile/target **36**, NDK 27.1, Kotlin 2.1.20, JDK 17 |
| Permissions | iOS: `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription` are present. Android: `CAMERA` and `RECORD_AUDIO` are present. |
| Toolchain on this Mac | Node 26.7 (engines `>=22.11`), Android SDK and NDK 27.1 installed |

---

## 2. Recommendation (summary)

1. **Camera: `react-native-vision-camera` v5** (Nitro rewrite, released Apr 2026, 5.2.x). It is built against RN 0.85 and Nitro 0.37, which we already ship, and needs iOS ≥ 15.1, which we meet. It also needs `react-native-nitro-image`. It records MP4 on Android and MP4 on iOS via `fileType: 'mp4'`. A new `Recorder` per take gives us **segments** for free.
2. **Processing: on-device, using a small in-repo native module `ClipEditor`**: AVFoundation on iOS (`AVMutableComposition` + `AVMutableAudioMix` + `AVAssetExportSession`/`AVAssetWriter`) and **Media3 Transformer** on Android (`Composition` with the video sequence plus a background-audio sequence, `ClippingConfiguration`, and `ChannelMixingAudioProcessor` for volume). It exports one final H.264/AAC MP4 (≤ 90 s, 1080×1920 max) plus thumbnails and a cover frame.
   - **Why not ffmpeg-kit:** the original is retired. The official `ffmpeg-kit-next` is **source-only** (you build the binaries yourself with Nix). The community prebuilt `@mtd1410/react-native-ffmpegkit` is single-maintainer. Either one adds roughly 15–40 MB per ABI, carries LGPL obligations and software-encoder CPU cost, and brings 16 KB page-size risk on targetSdk 36. Hardware encoders through the OS frameworks are smaller, faster, and maintained by Apple and Google.
   - **Why not server-side ffmpeg:** the API is a single alpine Node container on a VPS. It already buffers whole uploads in RAM. Server-side processing would need ffmpeg in the image, a job queue, a new `processing` post state and polling or webhooks. It would also upload the untrimmed source (more bytes, longer than 90 s) and cost VPS CPU per clip.
   - **Why not Cloudflare Stream:** user clips are R2 MP4s, not Stream. Stream *can* clip (`POST /stream/clip`), but its "audio tracks" are **alternate** tracks (language/commentary). It cannot **mix** music under the original audio at a chosen volume. It would also add per-minute Stream cost and a webhook state machine.
   - Result: the **upload and publish pipeline stays unchanged** (the server still receives one validated MP4). We only add edit and music **metadata** for attribution and the feed label.
3. **Music source: there is no fake licensed catalogue.** v1 is a `MusicCatalog` provider interface with two sources:
   - (a) `bundled`: a small set of tracks the team owns or that are CC0, under `apps/mobile/src/shared/assets/music/` plus a `tracks.json` (title, artist, license, durationMs). This ships empty or with whatever files the owner provides.
   - (b) `remote`: `GET /v1/content/music-tracks`, backed by a `music_tracks` table and audio files in R2, managed in admin later.
   - The picker shows "No tracks available yet" when both are empty. Picking a local audio file from the device is an optional later step, gated on licensing.

---

## 3. Implementation plan

### 3.1 Custom camera (`features/reels/camera/`)
- `ClipCameraScreen` replaces the system camera inside `CreationCameraShell`. It keeps the existing shell visuals and wires up the controls:
  - Live `<Camera>` preview with `useVideoOutput({ enableAudio: true, fileType: 'mp4', targetResolution: FHD 9:16 })`.
  - **Tap to start/stop, hold to record** (Gesture.LongPress plus Tap on the shutter). Release stops the segment.
  - **Flip** front/back (between segments; `enablePersistentRecorder` lets you flip mid-take, at some cost). **Flash/torch** toggle. Pinch zoom later.
  - **Duration selector 15 / 30 / 60 / 90 s** (default 30). Recording auto-stops at the cap.
  - **Progress ring** around the shutter (reanimated + svg `Circle` strokeDashoffset) showing segment ticks.
  - **Segments**: each take creates a new Recorder and is pushed to `segments[]`. "Undo last segment" deletes the file. "Done" goes to the editor. Segments are concatenated by `ClipEditor.export` (one composition).
  - **Gallery** button (bottom-left) calls `pickClipVideo()`. Changes: accept MP4/MOV/HEVC (export re-encodes) and **allow videos longer than 90 s**, which then go to the editor with the trim preset to the first 90 s instead of being rejected.
  - Permissions: `useCameraPermission` / `useMicrophonePermission`, with a denied state that has an "Open Settings" CTA (`Linking.openSettings()`). If the mic is denied, record silently with a banner.
- The mode picker keeps REEL active. The STORY and POST tabs stay as they are (out of scope).

### 3.2 Editor (`features/reels/editor/`)
- Edit state, kept in a small zustand store and persisted in the draft (v2):
  ```ts
  type ClipEdit = {
    sources: { uri: string; durationMs: number }[];   // segments or a gallery file
    trim: { startMs: number; endMs: number };          // on the concatenated timeline
    music: null | { trackId: string; source: 'bundled'|'remote'; uri: string;
                    title: string; artist: string; startMs: number }; // offset into the track
    originalVolume: number; // 0..1 (default 1, or 0.3 when music is added)
    musicVolume: number;    // 0..1 (default 0.8)
    coverAtMs: number | null;
  };
  // final duration = trim.endMs - trim.startMs (≤ 90_000, ≥ 1_000)
  ```
- **Video trim UI**: a thumbnail strip (about 10–12 frames from `ClipEditor.thumbnails`) with left and right handles (Gesture Pan + reanimated shared values). Dimmed areas sit outside the selection, a playhead follows playback, and a min of 1 s and max of 90 s are enforced. A duration label shows `0:12.4`. The preview is `react-native-video` (`ref.seek`, looping between start and end using `onProgress`).
- **Music picker sheet**: lists tracks from `MusicCatalog`, with tap to preview. Once a track is selected, a **music segment trimmer** appears: a waveform-like bar (static bars, or real peaks from the native module later) with a window equal to the final video duration that you drag to choose `music.startMs`.
- **Volume mix**: two sliders, "Original" and "Music". The preview uses a second audio-only `react-native-video` instance seeked to `music.startMs + (pos - trim.startMs)`, with `volume` props on both players. Sync is checked on `onProgress` and re-seeked if drift exceeds 150 ms.
- **Cover**: pick a frame from the strip (`coverAtMs`). Export writes a JPEG, which is uploaded as `thumbnailMediaId` and fixes the missing poster.
- **Next** runs `ClipEditor.export()` with a progress modal and cancel. The output file feeds the existing `createVideoUploadFile` → `uploadContentMedia` path unchanged.
- Remove or hide the inert tools (Text, Effects, Voiceover, Speed) or mark them "Soon", so the editor has no dead buttons.

### 3.3 Native module `ClipEditor` (in-app TurboModule, codegen spec at `apps/mobile/specs/NativeClipEditor.ts`)
```ts
getInfo(uri): Promise<{ durationMs; width; height; rotation; hasAudio }>
thumbnails(uri | uris[], { count, widthPx }): Promise<string[]>   // file:// JPEGs
export(opts: { sources: string[]; trimStartMs; trimEndMs;
               music?: { uri; startMs; volume }; originalVolume;
               maxHeight: 1920; videoBitrate: ~6_000_000; outPath?;
               coverAtMs? }): Promise<{ uri; durationMs; width; height; byteSize; coverUri? }>
cancelExport(): void;  // progress via an event emitter: onExportProgress(0..1)
```
- iOS (Swift): build an `AVMutableComposition` with the segments inserted sequentially and trimmed by `timeRange`. Insert the music track at `startMs` for the final duration. Volumes go through `AVMutableAudioMixInputParameters.setVolume`. Rotation and portrait are handled with `preferredTransform` / `AVMutableVideoComposition`. Export with `AVAssetExportSession` (`AVAssetExportPreset1920x1080`, `.mp4`, `shouldOptimizeForNetworkUse`). Thumbnails come from `AVAssetImageGenerator`.
- Android (Kotlin): `androidx.media3:media3-transformer` + `media3-effect` + `media3-common`. The video `EditedMediaItemSequence` holds the segments with `ClippingConfiguration`, and a second sequence holds the music item clipped `[startMs, startMs+dur]`. `ChannelMixingAudioProcessor` scales each sequence. Output is H.264/AAC MP4. Thumbnails come from `MediaMetadataRetriever.getScaledFrameAtTime`. Media3 needs minSdk 21, so 24 is fine.
- Alternative if writing native code is not wanted: the `@mtd1410/react-native-ffmpegkit` LGPL "min" variant behind the same JS interface. It is a drop-in fallback, but not the default.

### 3.4 API / contracts / DB
- **contracts (`publishing.ts`)**: optional `edit` on `CreateContentContainerRequestSchema` (valid only for `format: 'clip'`):
  ```ts
  edit: z.object({
    music: z.object({ trackId: z.string().max(128), source: z.enum(['bundled','remote']),
                      title: z.string().max(160), artist: z.string().max(160).nullable(),
                      startMs: z.number().int().min(0), volume: z.number().min(0).max(1) }).nullable(),
    originalVolume: z.number().min(0).max(1),
    sourceTrimStartMs: z.number().int().min(0), sourceTrimEndMs: z.number().int().positive(),
    segmentCount: z.number().int().min(1).max(20),
  }).strict().optional()
  ```
  Also add a shared `MAX_CLIP_DURATION_MS = 90_000` (mobile clips) next to the 3-min reel limit. Add `MusicTrackSchema` and `ListMusicTracksResponseSchema`.
- **DB (`migrate.ts` + `schema.ts`)**: `ALTER TABLE content_containers ADD COLUMN IF NOT EXISTS edit jsonb`. Do the same on `content_posts`. Add `ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS music_track_id text` (indexed, for an "uses this audio" page later). New table `music_tracks (id uuid pk, title, artist, duration_ms, media_id → media_assets, license text not null, source_url, is_active bool, sort_order, created_at)`.
- **Routes**: `POST /containers` validates and stores `edit`. `publish` copies it to the post. The clip feed item gains `music: { title, artist } | null` and `durationMs`. New `GET /v1/content/music-tracks` returns active tracks with a delivery URL (an empty list is valid). The server also validates the uploaded asset `durationMs ≤ 90 s` for `format: 'clip'`.
- **Admin later**: CRUD for `music_tracks`, plus allowing `audio/mpeg` and `audio/mp4` in the admin Media Library (`validateUpload.ts` currently allows only image, pdf and mp4).
- **Mobile feed**: `ReelFeedScreen` music label uses `item.music ? '♪ title · artist' : '♪ Original audio'` (stop using `title`).
- **No Stream or webhook changes.** The admin reels flow is untouched.

### 3.5 Permissions
- iOS: the existing strings already cover camera, mic and photo library. Update the mic string to mention Clip recording explicitly (it already does). Add `NSPhotoLibraryAddUsageDescription` only if we add "Save to camera roll". `PrivacyInfo.xcprivacy`: check whether VisionCamera or Media APIs need required-reason entries (file timestamp, already common).
- Android: `CAMERA` and `RECORD_AUDIO` are present. The gallery uses the system Photo Picker through image-picker on API 33+, so no `READ_MEDIA_VIDEO` is needed. Add `<uses-feature android:name="android.hardware.camera" android:required="false"/>`. Runtime requests go through VisionCamera hooks.

### 3.6 Build order (phase 2)
1. **Contracts + DB + API**: add the `edit` field, music columns and table, `GET /music-tracks`, feed `music`, and the 90 s clip check, with tests in `routes/*.test.ts`. (Pure TS, no native rebuild.)
2. **Native deps**: `pnpm --filter @anticlock/mobile add react-native-vision-camera@^5.2 react-native-nitro-image`, then `cd apps/mobile/ios && pod install`, plus a clean Android build. **Needs a native rebuild.** Verify the VisionCamera v5 Android minSdk (bump 24 → 26 if it requires it) and 16 KB page alignment.
3. **ClipEditor native module**: write the Swift + Kotlin + codegen spec, add the Media3 Gradle deps, then `pod install` and rebuild. Run a smoke test from a debug screen: `getInfo`, `thumbnails`, and `export` with trim and music on both platforms.
4. **Camera screen** (`ClipCameraScreen`): permissions, preview, hold/tap, flip, flash, duration options, progress ring, segments, gallery. (JS only after step 2.)
5. **Editor**: trim strip, preview loop, music picker + segment trim, volume mix, cover frame, export progress and cancel, and draft v2 (migrating the v1 draft).
6. **Publish integration**: upload the exported MP4 + cover, send `edit` in the container. Update the feed music label.
7. **Music catalog**: bundled `tracks.json` loader + remote hook. Ship empty unless licensed files are supplied.
8. QA matrix: iOS 15/17/18+ and Android 10/13/15; front and back camera; HEVC/HDR gallery sources (export to SDR H.264); rotated sources; videos over 90 s; mic denied; app backgrounded during export; low storage. Clean up temp files after publish.

---

## 4. Risks / open decisions
- **Music licensing (decision needed)**: which tracks may ship? Without owner-provided CC0 or licensed files, the picker launches empty and the remote catalog stays admin-managed. No third-party catalogue (Spotify, Apple Music) will be faked.
- **VisionCamera v5 on RN 0.86**: it is built against 0.85.3. Nitro 0.37 is already in the tree, so this is low risk, but it must be verified at step 2. The Android minSdk may need to go to 26.
- **Native module maintenance**: about 400–600 LOC of Swift + Kotlin is now owned in-repo. The ffmpeg fallback is documented above.
- **Preview fidelity**: two `react-native-video` players can drift slightly from the exported mix. The export is the source of truth.
- **HDR/HEVC gallery inputs**: the export must tone-map to SDR H.264 for broad playback, because R2 serves MP4 directly with no transcode or ABR.
- **File size**: there is no server transcode, so the client bitrate cap (about 6 Mbps at 1080p, roughly 68 MB for 90 s) is the only bandwidth control. `MEDIA_UPLOAD_MAX_VIDEO_BYTES` (250 MB) still applies.
- **Server memory**: `completeUpload` buffers the full file for sha256. This is unchanged but worth a follow-up (streaming hash).
- **CI**: PR #21 is still open. Phase-2 PRs need it merged or rebased for green CI.
- **Scope cuts for v1**: text, stickers, filters, speed, voiceover and multi-clip reordering stay hidden.
