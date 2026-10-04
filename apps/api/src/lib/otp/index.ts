import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { Msg91OtpProvider } from './msg91Provider.js';
import type { OtpProvider } from './types.js';

export * from './types.js';
export * from './testLogin.js';

export function createOtpProvider(): OtpProvider {
  // TODO: When MSG91_AUTH_KEY is configured, return new Msg91OtpProvider()
  // For now, use DevWhitelistOtpProvider which handles:
  // - Dev whitelist numbers (+919999999999, +918888888888) in non-production
  // - Test login accounts (see testLogin.ts) in all environments
  return new DevWhitelistOtpProvider();
}
