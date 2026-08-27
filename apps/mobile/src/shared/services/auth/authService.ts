import { apiRequest, setApiToken } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
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
} from './types';

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
  persistSession(session);
  return session;
}

export function persistSession(session: AuthSession): void {
  setStoredSession(session);
  setApiToken(session.token);
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

  if (!isApiEnabled || session.token.startsWith('dev-')) {
    return session.user;
  }

  try {
    const res = await apiRequest<{ user: MobileUser }>('/auth/mobile/me');
    return res.user;
  } catch {
    clearSession();
    return null;
  }
}

export async function logoutRemote(): Promise<void> {
  const session = getStoredSession();
  if (!isApiEnabled || session?.token.startsWith('dev-')) {
    return;
  }

  try {
    await apiRequest('/auth/mobile/logout', { method: 'POST' });
  } catch {
    /* ignore */
  }
}
