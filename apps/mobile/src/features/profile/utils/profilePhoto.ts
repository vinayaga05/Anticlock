import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { getApiToken } from '@/shared/api/client';
import { getApiBaseUrl } from '@/shared/api/config';
import { getStoredSession } from '@/shared/services/storage';

export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 45_000;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type PhotoContentType = (typeof PHOTO_TYPES)[number];

export type PickedProfilePhoto = {
  uri: string;
  filename: string;
  contentType: PhotoContentType;
  byteSize: number;
  width?: number;
  height?: number;
};

type PhotoErrorCode =
  | 'permission_denied'
  | 'camera_unavailable'
  | 'picker_unavailable'
  | 'invalid_photo'
  | 'unauthorized'
  | 'cancelled'
  | 'session_changed'
  | 'timeout'
  | 'upload_failed';

export class ProfilePhotoError extends Error {
  constructor(public readonly code: PhotoErrorCode, message: string) {
    super(message);
    this.name = 'ProfilePhotoError';
  }
}

function permissionError(source: 'camera' | 'library') {
  return new ProfilePhotoError(
    'permission_denied',
    source === 'camera'
      ? 'Allow camera access in Settings to take a profile photo.'
      : 'Allow photo library access in Settings to choose a profile photo.',
  );
}

async function ensureCameraPermission() {
  if (Platform.OS !== 'android') return;
  try {
    const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
    if (await PermissionsAndroid.check(permission)) return;
    const result = await PermissionsAndroid.request(permission, {
      title: 'Camera access',
      message: 'Use your camera to take a profile photo.',
      buttonPositive: 'Continue',
      buttonNegative: 'Not now',
    });
    if (result === PermissionsAndroid.RESULTS.GRANTED) return;
  } catch {
    // Native permission failures use the same actionable recovery as denial.
  }
  throw permissionError('camera');
}

function positive(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function photoFromAsset(asset: Asset): PickedProfilePhoto {
  if (!asset.uri || !/^(file|content):\/\//i.test(asset.uri)) {
    throw new ProfilePhotoError('invalid_photo', 'This photo could not be read. Choose it again.');
  }
  const extension = asset.fileName?.split('.').pop()?.toLowerCase();
  const knownTypes: Record<string, PhotoContentType> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  };
  const reportedType = asset.type?.split(';', 1)[0].trim().toLowerCase();
  const contentType = (reportedType === 'image/jpg' ? 'image/jpeg' : reportedType)
    || knownTypes[extension ?? ''];
  if (!PHOTO_TYPES.includes(contentType as PhotoContentType)) {
    throw new ProfilePhotoError('invalid_photo', 'Choose a JPEG, PNG or WebP photo.');
  }
  const byteSize = asset.fileSize;
  if (typeof byteSize !== 'number' || !Number.isSafeInteger(byteSize) || byteSize <= 0) {
    throw new ProfilePhotoError('invalid_photo', 'The photo size could not be read. Choose another photo.');
  }
  if (byteSize > MAX_PROFILE_PHOTO_BYTES) {
    throw new ProfilePhotoError('invalid_photo', 'Choose a photo no larger than 5 MB.');
  }
  const suffix = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
  return {
    uri: asset.uri,
    filename: `profile-photo.${suffix}`,
    contentType: contentType as PhotoContentType,
    byteSize,
    width: positive(asset.width),
    height: positive(asset.height),
  };
}

/** The system picker keeps the selected photo in native storage, without base64. */
export async function pickProfilePhoto(source: 'camera' | 'library'): Promise<PickedProfilePhoto | null> {
  if (source === 'camera') await ensureCameraPermission();
  const options = {
    mediaType: 'photo' as const,
    maxWidth: 1024,
    maxHeight: 1024,
    quality: 0.8 as const,
    includeBase64: false,
    includeExtra: false,
    assetRepresentationMode: 'compatible' as const,
  };
  let response: ImagePickerResponse;
  try {
    response = source === 'camera'
      ? await launchCamera({ ...options, cameraType: 'front', saveToPhotos: false })
      : await launchImageLibrary({ ...options, selectionLimit: 1, restrictMimeTypes: [...PHOTO_TYPES] });
  } catch {
    throw new ProfilePhotoError('picker_unavailable', 'The photo picker could not open. Please try again.');
  }
  if (response.didCancel) return null;
  if (response.errorCode === 'permission') throw permissionError(source);
  if (response.errorCode === 'camera_unavailable') {
    throw new ProfilePhotoError('camera_unavailable', 'A camera is not available. Choose a photo from your gallery.');
  }
  if (response.errorCode) {
    throw new ProfilePhotoError('picker_unavailable', 'The photo could not be selected. Please try again.');
  }
  if (!response.assets?.[0]) {
    throw new ProfilePhotoError('invalid_photo', 'No photo was selected. Please try again.');
  }
  return photoFromAsset(response.assets[0]);
}

export type ProfilePhotoUploadOptions = {
  signal?: AbortSignal;
  expectedUserId?: string;
  expectedToken?: string | null;
  isCurrentSession?: () => boolean;
};

/** Upload only; the Edit Profile Save action persists the returned URL separately. */
export async function uploadProfilePhoto(photo: PickedProfilePhoto, options: ProfilePhotoUploadOptions = {}): Promise<string> {
  const token = options.expectedToken === undefined ? getApiToken() : options.expectedToken;
  const controller = new AbortController();
  let stopped: ProfilePhotoError | null = null;
  const assertCurrent = () => {
    if (stopped) throw stopped;
    if (options.signal?.aborted) throw new ProfilePhotoError('cancelled', 'Photo upload cancelled.');
    if (!token) throw new ProfilePhotoError('unauthorized', 'Sign in to upload a profile photo.');
    if (getApiToken() !== token || options.isCurrentSession?.() === false
      || options.expectedUserId && getStoredSession()?.user.id !== options.expectedUserId) {
      throw new ProfilePhotoError('session_changed', 'Your account changed. Please try saving again.');
    }
  };
  assertCurrent();
  const file = photoFromAsset({ uri: photo.uri, type: photo.contentType, fileName: photo.filename, fileSize: photo.byteSize });
  const api = new URL(getApiBaseUrl());
  if (!['http:', 'https:'].includes(api.protocol) || api.username || api.password) {
    throw new ProfilePhotoError('upload_failed', 'The photo service is unavailable. Please try again.');
  }
  const endpoint = new URL('/auth/mobile/avatar', api);
  const form = new FormData();
  form.append('file', { uri: file.uri, type: file.contentType, name: file.filename } as unknown as Blob);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => {
      stopped = new ProfilePhotoError('cancelled', 'Photo upload cancelled.');
      reject(stopped);
      controller.abort();
    };
    options.signal?.addEventListener('abort', onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
  });
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      stopped = new ProfilePhotoError('timeout', 'Photo upload timed out. Your selected photo is still here. Please try again.');
      reject(stopped);
      controller.abort();
    }, UPLOAD_TIMEOUT_MS);
  });
  const upload = (async () => {
    assertCurrent();
    const response = await fetch(endpoint.href, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      body: form,
      signal: controller.signal,
      redirect: 'error',
    });
    assertCurrent();
    let body: { avatarUrl?: unknown; error?: { message?: unknown } };
    try { body = await response.json(); }
    catch { throw new ProfilePhotoError('upload_failed', 'The photo upload could not be confirmed. Please try again.'); }
    assertCurrent();
    if (!response.ok) {
      if (response.status === 401) throw new ProfilePhotoError('unauthorized', 'Sign in again to upload your profile photo.');
      const message = typeof body?.error?.message === 'string' && body.error.message.length <= 300
        ? body.error.message : 'Your photo could not be uploaded. Please try again.';
      throw new ProfilePhotoError('upload_failed', message);
    }
    let avatar: URL;
    try { avatar = new URL(typeof body?.avatarUrl === 'string' ? body.avatarUrl : ''); }
    catch { throw new ProfilePhotoError('upload_failed', 'The photo upload could not be confirmed. Please try again.'); }
    if (avatar.origin !== api.origin || avatar.username || avatar.password || avatar.search || avatar.hash
      || !avatar.pathname.startsWith('/v1/media/file/public-media/')) {
      throw new ProfilePhotoError('upload_failed', 'The photo upload could not be confirmed. Please try again.');
    }
    return avatar.href;
  })();
  try {
    return await Promise.race([upload, cancelled, deadline]);
  } catch (error) {
    if (stopped) throw stopped;
    if (error instanceof ProfilePhotoError) throw error;
    throw new ProfilePhotoError('upload_failed', 'Your photo could not be uploaded. Check your connection and try again.');
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort) options.signal?.removeEventListener('abort', onAbort);
  }
}
