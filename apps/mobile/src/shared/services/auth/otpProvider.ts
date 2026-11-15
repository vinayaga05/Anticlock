import { apiRequest, getApiToken } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { getOtpInstallationId } from './otpInstallation';
import {
  AuthError,
  type AuthSession,
  normalizePhone,
  type OtpProvider,
  type OtpRequestOptions,
  type OtpSendResult,
} from './types';

const OTP_TIMEOUT_MS = 25_000;

/** Calls the existing backend; no code or authenticated session is created on-device. */
export class ApiOtpProvider implements OtpProvider {
  private async request<T>(
    path: string,
    body: object,
    options?: OtpRequestOptions,
  ): Promise<T> {
    if (!isApiEnabled)
      throw new AuthError(
        'api_disabled',
        'Sign-in is temporarily unavailable.',
      );
    const token = getApiToken();
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectCancellation: ((error: Error) => void) | undefined;
    const cancelled = () => {
      controller.abort();
      rejectCancellation?.(
        new AuthError(
          'otp_cancelled',
          'This sign-in attempt is no longer active.',
        ),
      );
    };
    const ensureCurrent = () => {
      if (
        options?.signal?.aborted ||
        options?.isCurrentAttempt?.() === false ||
        getApiToken() !== token
      ) {
        throw new AuthError(
          'otp_cancelled',
          'This sign-in attempt is no longer active.',
        );
      }
    };
    ensureCurrent();
    options?.signal?.addEventListener('abort', cancelled, { once: true });
    try {
      const response = await Promise.race([
        apiRequest<T>(path, {
          method: 'POST',
          body: JSON.stringify(body),
          signal: controller.signal,
        }),
        new Promise<never>((_, reject) => {
          rejectCancellation = reject;
          // This bounds receiving headers AND parsing the response body.
          timer = setTimeout(() => {
            controller.abort();
            reject(
              new AuthError(
                'request_timeout',
                'The request timed out. Wait a minute before requesting another code.',
              ),
            );
          }, OTP_TIMEOUT_MS);
        }),
      ]);
      ensureCurrent();
      return response;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      options?.signal?.removeEventListener('abort', cancelled);
    }
  }

  async sendOtp(
    rawPhone: string,
    options?: OtpRequestOptions,
  ): Promise<OtpSendResult> {
    const phone = normalizePhone(rawPhone);
    const result = await this.request<OtpSendResult>(
      '/auth/mobile/otp/send',
      { phone, deviceId: getOtpInstallationId() },
      options,
    );
    if (
      !result ||
      typeof result !== 'object' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        result.requestId,
      ) ||
      !Number.isFinite(Date.parse(result.expiresAt)) ||
      !Number.isFinite(Date.parse(result.resendAvailableAt)) ||
      !Number.isFinite(result.expiresInSeconds) ||
      !(result.expiresInSeconds > 0 && result.expiresInSeconds <= 300)
    ) {
      throw new AuthError(
        'invalid_response',
        'The code request could not be confirmed. Wait a minute and try again.',
      );
    }
    return result;
  }

  async verifyOtp(
    rawPhone: string,
    code: string,
    requestId: string,
    options?: OtpRequestOptions,
  ): Promise<AuthSession> {
    const phone = normalizePhone(rawPhone);
    if (!/^\d{6}$/.test(code))
      throw new AuthError('invalid_otp', 'Enter the six-digit code.');
    const result = await this.request<AuthSession>(
      '/auth/mobile/otp/verify',
      { phone, code, requestId, deviceId: getOtpInstallationId() },
      options,
    );
    if (
      !result ||
      typeof result !== 'object' ||
      typeof result.user?.id !== 'string' ||
      !result.user.id ||
      result.user.phone !== phone ||
      typeof result.token !== 'string' ||
      !result.token ||
      !Number.isFinite(Date.parse(result.expiresAt))
    ) {
      throw new AuthError(
        'invalid_response',
        'Sign-in could not be confirmed. Please try again.',
      );
    }
    return result;
  }
}

export function createOtpProvider(): OtpProvider {
  return new ApiOtpProvider();
}
