import {
  launchCamera,
  launchImageLibrary,
  type Asset,
} from 'react-native-image-picker';
import type { ContentUploadFile } from '@/shared/api/publishingHooks';

export type ClipPreviewSource = string | number;

/**
 * A video selected by the native picker. The app deliberately keeps this
 * interface independent of a picker library: native builds can register an
 * adapter for their approved gallery/camera implementation without making the
 * composer depend on an uninstalled module.
 */
export type PickedClipVideo = {
  id: string;
  label: string;
  previewSource: ClipPreviewSource;
  filename: string;
  contentType: 'video/mp4';
  /** Required by the upload API for Clips. */
  durationMs: number;
  width?: number;
  height?: number;
  /** Native gallery URI used for a streaming upload when available. */
  localUri?: string;
  /** Picker-reported size avoids reading the complete media file in JS. */
  byteSize?: number;
  loadBytes: () => Promise<ArrayBuffer>;
};

export type PickedClipCover = {
  id: string;
  label: string;
  previewSource: ClipPreviewSource;
  filename: string;
  contentType: 'image/jpeg' | 'image/png';
  width?: number;
  height?: number;
  localUri?: string;
  byteSize?: number;
  loadBytes: () => Promise<ArrayBuffer>;
};

export type ClipMediaPickerAdapter = {
  pickVideo: () => Promise<PickedClipVideo | null>;
  captureVideo?: () => Promise<PickedClipVideo | null>;
  pickCover?: () => Promise<PickedClipCover | null>;
};

let registeredAdapter: ClipMediaPickerAdapter | null = null;

/** Override the built-in library picker for a camera or enterprise picker. */
export function setClipMediaPickerAdapter(
  adapter: ClipMediaPickerAdapter | null,
) {
  registeredAdapter = adapter;
}

export function hasNativeClipMediaPicker() {
  return true;
}

function normalizedMime(value: string | undefined) {
  return value?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
}

function positiveNumber(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function positiveByteSize(value: number | undefined) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function nativeLocalUri(uri: string) {
  return /^(file|content):\/\//i.test(uri) ? uri : undefined;
}

async function loadUriBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(
      'The selected media could not be read. Please choose it again.',
    );
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 1) {
    throw new Error('The selected media is empty. Please choose another file.');
  }
  return bytes;
}

function selectedAsset(
  response: Awaited<ReturnType<typeof launchImageLibrary>>,
) {
  if (response.didCancel) return null;
  if (response.errorCode) {
    throw new Error(
      response.errorMessage ?? 'Could not open your media library.',
    );
  }
  const asset = response.assets?.[0];
  if (!asset?.uri) {
    throw new Error('No usable media was selected. Please try again.');
  }
  return asset;
}

function videoFromAsset(asset: Asset): PickedClipVideo {
  const type = normalizedMime(asset.type);
  const filename = asset.fileName?.trim() || 'anticlock-clip.mp4';
  if (type && type !== 'video/mp4') {
    throw new Error(
      'Choose an MP4 video. Other video formats are not ready for Clips yet.',
    );
  }
  if (!type && !filename.toLowerCase().endsWith('.mp4')) {
    throw new Error(
      'Choose an MP4 video. Other video formats are not ready for Clips yet.',
    );
  }
  const durationMs = Math.round((asset.duration ?? 0) * 1_000);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(
      'We could not read this video’s duration. Please choose another MP4.',
    );
  }
  if (durationMs > 90_000) {
    throw new Error(
      'Clips can be up to 90 seconds long. Choose a shorter video.',
    );
  }
  return {
    id: asset.id ?? asset.uri!,
    label: filename,
    previewSource: asset.uri!,
    filename,
    contentType: 'video/mp4',
    durationMs,
    width: positiveNumber(asset.width),
    height: positiveNumber(asset.height),
    localUri: nativeLocalUri(asset.uri!),
    byteSize: positiveByteSize(asset.fileSize),
    loadBytes: () => loadUriBytes(asset.uri!),
  };
}

function coverFromAsset(asset: Asset): PickedClipCover {
  const type = normalizedMime(asset.type);
  const filename = asset.fileName?.trim() || 'anticlock-cover.jpg';
  const isKnownImage = type === 'image/jpeg' || type === 'image/png';
  const hasKnownExtension = /\.(jpe?g|png)$/i.test(filename);
  if (!isKnownImage && !hasKnownExtension) {
    throw new Error('Choose a JPEG or PNG image for the cover.');
  }
  return {
    id: asset.id ?? asset.uri!,
    label: filename,
    previewSource: asset.uri!,
    filename,
    contentType:
      type === 'image/png' || filename.toLowerCase().endsWith('.png')
        ? 'image/png'
        : 'image/jpeg',
    width: positiveNumber(asset.width),
    height: positiveNumber(asset.height),
    localUri: nativeLocalUri(asset.uri!),
    byteSize: positiveByteSize(asset.fileSize),
    loadBytes: () => loadUriBytes(asset.uri!),
  };
}

export async function pickClipVideo(): Promise<PickedClipVideo | null> {
  if (registeredAdapter) return registeredAdapter.pickVideo();
  const asset = selectedAsset(
    await launchImageLibrary({
      mediaType: 'video',
      selectionLimit: 1,
      // iOS converts a compatible library representation to MP4 when it can.
      formatAsMp4: true,
      assetRepresentationMode: 'compatible',
      restrictMimeTypes: ['video/mp4'],
    }),
  );
  return asset ? videoFromAsset(asset) : null;
}

/** Opens the system camera for a vertical, short-form Clip recording. */
export async function captureClipVideo(): Promise<PickedClipVideo | null> {
  if (registeredAdapter?.captureVideo) return registeredAdapter.captureVideo();
  const asset = selectedAsset(
    await launchCamera({
      mediaType: 'video',
      cameraType: 'back',
      videoQuality: 'high',
      durationLimit: 90,
      saveToPhotos: false,
      formatAsMp4: true,
    }),
  );
  return asset ? videoFromAsset(asset) : null;
}

export type SavedClipVideo = Pick<
  PickedClipVideo,
  | 'id'
  | 'label'
  | 'filename'
  | 'durationMs'
  | 'width'
  | 'height'
  | 'localUri'
  | 'byteSize'
>;

/** Rehydrates a still-available camera/gallery file for a local draft. */
export function restoreSavedClipVideo(
  saved: SavedClipVideo | null | undefined,
): PickedClipVideo | null {
  if (!saved?.localUri) return null;
  return {
    ...saved,
    previewSource: saved.localUri,
    contentType: 'video/mp4',
    loadBytes: () => loadUriBytes(saved.localUri!),
  };
}

export type SavedClipCover = Pick<
  PickedClipCover,
  | 'id'
  | 'label'
  | 'filename'
  | 'contentType'
  | 'width'
  | 'height'
  | 'localUri'
  | 'byteSize'
>;

/** Rehydrates a still-available custom cover for a local draft. */
export function restoreSavedClipCover(
  saved: SavedClipCover | null | undefined,
): PickedClipCover | null {
  if (!saved?.localUri) return null;
  return {
    ...saved,
    previewSource: saved.localUri,
    loadBytes: () => loadUriBytes(saved.localUri!),
  };
}

export async function pickClipCover(): Promise<PickedClipCover | null> {
  if (registeredAdapter?.pickCover) return registeredAdapter.pickCover();
  const asset = selectedAsset(
    await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      assetRepresentationMode: 'compatible',
      restrictMimeTypes: ['image/jpeg', 'image/png'],
    }),
  );
  return asset ? coverFromAsset(asset) : null;
}

export async function createVideoUploadFile(
  video: PickedClipVideo,
): Promise<ContentUploadFile> {
  if (video.localUri && video.byteSize) {
    return {
      kind: 'video',
      filename: video.filename,
      contentType: video.contentType,
      byteSize: video.byteSize,
      durationMs: video.durationMs,
      width: video.width,
      height: video.height,
      localUri: video.localUri,
    };
  }
  const bytes = await video.loadBytes();
  if (bytes.byteLength < 1) {
    throw new Error('The selected video is empty. Choose another video.');
  }
  return {
    kind: 'video',
    filename: video.filename,
    contentType: video.contentType,
    byteSize: bytes.byteLength,
    durationMs: video.durationMs,
    width: video.width,
    height: video.height,
    bytes,
  };
}

export async function createCoverUploadFile(
  cover: PickedClipCover,
): Promise<ContentUploadFile> {
  if (cover.localUri && cover.byteSize) {
    return {
      kind: 'image',
      filename: cover.filename,
      contentType: cover.contentType,
      byteSize: cover.byteSize,
      width: cover.width,
      height: cover.height,
      localUri: cover.localUri,
    };
  }
  const bytes = await cover.loadBytes();
  if (bytes.byteLength < 1) {
    throw new Error('The selected cover image is empty. Choose another image.');
  }
  return {
    kind: 'image',
    filename: cover.filename,
    contentType: cover.contentType,
    byteSize: bytes.byteLength,
    width: cover.width,
    height: cover.height,
    bytes,
  };
}
