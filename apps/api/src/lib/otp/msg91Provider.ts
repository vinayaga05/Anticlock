import { OtpError, type OtpProvider, type OtpSendResult } from './types.js';

/** Placeholder until MSG91 credentials are configured. */
export class Msg91OtpProvider implements OtpProvider {
  async sendOtp(_phone: string): Promise<OtpSendResult> {
    throw new OtpError(
      'otp_not_configured',
      'SMS OTP is not configured. Set MSG91 credentials to enable login.',
    );
  }

  async verifyOtp(_phone: string, _code: string, _requestId: string): Promise<boolean> {
    throw new OtpError(
      'otp_not_configured',
      'SMS OTP is not configured. Set MSG91 credentials to enable login.',
    );
  }
}
