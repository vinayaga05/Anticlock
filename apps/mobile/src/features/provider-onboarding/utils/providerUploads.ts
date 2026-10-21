import { PermissionsAndroid, Platform } from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  type Asset,
  type ImagePickerResponse,
} from 'react-native-image-picker';
import { apiRequest, getApiToken } from '@/shared/api/client';
import { getApiBaseUrl } from '@/shared/api/config';
import { readStoredSession } from '@/shared/services/auth/authService';

export type ProviderUploadKind = 'image' | 'document' | 'video';
export type ProviderUploadPurpose = 'document' | 'profile';

/** Mirrors PROVIDER_UPLOAD_LIMITS in @anticlock/contracts (server enforces). */
export const PROVIDER_UPLOAD_LIMITS: Record<
  ProviderUploadKind,
  { maxBytes: number; mimeTypes: readonly string[]; label: string }
> = {
  image: {
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    label: 'JPEG, PNG, WebP or GIF up to 10 MB',
  },
  document: {
    maxBytes: 20 * 1024 * 1024,
    // `*/*` = any file type (PDF, photos, Word, Excel, ZIP, …).
    mimeTypes: ['*/*'],
    label: 'Any file up to 20 MB',
  },
  video: {
    maxBytes: 250 * 1024 * 1024,
    mimeTypes: ['video/mp4'],
    label: 'MP4 up to 250 MB',
  },
};

export type PickedProviderFile = {
  uri: string;
  filename: string;
  contentType: string;
  byteSize?: number;
  durationMs?: number;
  width?: number;
  height?: number;
};

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
};

function positive(value: number | undefined) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : undefined;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Normalises an image-picker asset into an upload candidate. */
export function fileFromAsset(
  asset: Asset,
  kind: ProviderUploadKind,
): PickedProviderFile {
  if (!asset.uri)
    throw new Error('No usable file was selected. Please try again.');
  const ext = asset.fileName?.split('.').pop()?.toLowerCase() ?? '';
  const contentType =
    asset.type?.split(';', 1)[0]?.trim().toLowerCase() || EXT_MIME[ext] || '';
  const fallbackName =
    kind === 'video'
      ? 'video.mp4'
      : contentType === 'image/png'
      ? 'photo.png'
      : 'photo.jpg';
  return {
    uri: asset.uri,
    filename: asset.fileName?.trim() || fallbackName,
    contentType,
    byteSize: positive(asset.fileSize),
    durationMs: asset.duration ? positive(asset.duration * 1000) : undefined,
    width: positive(asset.width),
    height: positive(asset.height),
  };
}

function mimeAllowed(
  contentType: string,
  mimeTypes: readonly string[],
): boolean {
  if (mimeTypes.includes('*/*')) return Boolean(contentType.trim());
  return mimeTypes.includes(contentType);
}

/** Client-side MIME/size check; returns a user-facing error or null. */
export function validatePickedFile(
  file: Pick<PickedProviderFile, 'contentType' | 'byteSize' | 'durationMs'>,
  kind: ProviderUploadKind,
): string | null {
  const limits = PROVIDER_UPLOAD_LIMITS[kind];
  if (!mimeAllowed(file.contentType, limits.mimeTypes)) {
    if (
      kind !== 'document' &&
      (file.contentType === 'image/heic' || file.contentType === 'image/heif')
    ) {
      return 'HEIC photos are not supported. Choose a JPEG or PNG.';
    }
    return `Unsupported file type. Use ${limits.label}.`;
  }
  if (file.byteSize !== undefined && file.byteSize > limits.maxBytes) {
    return `File is ${formatBytes(file.byteSize)}. The limit is ${formatBytes(
      limits.maxBytes,
    )}.`;
  }
  if (file.byteSize !== undefined && file.byteSize < 1) {
    return 'The selected file is empty.';
  }
  if (kind === 'video' && !file.durationMs) {
    return 'We could not read this video’s duration. Choose another MP4.';
  }
  return null;
}

function selectedAssets(response: ImagePickerResponse) {
  if (response.didCancel) return [];
  if (response.errorCode) {
    throw new Error(
      response.errorCode === 'camera_unavailable'
        ? 'The camera is not available on this device.'
        : response.errorCode === 'permission'
        ? 'Allow camera/photo access in Settings to upload files.'
        : response.errorMessage ?? 'Could not open the picker.',
    );
  }
  return response.assets ?? [];
}

/**
 * react-native-image-picker refuses to open the camera when CAMERA is in the
 * manifest but has not been granted yet. Reels already declares that
 * permission, so document and profile photos must request it first.
 */
export async function ensureCameraPermission(os: string = Platform.OS) {
  if (os !== 'android') return;
  const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(permission)) return;
  const result = await PermissionsAndroid.request(permission, {
    title: 'Camera access',
    message: 'Allow the camera so you can photograph documents and photos.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return;
  throw new Error(
    result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ? 'Camera access is turned off. Enable it in Settings to take a photo.'
      : 'Allow camera access to take a photo.',
  );
}

/**
 * Opens the system document picker for any file type (PDF, photos, office…).
 */
export async function pickProviderDocument(): Promise<PickedProviderFile[]> {
  const picker = await import('@react-native-documents/picker');
  try {
    const [file] = await picker.pick({
      type: [picker.types.allFiles],
      allowMultiSelection: false,
    });
    if (!file?.uri) return [];
    const name = file.name?.trim() || 'document.bin';
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const contentType =
      (file.type && file.type !== 'application/octet-stream'
        ? file.type
        : undefined) ||
      EXT_MIME[ext] ||
      'application/octet-stream';
    return [
      {
        uri: file.uri,
        filename: name,
        contentType,
        byteSize:
          typeof file.size === 'number' && file.size > 0 ? file.size : undefined,
      },
    ];
  } catch (err) {
    if (picker.isErrorWithCode(err) && err.code === picker.errorCodes.OPERATION_CANCELED) {
      return [];
    }
    throw err;
  }
}

/** @deprecated Use pickProviderDocument — kept for older call sites/tests. */
export async function pickProviderPdf(): Promise<PickedProviderFile[]> {
  return pickProviderDocument();
}

export async function pickProviderFiles(
  kind: ProviderUploadKind,
  source: 'camera' | 'library' | 'pdf' | 'file',
  selectionLimit = 1,
): Promise<PickedProviderFile[]> {
  if (source === 'pdf' || source === 'file') return pickProviderDocument();
  const mediaType = kind === 'video' ? 'video' : 'photo';
  if (source === 'camera') await ensureCameraPermission();
  const response =
    source === 'camera'
      ? await launchCamera({
          mediaType,
          saveToPhotos: false,
          quality: 0.8,
          maxWidth: 2400,
          maxHeight: 2400,
          ...(kind === 'video'
            ? { formatAsMp4: true, videoQuality: 'high' }
            : {}),
        })
      : await launchImageLibrary({
          mediaType,
          selectionLimit,
          quality: 0.8,
          maxWidth: 2400,
          maxHeight: 2400,
          assetRepresentationMode: 'compatible',
          ...(kind === 'video'
            ? { formatAsMp4: true, restrictMimeTypes: ['video/mp4'] }
            : {}),
        });
  return selectedAssets(response).map(asset => fileFromAsset(asset, kind));
}

/**
 * Read the picked file once. Android `content://` grants are often single-use;
 * opening the URI again for the PUT after a size probe returns 404.
 */
async function readPickedFileBytes(file: PickedProviderFile): Promise<{
  bytes: ArrayBuffer;
  byteSize: number;
}> {
  const response = await fetch(file.uri);
  if (!response.ok) {
    throw new Error(
      'The selected file could not be read. Please choose it again.',
    );
  }
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) {
    throw new Error('The selected file is empty.');
  }
  return { bytes, byteSize: bytes.byteLength };
}

/**
 * A local-storage API returns its own authenticated PUT route; rebuild it on
 * the app's API origin (the server may know itself as localhost while an
 * emulator reaches it as 10.0.2.2). Presigned R2 URLs are used untouched.
 */
export function resolveUploadTarget(uploadUrl: string, apiBaseUrl: string) {
  const match = uploadUrl.match(
    /^https?:\/\/[^/]+(\/v1\/provider\/applications\/[^/]+\/kyc-upload-sessions\/[^/]+\/content)$/,
  );
  if (!match) return { url: uploadUrl, needsAuth: false };
  return {
    url: `${apiBaseUrl.replace(/\/$/, '')}${match[1]}`,
    needsAuth: true,
  };
}

/**
 * PUT raw bytes. Presigned R2 URLs must receive the object body (not an RN
 * `{ uri, type, name }` multipart-shaped payload). Local API routes accept the
 * same ArrayBuffer through fetch.
 */
async function putFileBytes(
  url: string,
  headers: Record<string, string>,
  bytes: ArrayBuffer,
  onProgress?: (fraction: number) => void,
) {
  // XHR exposes upload progress; fetch does not on React Native.
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);
    Object.entries(headers).forEach(([name, value]) =>
      request.setRequestHeader(name, value),
    );
    if (request.upload && onProgress) {
      request.upload.onprogress = event => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.min(1, event.loaded / event.total));
        }
      };
    }
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else
        reject(new Error(`Upload failed (${request.status}). Please retry.`));
    };
    request.onerror = () =>
      reject(new Error('Upload could not reach the server.'));
    request.ontimeout = () =>
      reject(new Error('Upload timed out. Please retry.'));
    request.onabort = () => reject(new Error('Upload was cancelled.'));
    request.send(bytes);
  });
}

export type ProviderUploadResult = { mediaId: string; url?: string | null };

export async function uploadProviderFile(opts: {
  applicationId: string;
  fieldKey: string;
  kind: ProviderUploadKind;
  purpose: ProviderUploadPurpose;
  file: PickedProviderFile;
  onProgress?: (fraction: number) => void;
}): Promise<ProviderUploadResult> {
  const { applicationId, fieldKey, kind, purpose, file, onProgress } = opts;
  const { bytes, byteSize } = await readPickedFileBytes(file);
  const invalid = validatePickedFile({ ...file, byteSize }, kind);
  if (invalid) throw new Error(invalid);

  const session = await apiRequest<{
    sessionId: string;
    mediaId: string;
    uploadUrl: string;
    headers?: Record<string, string>;
  }>(`/v1/provider/applications/${applicationId}/kyc-upload-session`, {
    method: 'POST',
    body: JSON.stringify({
      fieldKey,
      kind,
      purpose,
      filename: file.filename,
      contentType: file.contentType,
      byteSize,
      durationMs: file.durationMs,
      width: file.width,
      height: file.height,
    }),
  });

  const target = resolveUploadTarget(session.uploadUrl, getApiBaseUrl());
  const headers: Record<string, string> = {
    ...(session.headers ?? {}),
    'Content-Type': file.contentType,
  };
  if (target.needsAuth) {
    headers.Authorization = `Bearer ${
      readStoredSession()?.token ?? getApiToken() ?? ''
    }`;
  }
  onProgress?.(0);
  await putFileBytes(target.url, headers, bytes, onProgress);
  onProgress?.(1);

  const completed = await apiRequest<ProviderUploadResult>(
    `/v1/provider/applications/${applicationId}/kyc-upload-sessions/${session.sessionId}/complete`,
    { method: 'POST', body: JSON.stringify({ fieldKey, purpose }) },
  );
  return {
    mediaId: completed.mediaId ?? session.mediaId,
    url: completed.url ?? null,
  };
}
