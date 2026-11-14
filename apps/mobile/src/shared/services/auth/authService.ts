import { ApiError, apiRequest, setApiToken } from '@/shared/api/client';
import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
} from '@/shared/services/storage';
import { createOtpProvider } from './otpProvider';
import {
  AuthSession,
  isSessionExpired,
  MobileUser,
  OtpSendResult,
  ProfileUpdate,
  OtpRequestOptions,
} from './types';
import { ensureUserAvatar } from './avatar';

const otpProvider = createOtpProvider();

export async function sendOtp(phone: string, options?: OtpRequestOptions): Promise<OtpSendResult> {
  return otpProvider.sendOtp(phone, options);
}

export async function verifyOtp(
  phone: string,
  code: string,
  requestId: string,
  options?: OtpRequestOptions,
): Promise<AuthSession> {
  const previousToken = getStoredSession()?.token;
  const session = await otpProvider.verifyOtp(phone, code, requestId, options);
  if (options?.signal?.aborted || options?.isCurrentAttempt?.() === false || getStoredSession()?.token !== previousToken) {
    throw new ApiError(0, 'otp_cancelled', 'This sign-in attempt is no longer active.');
  }
  const sessionWithAvatar = { ...session, user: ensureUserAvatar(session.user) };
  persistSession(sessionWithAvatar);
  return sessionWithAvatar;
}

export function persistSession(session: AuthSession): void {
  const previous = getStoredSession();
  const storedAvatarUrl = previous?.user.id === session.user.id ? previous.user.avatarUrl : undefined;
  const sessionWithAvatar = {
    ...session,
    user: ensureUserAvatar(session.user, storedAvatarUrl),
  };
  setStoredSession(sessionWithAvatar);
  setApiToken(sessionWithAvatar.token);
}

export function clearSession(): void {
  clearStoredSession();
  setApiToken(null);
}

export function readStoredSession(): AuthSession | null {
  const session = getStoredSession();
  if (!session) return null;
  if (isSessionExpired(session.expiresAt)) {
    clearSession();
    return null;
  }
  setApiToken(session.token);
  return session;
}

export async function validateSession(session: AuthSession): Promise<MobileUser | null> {
  const isCurrent = () => getStoredSession()?.token === session.token;
  if (isSessionExpired(session.expiresAt)) {
    if (isCurrent()) clearSession();
    return null;
  }

  try {
    const res = await apiRequest<{ user: MobileUser }>('/auth/mobile/me');
    if (!isCurrent()) return null;
    if (res.user.id !== session.user.id) {
      clearSession();
      return null;
    }
    return ensureUserAvatar(res.user, session.user.avatarUrl);
  } catch (error) {
    if (!isCurrent()) return null;
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      clearSession();
      return null;
    }
    // A temporary network/provider outage does not invalidate a saved login.
    return ensureUserAvatar(session.user);
  }
}

export async function logoutRemote(): Promise<void> {
  try {
    await apiRequest('/auth/mobile/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}

export async function updateProfile(input: ProfileUpdate): Promise<MobileUser> {
  const session = readStoredSession();
  if (!session) throw new Error('Please sign in to edit your profile.');

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let response: { user: MobileUser };
  try {
    // Bound both transfer and response parsing; receiving headers alone does
    // not confirm a saved profile or make the editor safe to leave pending.
    response = await Promise.race([
      apiRequest<{ user: MobileUser }>('/auth/mobile/profile', {
        method: 'PUT',
        body: JSON.stringify(input),
        signal: controller.signal,
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error('Saving your profile timed out. Your changes are still here. Please try again.'));
          controller.abort();
        }, 20_000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  const user = response.user;
  const currentSession = getStoredSession();
  if (
    !currentSession ||
    currentSession.user.id !== session.user.id ||
    currentSession.token !== session.token ||
    isSessionExpired(currentSession.expiresAt)
  ) {
    throw new Error('Your account changed. Reopen Edit profile to try again.');
  }
  if (user.id !== session.user.id) {
    throw new Error('The profile update could not be confirmed. Please try again.');
  }

  const updatedSession = { ...session, user: ensureUserAvatar(user) };
  persistSession(updatedSession);
  return updatedSession.user;
}
