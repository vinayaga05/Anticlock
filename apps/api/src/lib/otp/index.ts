import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { Msg91OtpProvider } from './msg91Provider.js';
import { TestAccountWrapperProvider } from './testAccountWrapper.js';
import type { OtpProvider } from './types.js';

export * from './types.js';
export * from './testLogin.js';

export function createOtpProvider(): OtpProvider {
  // First, select the base provider based on environment
  let baseProvider: OtpProvider;
  
  const devWhitelist =
    process.env.OTP_DEV_WHITELIST === 'true' ||
    process.env.NODE_ENV !== 'production';
  
  if (devWhitelist) {
    // Dev/staging: use whitelist provider (+919999999999, +918888888888)
    baseProvider = new DevWhitelistOtpProvider();
  } else {
    // Production: use MSG91 provider (when configured)
    // Future: return new Msg91OtpProvider() when MSG91_AUTH_KEY is set.
    baseProvider = new Msg91OtpProvider();
  }

  // Wrap the base provider to handle test login accounts (testLogin.ts)
  // Test accounts work in all environments (enabled by default, disable via TEST_LOGIN_DISABLED=true)
  return new TestAccountWrapperProvider(baseProvider);
}
