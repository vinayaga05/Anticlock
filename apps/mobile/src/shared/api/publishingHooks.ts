import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, getApiToken, ApiError } from './client';
import { API_BASE_URL, isApiEnabled } from './config';
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
  /** Bytes obtained by the platform picker/camera integration. */
  bytes: ArrayBuffer;
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
    throw new ApiError(0, 'api_disabled', 'Configure the API before uploading media.');
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
  if (created.upload.uploadUrl.startsWith(API_BASE_URL)) {
    uploadHeaders.set('Authorization', `Bearer ${session.token ?? getApiToken() ?? ''}`);
  }
  const put = await fetch(created.upload.uploadUrl, {
    method: 'PUT',
    headers: uploadHeaders,
    body: file.bytes,
  });
  if (!put.ok) {
    throw new ApiError(put.status, 'upload_failed', 'Video upload failed. Please try again.');
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
    queryKey: ['publishing', 'identities', isApiEnabled ? 'api' : 'local', session?.user.id],
    queryFn: async (): Promise<PublishingIdentity[]> => {
      const current = requireSession().user;
      if (!isApiEnabled) {
        return [{ type: 'user', id: current.id, name: current.displayName, avatarUrl: current.avatarUrl ?? null }];
      }
      const response = await apiRequest<{ identities: PublishingIdentity[] }>('/v1/content/identities');
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
      const created = await apiRequest<{ container: { id: string } }>('/v1/content/containers', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      return apiRequest<{ post: { id: string } }>(
        `/v1/content/containers/${created.container.id}/publish`,
        { method: 'POST', headers },
      );
    },
  });
}
