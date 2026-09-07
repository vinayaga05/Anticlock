import { apiRequest } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { DevOtpProvider } from './devOtpProvider';
import {
  AuthError,
  AuthSession,
  OtpProvider,
  OtpSendResult,
} from './types';

/** Calls Hono `/auth/mobile/otp/*` endpoints. */
export class ApiOtpProvider implements OtpProvider {
  async sendOtp(phone: string): Promise<OtpSendResult> {
    if (!isApiEnabled) {
      throw new AuthError('api_disabled', 'API is not configured');
    }
    return apiRequest<OtpSendResult>('/auth/mobile/otp/send', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyOtp(phone: string, code: string, requestId: string): Promise<AuthSession> {
    if (!isApiEnabled) {
      throw new AuthError('api_disabled', 'API is not configured');
    }
    return apiRequest<AuthSession>('/auth/mobile/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, code, requestId }),
    });
  }
}

export function createOtpProvider(): OtpProvider {
  // Genie and other authenticated API routes need a real JWT from the server.
  // On-device whitelist tokens (`dev-…`) only work for offline / API-disabled previews.
  if (isApiEnabled) return new ApiOtpProvider();
  return new DevOtpProvider();
}
