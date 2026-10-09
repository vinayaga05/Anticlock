import { apiRequest, setApiToken } from '@/shared/api/client';
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
} from './types';
import { ensureUserAvatar } from './avatar';

const otpProvider = createOtpProvider();

export async function sendOtp(phone: string): Promise<OtpSendResult> {
  return otpProvider.sendOtp(phone);
}

export async function verifyOtp(
  phone: string,
  code: string,
  requestId: string,
): Promise<AuthSession> {
  const session = await otpProvider.verifyOtp(phone, code, requestId);
  const sessionWithAvatar = { ...session, user: ensureUserAvatar(session.user) };
  persistSession(sessionWithAvatar);
  return sessionWithAvatar;
}

export function persistSession(session: AuthSession): void {
  const storedAvatarUrl = getStoredSession()?.user.avatarUrl;
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
  if (isSessionExpired(session.expiresAt)) {
    clearSession();
    return null;
  }

  try {
    const res = await apiRequest<{ user: MobileUser }>('/auth/mobile/me');
    return ensureUserAvatar(res.user, session.user.avatarUrl);
  } catch {
    clearSession();
    return null;
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

  const response = await apiRequest<{ user: MobileUser }>('/auth/mobile/profile', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  const user = response.user;

  const updatedSession = { ...session, user: ensureUserAvatar(user) };
  persistSession(updatedSession);
  return updatedSession.user;
}
