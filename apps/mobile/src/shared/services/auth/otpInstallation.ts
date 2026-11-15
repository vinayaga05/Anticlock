import { storage } from '@/shared/services/storage';

const KEY = 'auth.otp.installation-id';

/** An untrusted installation label for abuse controls, never an authentication secret. */
export function getOtpInstallationId(): string {
  const existing = storage.getString(KEY);
  if (existing && /^[a-zA-Z0-9-]{8,128}$/.test(existing)) return existing;
  const id = `otp-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 14)}-${Math.random().toString(36).slice(2, 14)}`;
  storage.set(KEY, id);
  return id;
}
