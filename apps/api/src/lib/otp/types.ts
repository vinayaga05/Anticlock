export type OtpSendResult = {
  requestId: string;
  expiresInSeconds: number;
};

export type OtpProvider = {
  sendOtp(phone: string): Promise<OtpSendResult>;
  verifyOtp(phone: string, code: string, requestId: string): Promise<boolean>;
};

export class OtpError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OtpError';
  }
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new OtpError('invalid_phone', 'Enter a valid mobile number');
}
