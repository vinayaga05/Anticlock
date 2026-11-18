import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import {
  generateThumbnails,
  getVideoInfo,
  isClipEditorAvailable,
} from '@anticlock/react-native-clip-editor';
import type { ContentUploadFile } from '@/shared/api/publishingHooks';

export const STORY_MAX_DURATION_MS = 60_000;
export const STORY_MAX_SELECTION = 10;
export type StoryMediaFilter = 'all' | 'photos' | 'videos';
export type StoryPickedMedia = {
  id: string;
  type: 'photo' | 'video';
  uri: string;
  filename: string;
  contentType: 'image/jpeg' | 'image/png' | 'video/mp4';
  byteSize?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  thumbnailUri?: string;
  loadBytes(): Promise<ArrayBuffer>;
};

const localUri = (uri: string) => /^(file|content):\/\//i.test(uri);
const positive = (value: number | undefined) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

async function readBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok)
    throw new Error('This media could not be read. Choose it again.');
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength)
    throw new Error('This media is empty. Choose another file.');
  return bytes;
}

function selectedAssets(response: ImagePickerResponse): Asset[] {
  if (response.didCancel) return [];
  if (response.errorCode) {
    throw new Error(
      response.errorCode === 'permission'
        ? 'Allow access in device Settings, or choose another source.'
        : response.errorCode === 'camera_unavailable'
        ? 'Camera unavailable. Choose media from your gallery.'
        : 'The media picker could not open. Please try again.',
    );
  }
  if (!response.assets?.length)
    throw new Error('No media was selected. Please try again.');
  return response.assets;
}

async function storyMediaAsset(asset: Asset): Promise<StoryPickedMedia> {
  if (!asset.uri || !localUri(asset.uri)) {
    throw new Error('Choose a readable photo or video from your device.');
  }
  const mime = asset.type?.split(';')[0]?.trim().toLowerCase();
  const filename = asset.fileName?.trim();
  const contentType =
    mime === 'image/jpg'
      ? 'image/jpeg'
      : mime ||
        (/\.png$/i.test(filename ?? '')
          ? 'image/png'
          : /\.jpe?g$/i.test(filename ?? '')
          ? 'image/jpeg'
          : /\.mp4$/i.test(filename ?? '')
          ? 'video/mp4'
          : '');
  if (
    contentType !== 'image/jpeg' &&
    contentType !== 'image/png' &&
    contentType !== 'video/mp4'
  ) {
    throw new Error('Choose a JPEG or PNG photo, or an MP4 video.');
  }
  if (
    asset.fileSize !== undefined &&
    (!Number.isSafeInteger(asset.fileSize) || asset.fileSize <= 0)
  ) {
    throw new Error('This media is empty or unreadable. Choose another file.');
  }
  const type = contentType === 'video/mp4' ? 'video' : 'photo';
  let durationMs =
    type === 'video' ? Math.round((asset.duration ?? 0) * 1000) : undefined;
  let width = positive(asset.width);
  let height = positive(asset.height);
  let thumbnailUri: string | undefined =
    type === 'photo' ? asset.uri : undefined;
  if (type === 'video' && isClipEditorAvailable()) {
    if (!positive(durationMs)) {
      try {
        const info = await getVideoInfo(asset.uri);
        durationMs = Math.round(info.durationMs);
        width = width ?? positive(info.width);
        height = height ?? positive(info.height);
      } catch {
        // Missing duration is rejected below, without making an unsafe guess.
      }
    }
    // Thumbnails are only for the selection grid. Playback uses the video URI.
    if (positive(durationMs) && durationMs! <= STORY_MAX_DURATION_MS) {
      try {
        thumbnailUri = (await generateThumbnails([asset.uri], 1, 240))[0];
      } catch {
        /* optional preview */
      }
    }
  }
  if (type === 'video' && !positive(durationMs)) {
    throw new Error(
      'Could not read this video’s duration. Choose another MP4.',
    );
  }
  if (type === 'video' && durationMs! > STORY_MAX_DURATION_MS) {
    throw new Error(
      'Story videos can be up to 60 seconds. Choose a shorter video.',
    );
  }
  const uri = asset.uri;
  return {
    id: asset.id ?? uri,
    type,
    uri,
    filename:
      filename ??
      (type === 'video'
        ? 'knock-story.mp4'
        : contentType === 'image/png'
        ? 'knock-story.png'
        : 'knock-story.jpg'),
    contentType,
    byteSize: asset.fileSize,
    durationMs,
    width,
    height,
    thumbnailUri,
    loadBytes: () => readBytes(uri),
  };
}

/** Uses the system photo picker; it requests access only to chosen media. */
export async function pickStoryMedia(
  filter: StoryMediaFilter,
  selectionLimit = STORY_MAX_SELECTION,
): Promise<StoryPickedMedia[]> {
  const limit = Number.isFinite(selectionLimit)
    ? Math.max(1, Math.min(STORY_MAX_SELECTION, Math.floor(selectionLimit)))
    : STORY_MAX_SELECTION;
  const assets = selectedAssets(
    await launchImageLibrary({
      mediaType:
        filter === 'photos' ? 'photo' : filter === 'videos' ? 'video' : 'mixed',
      selectionLimit: limit,
      includeBase64: false,
      includeExtra: false,
      assetRepresentationMode: 'compatible',
      formatAsMp4: true,
      restrictMimeTypes:
        filter === 'photos'
          ? ['image/jpeg', 'image/png']
          : filter === 'videos'
          ? ['video/mp4']
          : ['image/jpeg', 'image/png', 'video/mp4'],
    }),
  );
  if (assets.length > limit)
    throw new Error(`Select up to ${limit} story items at a time.`);
  const result: StoryPickedMedia[] = [];
  for (const asset of assets) {
    const item = await storyMediaAsset(asset);
    if (
      (filter === 'photos' && item.type !== 'photo') ||
      (filter === 'videos' && item.type !== 'video')
    ) {
      throw new Error(
        filter === 'photos' ? 'Choose a photo.' : 'Choose a video.',
      );
    }
    if (!result.some(existing => existing.uri === item.uri)) result.push(item);
  }
  return result;
}

async function cameraPermission(video: boolean) {
  if (Platform.OS !== 'android') return;
  for (const permission of [
    PermissionsAndroid.PERMISSIONS.CAMERA,
    ...(video ? [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] : []),
  ]) {
    if (await PermissionsAndroid.check(permission)) continue;
    const result = await PermissionsAndroid.request(permission, {
      title: video ? 'Camera and microphone' : 'Camera access',
      message: video
        ? 'Record a video for your story.'
        : 'Take a photo for your story.',
      buttonPositive: 'Continue',
      buttonNegative: 'Not now',
    });
    if (result !== PermissionsAndroid.RESULTS.GRANTED) {
      throw new Error(
        'Allow camera access in device Settings, or choose from your gallery.',
      );
    }
  }
}

export async function captureStoryMedia(
  type: 'photo' | 'video',
): Promise<StoryPickedMedia | null> {
  await cameraPermission(type === 'video');
  const assets = selectedAssets(
    await launchCamera(
      type === 'video'
        ? {
            mediaType: 'video',
            cameraType: 'back',
            videoQuality: 'high',
            durationLimit: STORY_MAX_DURATION_MS / 1000,
            formatAsMp4: true,
            saveToPhotos: false,
            includeBase64: false,
            includeExtra: false,
          }
        : {
            mediaType: 'photo',
            cameraType: 'back',
            quality: 0.9,
            assetRepresentationMode: 'compatible',
            saveToPhotos: false,
            includeBase64: false,
            includeExtra: false,
          },
    ),
  );
  if (!assets.length) return null;
  const item = await storyMediaAsset(assets[0]);
  if (item.type !== type)
    throw new Error(type === 'photo' ? 'Choose a photo.' : 'Choose a video.');
  return item;
}

/** Keep picked files native whenever their size is known to avoid video copies in JS. */
export async function storyUploadFile(
  media: StoryPickedMedia,
): Promise<ContentUploadFile> {
  if (!localUri(media.uri))
    throw new Error('This media is no longer available. Choose it again.');
  if (
    media.type === 'video' &&
    (!positive(media.durationMs) || media.durationMs! > STORY_MAX_DURATION_MS)
  ) {
    throw new Error(
      'Choose a video up to 60 seconds with a readable duration.',
    );
  }
  const base = {
    kind: media.type === 'video' ? ('video' as const) : ('image' as const),
    filename: media.filename,
    contentType: media.contentType,
    durationMs: media.durationMs,
    width: media.width,
    height: media.height,
  };
  if (
    media.byteSize &&
    Number.isSafeInteger(media.byteSize) &&
    media.byteSize > 0
  ) {
    return { ...base, byteSize: media.byteSize, localUri: media.uri };
  }
  const bytes = await media.loadBytes();
  if (!bytes.byteLength)
    throw new Error('This media is empty. Choose another file.');
  return { ...base, byteSize: bytes.byteLength, bytes };
}
