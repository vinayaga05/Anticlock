import { randomUUID } from 'node:crypto';
import { OtpError, type OtpProvider, type OtpSendResult, normalizePhone } from './types.js';
import { isTestAccount, TEST_LOGIN_OTP } from './testLogin.js';

const DEV_OTP_WHITELIST: Record<string, string> = {
  '+919999999999': '123456',
  '+918888888888': '123456',
};

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SEND_REQUESTS_PER_WINDOW = 3;

type Challenge = {
  phone: string;
  code: string;
  expiresAt: number;
  attempts: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const challenges = new Map<string, Challenge>();
const sendRateLimits = new Map<string, RateLimitEntry>();

/**
 * Fixed OTP whitelist for staging / pre-MSG91 production.
 * Selected only when OTP_DEV_WHITELIST=true (or NODE_ENV !== production).
 * 
 * Also handles test login accounts (see testLogin.ts) regardless of environment.
 */
export class DevWhitelistOtpProvider implements OtpProvider {
  private checkSendRateLimit(phone: string): void {
    const now = Date.now();
    const entry = sendRateLimits.get(phone);

    if (!entry || entry.resetAt < now) {
      sendRateLimits.set(phone, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return;
    }

    if (entry.count >= MAX_SEND_REQUESTS_PER_WINDOW) {
      throw new OtpError(
        'rate_limit_exceeded',
        'Too many OTP requests. Please wait a minute and try again.',
      );
    }

    entry.count += 1;
  }

  async sendOtp(rawPhone: string): Promise<OtpSendResult> {
    const phone = normalizePhone(rawPhone);
    
    // Rate limiting applies to all numbers (including test accounts)
    this.checkSendRateLimit(phone);

    // Check if this is a test account (enabled in production by default)
    const isTest = isTestAccount(phone);
    const code = isTest ? TEST_LOGIN_OTP : DEV_OTP_WHITELIST[phone];

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
      attempts: 0,
    });

    if (isTest) {
      console.log(`[test-login] ${phone} → ${code} (requestId=${requestId})`);
    } else {
      console.log(`[dev-otp] ${phone} → ${code} (requestId=${requestId})`);
    }

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

    // Check attempt limit
    if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
      challenges.delete(requestId);
      throw new OtpError(
        'max_attempts_exceeded',
        'Maximum verification attempts exceeded. Please request a new OTP.',
      );
    }

    const ok = challenge.code === code;
    
    if (ok) {
      challenges.delete(requestId);
    } else {
      challenge.attempts += 1;
    }
    
    return ok;
  }
}
