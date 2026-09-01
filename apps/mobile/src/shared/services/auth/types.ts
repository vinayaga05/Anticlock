export type MobileUser = {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl?: string | null;
  roles?: string[];
  providerId?: string | null;
};

export type AuthSession = {
  user: MobileUser;
  token: string;
  expiresAt: string;
};

export type OtpSendResult = {
  requestId: string;
  expiresInSeconds: number;
};

export type OtpProvider = {
  sendOtp(phone: string): Promise<OtpSendResult>;
  verifyOtp(phone: string, code: string, requestId: string): Promise<AuthSession>;
};

export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (raw.startsWith('+') && digits.length >= 10) return `+${digits}`;
  throw new AuthError('invalid_phone', 'Enter a valid mobile number');
}

export function isSessionExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

export function displayNameFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `User ${digits.slice(-4)}`;
}
