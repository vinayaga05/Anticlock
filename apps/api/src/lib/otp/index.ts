import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { Msg91OtpProvider } from './msg91Provider.js';
import type { OtpProvider } from './types.js';

export * from './types.js';

export function createOtpProvider(): OtpProvider {
  if (process.env.NODE_ENV !== 'production') {
    return new DevWhitelistOtpProvider();
  }
  // Future: return new Msg91OtpProvider() when MSG91_AUTH_KEY is set.
  return new Msg91OtpProvider();
}
