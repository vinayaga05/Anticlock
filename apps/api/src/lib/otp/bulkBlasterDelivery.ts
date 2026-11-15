import { OtpError, normalizePhone } from './types.js';
import type { OtpDelivery } from './durableOtpProvider.js';

export const BULKBLASTER_OTP_URL = 'https://bulkblaster-biotp-api-290441563653.asia-south1.run.app/send-otp';
type Config = { apiKey: string; brandName: string; senderType: string };
export function bulkBlasterConfig(): Config {
  return { apiKey: process.env.BULKBLASTER_API_KEY?.trim() ?? '', brandName: process.env.BULKBLASTER_BRAND_NAME?.trim() ?? 'Anticlock', senderType: process.env.BULKBLASTER_SENDER_TYPE?.trim() ?? 'DASSAM' };
}
export function isBulkBlasterConfigured(config = bulkBlasterConfig()): boolean {
  return !!config.apiKey && config.brandName.length > 0 && config.brandName.length <= 50 && /^[A-Za-z0-9 &.'-]+$/.test(config.brandName) && ['DASSAM', 'GUERAR', 'FYDBZR'].includes(config.senderType);
}

/** Server-only delivery: authentication and single-use verification stay local. */
export class BulkBlasterDelivery implements OtpDelivery {
  constructor(private readonly options: { config?: Config; fetch?: typeof fetch; timeoutMs?: number } = {}) {}
  async send(input: { phone: string; code: string; requestId: string; expiresInSeconds: number }): Promise<void> {
    const config = this.options.config ?? bulkBlasterConfig();
    if (!isBulkBlasterConfigured(config)) throw new OtpError('otp_not_configured', 'SMS sign-in is not configured. Please contact support.');
    const phone = normalizePhone(input.phone).slice(3);
    if (!/^\d{6}$/.test(input.code)) throw new OtpError('sms_send_failed', 'Unable to send the code. Please try again later.');
    const controller = new AbortController(); let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          const response = await (this.options.fetch ?? fetch)(BULKBLASTER_OTP_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, signal: controller.signal,
            body: JSON.stringify({ apiKey: config.apiKey, phone, otp: input.code, brandName: config.brandName, senderType: config.senderType }),
          });
          const body = await response.json().catch(() => ({})) as { success?: unknown };
          if (!response.ok || body.success !== true) {
            // Provider responses can contain account/phone/message data. Do not
            // forward or log them, even when the gateway returns an error.
            const code = response.status === 429 ? 'sms_rate_limited' : response.status === 400 ? 'sms_delivery_rejected' : response.status === 401 || response.status === 403 ? 'sms_unavailable' : 'sms_send_failed';
            throw new OtpError(code, response.status === 429 ? 'The SMS provider is busy. Please try again later.' : 'Unable to send the code. Please try again later.', response.status === 429 ? 60 : undefined);
          }
        })(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => { controller.abort(); reject(new OtpError('sms_timeout', 'The SMS request timed out. Please wait before requesting a new code.', 60)); }, this.options.timeoutMs ?? 15_000);
        }),
      ]);
    } catch (error) {
      if (error instanceof OtpError) throw error;
      throw new OtpError('sms_send_failed', 'Unable to reach the SMS provider. Please try again later.');
    } finally { if (timeout) clearTimeout(timeout); }
  }
}
