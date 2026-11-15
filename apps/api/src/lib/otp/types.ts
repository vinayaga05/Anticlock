export type OtpSendResult = {
  requestId: string;
  expiresInSeconds: number;
  expiresAt: string;
  resendAvailableAt: string;
};

export type OtpContext = { ip?: string; deviceId?: string };

export type OtpProvider = {
  sendOtp(phone: string, context?: OtpContext): Promise<OtpSendResult>;
  verifyOtp(phone: string, code: string, requestId: string, context?: OtpContext): Promise<boolean>;
};

export class OtpError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'OtpError';
  }
}

export function normalizePhone(raw: string): string {
  if (typeof raw !== 'string' || !/^[+\d\s()-]+$/.test(raw.trim())) throw new OtpError('invalid_phone', 'Enter a valid Indian mobile number.');
  const input = raw.trim().replace(/[\s()-]/g, '');
  const canonical = /^[6-9]\d{9}$/.test(input) ? `+91${input}` : /^91[6-9]\d{9}$/.test(input) ? `+${input}` : input;
  if (/^\+91[6-9]\d{9}$/.test(canonical)) return canonical;
  throw new OtpError('invalid_phone', 'Enter a valid Indian mobile number.');
}
