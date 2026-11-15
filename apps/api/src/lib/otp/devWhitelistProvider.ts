import { randomUUID } from 'node:crypto';
import { OtpError, type OtpContext, type OtpProvider, type OtpSendResult, normalizePhone } from './types.js';

/** Explicit local-only test numbers. This class refuses all production calls. */
export class DevWhitelistOtpProvider implements OtpProvider {
  private challenges = new Map<string, { phone: string; expiresAt: number; attempts: number }>();
  private latest = new Map<string, string>();
  constructor(
    private readonly allowedPhones: readonly string[] = ['+919999999999', '+918888888888'],
    private readonly enabled: () => boolean = () => process.env.OTP_DEV_WHITELIST === 'true',
    private readonly clock: () => number = Date.now,
  ) {}
  private assertEnabled() {
    if (process.env.NODE_ENV === 'production' || !this.enabled()) throw new OtpError('phone_not_allowed', 'Development sign-in is not enabled.');
  }
  async sendOtp(rawPhone: string, _context?: OtpContext): Promise<OtpSendResult> {
    this.assertEnabled(); const phone = normalizePhone(rawPhone);
    if (!this.allowedPhones.includes(phone)) throw new OtpError('phone_not_allowed', 'This number is not enabled for development login');
    const now = this.clock(); const previousId = this.latest.get(phone); const previous = previousId ? this.challenges.get(previousId) : undefined;
    if (previous && previous.expiresAt - 300_000 + 60_000 > now) throw new OtpError('resend_cooldown', 'Please wait before requesting another code.', Math.ceil((previous.expiresAt - 240_000 - now) / 1000));
    if (previousId) this.challenges.delete(previousId);
    const requestId = randomUUID(); this.latest.set(phone, requestId); this.challenges.set(requestId, { phone, expiresAt: now + 300_000, attempts: 0 });
    return { requestId, expiresInSeconds: 300, expiresAt: new Date(now + 300_000).toISOString(), resendAvailableAt: new Date(now + 60_000).toISOString() };
  }
  async verifyOtp(rawPhone: string, code: string, requestId: string, _context?: OtpContext): Promise<boolean> {
    this.assertEnabled(); const phone = normalizePhone(rawPhone); const challenge = this.challenges.get(requestId);
    if (!challenge || challenge.phone !== phone) return false;
    if (challenge.expiresAt <= this.clock()) { this.challenges.delete(requestId); return false; }
    if (challenge.attempts >= 5) throw new OtpError('max_attempts_exceeded', 'Too many incorrect codes. Request another code later.');
    challenge.attempts += 1;
    if (code !== '123456') return false;
    this.challenges.delete(requestId); return true;
  }
}
