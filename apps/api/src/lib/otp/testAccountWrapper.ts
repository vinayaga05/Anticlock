import { isTestAccount, TEST_LOGIN_ACCOUNTS, isTestLoginEnabled } from './testLogin.js';
import { normalizePhone, type OtpContext, type OtpProvider, type OtpSendResult } from './types.js';
import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';

/** Optional explicit local test-number flow; never intercepted in production. */
export class TestAccountWrapperProvider implements OtpProvider {
  private readonly test = new DevWhitelistOtpProvider(TEST_LOGIN_ACCOUNTS, isTestLoginEnabled);
  constructor(private readonly delegate: OtpProvider) {}
  sendOtp(rawPhone: string, context?: OtpContext): Promise<OtpSendResult> {
    return (isTestAccount(normalizePhone(rawPhone)) ? this.test : this.delegate).sendOtp(rawPhone, context);
  }
  verifyOtp(rawPhone: string, code: string, requestId: string, context?: OtpContext): Promise<boolean> {
    return (isTestAccount(normalizePhone(rawPhone)) ? this.test : this.delegate).verifyOtp(rawPhone, code, requestId, context);
  }
}
