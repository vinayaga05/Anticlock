import {
  uploadContentMedia,
  type PublishingIdentity,
} from '@/shared/api/publishingHooks';
import type { PickedProfilePhoto } from '@/features/profile/utils/profilePhoto';
import { getApiToken } from '@/shared/api/client';
import { getStoredSession } from '@/shared/services/storage';
import { isSessionExpired } from '@/shared/services/auth/types';

/** Public storefront/review images use creator media, never private KYC uploads. */
export async function uploadBusinessImage(
  identity: PublishingIdentity,
  photo: PickedProfilePhoto,
  signal?: AbortSignal,
): Promise<string> {
  const session = getStoredSession();
  const token = getApiToken();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let cancelled: (() => void) | undefined;
  let stopped: Error | null = null;
  const assertCurrent = () => {
    if (stopped) throw stopped;
    if (signal?.aborted) throw new Error('Image upload cancelled.');
    if (!session || !token || isSessionExpired(session.expiresAt))
      throw new Error('Sign in to upload an image.');
    const current = getStoredSession();
    if (
      current?.user.id !== session.user.id ||
      current.token !== token ||
      getApiToken() !== token ||
      isSessionExpired(current.expiresAt)
    )
      throw new Error('Your account changed. Reopen this page to try again.');
    if (identity.type === 'user' && identity.id !== session.user.id)
      throw new Error('Choose your own profile to upload a review photo.');
  };
  assertCurrent();
  if (
    !/^(file|content):\/\//i.test(photo.uri) ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(photo.contentType) ||
    !Number.isSafeInteger(photo.byteSize) ||
    photo.byteSize <= 0 ||
    photo.byteSize > 5 * 1024 * 1024
  )
    throw new Error('Choose a JPEG, PNG or WebP photo no larger than 5 MB.');
  try {
    const stop = new Promise<never>((_, reject) => {
      cancelled = () => {
        stopped = new Error('Image upload cancelled.');
        controller.abort();
        reject(stopped);
      };
      signal?.addEventListener('abort', cancelled, { once: true });
      if (signal?.aborted) cancelled();
      timeout = setTimeout(() => {
        stopped = new Error(
          'Image upload timed out. Your selected image is still here. Try again.',
        );
        controller.abort();
        reject(stopped);
      }, 45_000);
    });
    // Do not let cancellation before transport start create an upload session.
    assertCurrent();
    const id = await Promise.race([
      uploadContentMedia(
        identity,
        {
          kind: 'image',
          filename: photo.filename,
          contentType: photo.contentType,
          byteSize: photo.byteSize,
          localUri: photo.uri,
          width: photo.width,
          height: photo.height,
        },
        'public',
        undefined,
        { signal: controller.signal },
      ),
      stop,
    ]);
    assertCurrent();
    if (typeof id !== 'string' || !id.trim())
      throw new Error('The uploaded image could not be confirmed. Try again.');
    return id;
  } finally {
    if (timeout) clearTimeout(timeout);
    if (cancelled) signal?.removeEventListener('abort', cancelled);
  }
}
