import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, getApiToken, ApiError } from './client';
import { getApiBaseUrl, isApiEnabled } from './config';
import { readStoredSession } from '@/shared/services/auth/authService';

export type PublishingIdentity = {
  type: 'user' | 'provider';
  id: string;
  name: string;
  avatarUrl: string | null;
  role?: 'owner' | 'admin' | 'content_creator' | 'analyst';
};

type ContentContainerInput = {
  format: 'flash' | 'story' | 'clip';
  mediaType: 'text' | 'image' | 'video' | 'hybrid';
  caption: string;
  mediaIds?: string[];
  thumbnailMediaId?: string | null;
  hashtags?: string[];
  taggedUserIds?: string[];
  location?: {
    name: string;
    latitude?: number;
    longitude?: number;
  } | null;
  visibility: 'public' | 'followers' | 'friends' | 'community' | 'only_me';
  identity: PublishingIdentity;
};

export type ContentUploadFile = {
  kind: 'video' | 'image';
  filename: string;
  contentType: string;
  byteSize: number;
  durationMs?: number;
  width?: number;
  height?: number;
  /**
   * A picker-owned local URI. Keeping the file native lets Android stream it
   * through its content resolver instead of copying a video through JS.
   */
  localUri?: string;
  /** Used by non-native picker adapters when a local URI is unavailable. */
  bytes?: ArrayBuffer;
};

function requireSession() {
  const session = readStoredSession();
  if (!session?.token) throw new Error('Please sign in to publish.');
  return session;
}

function contextHeaders(identity: PublishingIdentity) {
  return {
    'X-Anticlock-Context-Type': identity.type,
    'X-Anticlock-Context-ID': identity.id,
  };
}

/** A bearer token is valid only for the configured API origin, never R2. */
function isLocalContentUploadUrl(uploadUrl: string) {
  try {
    const upload = new URL(uploadUrl);
    const api = new URL(getApiBaseUrl());
    return (
      upload.origin === api.origin &&
      upload.pathname.startsWith('/v1/content/uploads/')
    );
  } catch {
    return false;
  }
}

function isNativeLocalMediaUri(value: string | undefined): value is string {
  return Boolean(value && /^(file|content):\/\//i.test(value));
}

/**
 * React Native's normal fetch implementation serializes ArrayBuffers through
 * JS. XMLHttpRequest supports its native `{ uri }` request body instead,
 * which uses the platform file/content resolver for a raw PUT upload.
 */
function putNativeMediaFile(
  uploadUrl: string,
  headers: Headers,
  file: Pick<ContentUploadFile, 'localUri' | 'contentType' | 'filename'>,
): Promise<number> {
  if (!isNativeLocalMediaUri(file.localUri)) {
    return Promise.reject(
      new Error('The selected media file is no longer available.'),
    );
  }

  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', uploadUrl);
    headers.forEach((value, name) => request.setRequestHeader(name, value));
    request.onload = () => resolve(request.status);
    request.onerror = () =>
      reject(new Error('Media upload could not reach the server.'));
    request.ontimeout = () =>
      reject(new Error('Media upload timed out. Please try again.'));
    request.onabort = () => reject(new Error('Media upload was cancelled.'));
    request.send({
      uri: file.localUri,
      type: file.contentType,
      name: file.filename,
    });
  });
}

/**
 * Uploads one creator-selected video or custom cover, then returns the media
 * id to put into `usePublishContentMutation`. This keeps direct R2 uploads
 * out of the API process while local development uses the same mobile-auth
 * endpoint transparently.
 */
export async function uploadContentMedia(
  identity: PublishingIdentity,
  file: ContentUploadFile,
  visibility: ContentContainerInput['visibility'],
): Promise<string> {
  const session = requireSession();
  if (!isApiEnabled) {
    throw new ApiError(
      0,
      'api_disabled',
      'Configure the API before uploading media.',
    );
  }
  const headers = contextHeaders(identity);
  const created = await apiRequest<{
    upload: {
      sessionId: string;
      mediaId: string;
      uploadUrl: string;
      headers: Record<string, string>;
    };
  }>('/v1/content/uploads', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      kind: file.kind,
      filename: file.filename,
      contentType: file.contentType,
      byteSize: file.byteSize,
      durationMs: file.durationMs,
      width: file.width,
      height: file.height,
      visibility,
    }),
  });
  const uploadHeaders = new Headers(created.upload.headers);
  // Local storage uses an authenticated API endpoint; a presigned R2 URL
  // must receive exactly its signed headers, so never attach the JWT there.
  if (isLocalContentUploadUrl(created.upload.uploadUrl)) {
    uploadHeaders.set(
      'Authorization',
      `Bearer ${session.token ?? getApiToken() ?? ''}`,
    );
  }
  const status = isNativeLocalMediaUri(file.localUri)
    ? await putNativeMediaFile(created.upload.uploadUrl, uploadHeaders, file)
    : await (async () => {
        if (!file.bytes) {
          throw new Error(
            'The selected media could not be read. Please choose it again.',
          );
        }
        const put = await fetch(created.upload.uploadUrl, {
          method: 'PUT',
          headers: uploadHeaders,
          body: file.bytes,
        });
        return put.status;
      })();
  if (status < 200 || status >= 300) {
    throw new ApiError(
      status,
      'upload_failed',
      'Video upload failed. Please try again.',
    );
  }
  await apiRequest(`/v1/content/uploads/${created.upload.sessionId}/complete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  return created.upload.mediaId;
}

export function usePublishingIdentitiesQuery() {
  const session = readStoredSession();
  return useQuery({
    queryKey: [
      'publishing',
      'identities',
      isApiEnabled ? 'api' : 'local',
      session?.user.id,
    ],
    queryFn: async (): Promise<PublishingIdentity[]> => {
      const current = requireSession().user;
      if (!isApiEnabled) {
        return [
          {
            type: 'user',
            id: current.id,
            name: current.displayName,
            avatarUrl: current.avatarUrl ?? null,
          },
        ];
      }
      const response = await apiRequest<{ identities: PublishingIdentity[] }>(
        '/v1/content/identities',
      );
      return response.identities;
    },
    enabled: Boolean(session),
  });
}

export function usePublishContentMutation() {
  return useMutation({
    mutationFn: async (input: ContentContainerInput) => {
      if (!isApiEnabled) return null;
      const { identity, ...body } = input;
      const headers = contextHeaders(identity);
      const created = await apiRequest<{ container: { id: string } }>(
        '/v1/content/containers',
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
      );
      return apiRequest<{ post: { id: string } }>(
        `/v1/content/containers/${created.container.id}/publish`,
        { method: 'POST', headers },
      );
    },
  });
}
