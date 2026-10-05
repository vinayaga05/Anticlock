import { randomUUID } from 'node:crypto';
import { isTestAccount, TEST_LOGIN_OTP } from './testLogin.js';
import { normalizePhone, type OtpProvider, type OtpSendResult } from './types.js';

type TestChallenge = {
  phone: string;
  expiresAt: number;
};

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const testChallenges = new Map<string, TestChallenge>();

/**
 * Wrapper that intercepts test login accounts and delegates all other
 * numbers to the underlying OTP provider (DevWhitelist or MSG91).
 * 
 * Test accounts:
 * - Skip SMS sending
 * - Accept fixed OTP (123456)
 * - No rate limiting
 * - No attempt limits (generous for repeated testing)
 */
export class TestAccountWrapperProvider implements OtpProvider {
  constructor(private readonly delegate: OtpProvider) {}

  async sendOtp(rawPhone: string): Promise<OtpSendResult> {
    const phone = normalizePhone(rawPhone);

    // Handle test accounts directly (no SMS, no rate limiting)
    if (isTestAccount(phone)) {
      const requestId = randomUUID();
      testChallenges.set(requestId, {
        phone,
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
      });
      console.log(`[test-login] ${phone} → ${TEST_LOGIN_OTP} (requestId=${requestId})`);
      return { requestId, expiresInSeconds: CHALLENGE_TTL_MS / 1000 };
    }

    // Delegate all other numbers to the underlying provider (with rate limiting)
    return this.delegate.sendOtp(rawPhone);
  }

  async verifyOtp(rawPhone: string, code: string, requestId: string): Promise<boolean> {
    const phone = normalizePhone(rawPhone);

    // Handle test accounts directly (no attempt limits)
    if (isTestAccount(phone)) {
      const challenge = testChallenges.get(requestId);
      if (!challenge) return false;
      if (challenge.expiresAt < Date.now()) {
        testChallenges.delete(requestId);
        return false;
      }
      if (challenge.phone !== phone) return false;

      const ok = code === TEST_LOGIN_OTP;
      if (ok) testChallenges.delete(requestId);
      return ok;
    }

    // Delegate all other numbers to the underlying provider (with attempt limits)
    return this.delegate.verifyOtp(rawPhone, code, requestId);
  }
}
