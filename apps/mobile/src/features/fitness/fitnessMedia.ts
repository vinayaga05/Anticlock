import type {
  FitnessProgressMedia,
  FitnessMediaPurpose,
} from '@anticlock/contracts';
import { getApiBaseUrl, isApiEnabled } from '@/shared/api/config';
import { getStoredSession } from '@/shared/services/storage';
import {
  assertFitnessSession,
  fitnessRequest,
  fitnessSession,
} from './api/fitnessApi';

export type FitnessMediaUpload = {
  uri: string;
  name: string;
  type: string;
  purpose: FitnessMediaPurpose;
  clientRequestId: string;
  caption?: string;
  comparisonOptIn?: boolean;
  byteSize?: number;
};
export async function uploadFitnessMedia(
  input: FitnessMediaUpload,
  options: { signal?: AbortSignal } = {},
): Promise<FitnessProgressMedia> {
  if (!isApiEnabled)
    throw new Error('Private uploads are temporarily unavailable.');
  const session = fitnessSession(getStoredSession()?.user.id);
  if (
    !/^(file|content):\/\//i.test(input.uri) ||
    !['image/jpeg', 'image/png', 'image/webp', 'video/mp4'].includes(input.type)
  )
    throw new Error(
      'Choose a JPEG, PNG, WebP photo or MP4 video from your device.',
    );
  const max = input.type === 'video/mp4' ? 25 * 1024 * 1024 : 5 * 1024 * 1024;
  if (
    input.byteSize !== undefined &&
    (input.byteSize <= 0 || input.byteSize > max)
  )
    throw new Error(
      input.type === 'video/mp4'
        ? 'Choose a video up to25MB.'
        : 'Choose a photo up to5MB.',
    );
  if (options.signal?.aborted) throw new Error('Upload cancelled.');
  const form = new FormData();
  form.append('file', {
    uri: input.uri,
    name: input.name,
    type: input.type,
  } as unknown as Blob);
  form.append('purpose', input.purpose);
  form.append('clientRequestId', input.clientRequestId);
  if (input.caption) form.append('caption', input.caption);
  if (input.comparisonOptIn !== undefined)
    form.append('comparisonOptIn', String(input.comparisonOptIn));
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stop: (() => void) | undefined;
  try {
    const result = await Promise.race([
      (async () => {
        const response = await fetch(
          `${getApiBaseUrl()}/v1/fitness/media/upload`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.token}` },
            body: form,
            signal: controller.signal,
          },
        );
        const body = (await response.json().catch(() => {
          throw new Error(
            'Your private upload could not be confirmed. Try again.',
          );
        })) as { media?: FitnessProgressMedia; error?: { message?: string } };
        if (!response.ok || !body.media?.id)
          throw new Error(
            body.error?.message ??
              'Your private upload could not be confirmed. Try again.',
          );
        return body.media;
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new Error(
              'Private upload timed out. Your selected file is still here; try again.',
            ),
          );
        }, 50_000);
        stop = () => {
          controller.abort();
          reject(new Error('Upload cancelled.'));
        };
        options.signal?.addEventListener('abort', stop, { once: true });
      }),
    ]);
    assertFitnessSession(session);
    if (options.signal?.aborted) throw new Error('Upload cancelled.');
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    if (stop) options.signal?.removeEventListener('abort', stop);
  }
}

export async function getFitnessMedia(
  id: string,
  providerId?: string,
  signal?: AbortSignal,
) {
  const session = fitnessSession(getStoredSession()?.user.id);
  const suffix = providerId
    ? `?providerId=${encodeURIComponent(providerId)}`
    : '';
  const { media } = await fitnessRequest<{ media: FitnessProgressMedia }>(
    `/media/${encodeURIComponent(id)}${suffix}`,
    { signal },
    session,
  );
  return {
    media,
    source: {
      uri: `${getApiBaseUrl()}/v1/fitness/media/${encodeURIComponent(
        id,
      )}/content${suffix}`,
      headers: { Authorization: `Bearer ${session.token}` },
    },
  };
}
