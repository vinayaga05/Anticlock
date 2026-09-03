import { randomUUID } from 'node:crypto';
import { OtpError, type OtpProvider, type OtpSendResult, normalizePhone } from './types.js';

const DEV_OTP_WHITELIST: Record<string, string> = {
  '+919999999999': '123456',
  '+918888888888': '123456',
};

const CHALLENGE_TTL_MS = 10 * 60 * 1000;

type Challenge = {
  phone: string;
  code: string;
  expiresAt: number;
};

const challenges = new Map<string, Challenge>();

/**
 * Fixed OTP whitelist for staging / pre-MSG91 production.
 * Selected only when OTP_DEV_WHITELIST=true (or NODE_ENV !== production).
 */
export class DevWhitelistOtpProvider implements OtpProvider {
  async sendOtp(rawPhone: string): Promise<OtpSendResult> {
    const phone = normalizePhone(rawPhone);
    const code = DEV_OTP_WHITELIST[phone];
    if (!code) {
      throw new OtpError(
        'phone_not_allowed',
        'This number is not enabled for development login',
      );
    }

    const requestId = randomUUID();
    challenges.set(requestId, {
      phone,
      code,
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });

    console.log(`[dev-otp] ${phone} → ${code} (requestId=${requestId})`);

    return { requestId, expiresInSeconds: CHALLENGE_TTL_MS / 1000 };
  }

  async verifyOtp(rawPhone: string, code: string, requestId: string): Promise<boolean> {
    const phone = normalizePhone(rawPhone);
    const challenge = challenges.get(requestId);
    if (!challenge) return false;
    if (challenge.expiresAt < Date.now()) {
      challenges.delete(requestId);
      return false;
    }
    if (challenge.phone !== phone) return false;

    const ok = challenge.code === code;
    if (ok) challenges.delete(requestId);
    return ok;
  }
}
