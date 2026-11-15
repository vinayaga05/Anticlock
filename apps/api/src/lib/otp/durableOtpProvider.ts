import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { normalizePhone, OtpError, type OtpContext, type OtpProvider, type OtpSendResult } from './types.js';
import { PostgresOtpStore, type OtpLimit, type OtpStore, type StoredOtpError } from './postgresOtpStore.js';

export type OtpDelivery = { send(input: { phone: string; code: string; requestId: string; expiresInSeconds: number }): Promise<void> };
export type OtpEvent = { event: 'sent' | 'verified' | 'failed' | 'expired' | 'blocked'; requestId?: string; reason?: string; delivery?: 'accepted' };
type Options = { store?: OtpStore; delivery: OtpDelivery; clock?: () => number; randomCode?: () => string; pepper?: string; event?: (event: OtpEvent) => void };
const TTL = 300_000;

export class DurableOtpProvider implements OtpProvider {
  private readonly store: OtpStore;
  private readonly now: () => number;
  private readonly code: () => string;
  private readonly pepper: string;
  private readonly event: (event: OtpEvent) => void;
  constructor(private readonly options: Options) {
    this.store = options.store ?? new PostgresOtpStore(); this.now = options.clock ?? Date.now;
    this.code = options.randomCode ?? (() => randomInt(0, 1_000_000).toString().padStart(6, '0'));
    this.pepper = options.pepper ?? process.env.OTP_HASH_SECRET?.trim() ?? '';
    this.event = options.event ?? (event => console.info('[otp]', JSON.stringify(event)));
  }
  private hash(value: string) { return createHmac('sha256', this.pepper).update(value).digest('hex'); }
  private assertConfigured() { if (this.pepper.length < 32) throw new OtpError('otp_not_configured', 'SMS sign-in is not configured. Please contact support.'); }
  private fail(error: StoredOtpError, requestId?: string): never {
    this.event({ event: ['otp_expired'].includes(error.code) ? 'expired' : ['otp_locked', 'resend_cooldown', 'rate_limit_exceeded'].includes(error.code) ? 'blocked' : 'failed', requestId, reason: error.code });
    throw new OtpError(error.code, error.message, error.retryAfterSeconds);
  }
  private limits(action: 'send' | 'verify', phone: string, context: OtpContext, now: number): OtpLimit[] {
    const rules: [string, string | undefined, number, number][] = action === 'send'
      ? [['phone-resends', phone, 600_000, 4], ['phone-hour', phone, 3_600_000, 5], ['phone-day', phone, 86_400_000, 10], ['device-hour', context.deviceId ?? 'unknown', 3_600_000, 10], ['device-day', context.deviceId ?? 'unknown', 86_400_000, 30], ['ip-hour', context.ip ?? 'unknown', 3_600_000, 30], ['ip-day', context.ip ?? 'unknown', 86_400_000, 100]]
      : [['phone-verify', phone, 900_000, 20], ['device-verify', context.deviceId ?? 'unknown', 900_000, 50], ['ip-verify', context.ip ?? 'unknown', 900_000, 100]];
    return rules.map(([name, identity, period, limit]) => ({ id: this.hash(`${action}:${name}:${identity}:${Math.floor(now / period)}`), scope: name.startsWith('phone') ? 'phone' : 'shared', limit, resetAt: (Math.floor(now / period) + 1) * period }));
  }
  async sendOtp(rawPhone: string, context: OtpContext = {}): Promise<OtpSendResult> {
    this.assertConfigured(); const phone = normalizePhone(rawPhone); const now = this.now(); const requestId = randomUUID(); const code = this.code();
    if (!/^\d{6}$/.test(code)) throw new Error('Invalid OTP generator configuration');
    const phoneHash = this.hash(`phone:${phone}`);
    const error = await this.store.reserve({ id: requestId, phoneHash, codeHash: this.hash(`code:${phone}:${requestId}:${code}`), deviceHash: context.deviceId ? this.hash(`device:${context.deviceId}`) : null, now, expiresAt: now + TTL, limits: this.limits('send', phone, context, now) });
    if (error) this.fail(error, requestId);
    try {
      await this.options.delivery.send({ phone, code, requestId, expiresInSeconds: TTL / 1000 });
      if (!await this.store.activate(requestId, phoneHash)) throw new OtpError('otp_replaced', 'A newer code was requested. Please use the latest request.');
    } catch (error) {
      await this.store.fail(requestId, phoneHash);
      this.event({ event: 'failed', requestId, reason: error instanceof OtpError ? error.code : 'sms_send_failed' });
      if (error instanceof OtpError) throw error;
      throw new OtpError('sms_send_failed', 'Unable to send the code. Please try again later.');
    }
    this.event({ event: 'sent', requestId, delivery: 'accepted' });
    return { requestId, expiresInSeconds: TTL / 1000, expiresAt: new Date(now + TTL).toISOString(), resendAvailableAt: new Date(now + 60_000).toISOString() };
  }
  async verifyOtp(rawPhone: string, code: string, requestId: string, context: OtpContext = {}): Promise<boolean> {
    this.assertConfigured(); const phone = normalizePhone(rawPhone);
    if (!/^\d{6}$/.test(code) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) return false;
    const now = this.now(); const result = await this.store.verify({ id: requestId, phoneHash: this.hash(`phone:${phone}`), codeHash: this.hash(`code:${phone}:${requestId}:${code}`), deviceHash: context.deviceId ? this.hash(`device:${context.deviceId}`) : null, now, limits: this.limits('verify', phone, context, now) });
    if (result.error) this.fail(result.error, requestId);
    this.event({ event: result.valid ? 'verified' : 'failed', requestId, ...(result.valid ? {} : { reason: 'invalid_otp' }) });
    return result.valid;
  }
}
