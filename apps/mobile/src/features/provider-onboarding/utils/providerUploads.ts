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
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    label: 'JPEG, PNG or WebP up to 10 MB',
  },
  document: {
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: ['application/pdf', 'image/jpeg', 'image/png'],
    label: 'Photo (JPEG or PNG) up to 20 MB',
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

/** Client-side MIME/size check; returns a user-facing error or null. */
export function validatePickedFile(
  file: Pick<PickedProviderFile, 'contentType' | 'byteSize' | 'durationMs'>,
  kind: ProviderUploadKind,
): string | null {
  const limits = PROVIDER_UPLOAD_LIMITS[kind];
  if (!limits.mimeTypes.includes(file.contentType)) {
    if (
      file.contentType === 'image/heic' ||
      file.contentType === 'image/heif'
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
 * Opens the camera or library for the field's media type. Documents are
 * photographed or picked from the library as images (no document-picker
 * native module is installed), with JPEG conversion for HEIC on iOS.
 */
export async function pickProviderFiles(
  kind: ProviderUploadKind,
  source: 'camera' | 'library',
  selectionLimit = 1,
): Promise<PickedProviderFile[]> {
  const mediaType = kind === 'video' ? 'video' : 'photo';
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

async function resolveByteSize(file: PickedProviderFile) {
  if (file.byteSize) return file.byteSize;
  const response = await fetch(file.uri);
  const blob = await response.blob();
  if (!blob.size) throw new Error('The selected file could not be read.');
  return blob.size;
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

function putFile(
  url: string,
  headers: Record<string, string>,
  file: PickedProviderFile,
  onProgress?: (fraction: number) => void,
) {
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
    // React Native streams `{ uri }` bodies natively instead of through JS.
    request.send({
      uri: file.uri,
      type: file.contentType,
      name: file.filename,
    } as never);
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
  const byteSize = await resolveByteSize(file);
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
    'Content-Type': file.contentType,
    ...(session.headers ?? {}),
  };
  if (target.needsAuth) {
    headers.Authorization = `Bearer ${
      readStoredSession()?.token ?? getApiToken() ?? ''
    }`;
  }
  onProgress?.(0);
  await putFile(target.url, headers, file, onProgress);
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
