export type MobileUser = {
  handle?: string | null;
  needsUsername?: boolean;
  id: string;
  phone: string;
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  roles?: string[];
  providerId?: string | null;
};

export type AuthSession = {
  user: MobileUser;
  token: string;
  expiresAt: string;
};

export type ProfileUpdate = {
  handle?: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
};

export type OtpSendResult = {
  requestId: string;
  expiresInSeconds: number;
  expiresAt: string;
  resendAvailableAt: string;
};

export type OtpRequestOptions = {
  signal?: AbortSignal;
  isCurrentAttempt?: () => boolean;
};

export type OtpProvider = {
  sendOtp(phone: string, options?: OtpRequestOptions): Promise<OtpSendResult>;
  verifyOtp(
    phone: string,
    code: string,
    requestId: string,
    options?: OtpRequestOptions,
  ): Promise<AuthSession>;
};

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export function normalizePhone(raw: string): string {
  if (!/^\+?[\d\s()-]+$/.test(raw.trim())) {
    throw new AuthError('invalid_phone', 'Enter a valid Indian mobile number.');
  }
  const digits = raw.replace(/\D/g, '');
  const hasCountryCode = digits.length === 12 && digits.startsWith('91');
  const local = hasCountryCode ? digits.slice(2) : digits;
  if (
    /^[6-9]\d{9}$/.test(local) &&
    (!raw.trim().startsWith('+') || hasCountryCode)
  )
    return `+91${local}`;
  throw new AuthError(
    'invalid_phone',
    'Enter a valid 10-digit Indian mobile number.',
  );
}

export function isSessionExpired(expiresAt: string): boolean {
  return Date.parse(expiresAt) <= Date.now();
}

export function displayNameFromPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `User ${digits.slice(-4)}`;
}
