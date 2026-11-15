export function otpSecondsUntil(
  timestamp: string | number | null,
  now: number,
): number {
  const target =
    typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp ?? 0;
  return Number.isFinite(target)
    ? Math.max(0, Math.ceil((target - now) / 1000))
    : 0;
}

export function otpDestination(phone: string): string {
  return phone ? `+91 ${phone.slice(3, 5)}••••${phone.slice(-4)}` : '';
}

export function otpRetryAt(error: unknown, now: number): number | null {
  const retry = (error as { retryAfterSeconds?: unknown } | null)
    ?.retryAfterSeconds;
  return typeof retry === 'number' && Number.isFinite(retry) && retry > 0
    ? now + Math.min(86_400, Math.ceil(retry)) * 1000
    : null;
}
import type { OtpSendResult } from '@/shared/services/auth/types';

/** Display server durations against the device clock; the backend enforces real expiry. */
export function otpLocalTiming(
  result: OtpSendResult,
  receivedAt: number,
): OtpSendResult {
  const lifetime = Math.min(300, Math.max(1, result.expiresInSeconds));
  const issuedAt =
    Date.parse(result.expiresAt) - result.expiresInSeconds * 1000;
  const resendDelay = Math.max(
    0,
    Math.min(300_000, Date.parse(result.resendAvailableAt) - issuedAt),
  );
  return {
    ...result,
    expiresAt: new Date(receivedAt + lifetime * 1000).toISOString(),
    resendAvailableAt: new Date(receivedAt + resendDelay).toISOString(),
  };
}
