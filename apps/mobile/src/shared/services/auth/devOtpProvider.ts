import {
  AuthError,
  AuthSession,
  displayNameFromPhone,
  normalizePhone,
  OtpProvider,
  OtpSendResult,
} from './types';

const DEV_OTP_WHITELIST: Record<string, string> = {
  '+919999999999': '123456',
  '+918888888888': '123456',
};

type Challenge = {
  phone: string;
  code: string;
  expiresAt: number;
};

const challenges = new Map<string, Challenge>();

function randomRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const rand = (Math.random() * 16) | 0;
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mockUserId(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `00000000-0000-4000-8000-${digits.padStart(12, '0').slice(-12)}`;
}

/** Local OTP provider for the on-device whitelist when USE_PRODUCTION_ENVIRONMENT is false. */
export class DevOtpProvider implements OtpProvider {
  async sendOtp(rawPhone: string): Promise<OtpSendResult> {

    const phone = normalizePhone(rawPhone);
    if (!(phone in DEV_OTP_WHITELIST)) {
      throw new AuthError(
        'phone_not_allowed',
        'This number is not enabled for development login',
      );
    }

    const requestId = randomRequestId();
    challenges.set(requestId, {
      phone,
      code: DEV_OTP_WHITELIST[phone],
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    return { requestId, expiresInSeconds: 600 };
  }

  async verifyOtp(rawPhone: string, code: string, requestId: string): Promise<AuthSession> {
    const phone = normalizePhone(rawPhone);
    const challenge = challenges.get(requestId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new AuthError('invalid_otp', 'Invalid or expired OTP');
    }
    if (challenge.phone !== phone || challenge.code !== code) {
      throw new AuthError('invalid_otp', 'Invalid or expired OTP');
    }

    challenges.delete(requestId);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const userId = mockUserId(phone);

    return {
      user: {
        id: userId,
        phone,
        displayName: displayNameFromPhone(phone),
        avatarUrl: null,
      },
      token: `dev-${userId}`,
      expiresAt,
    };
  }
}
