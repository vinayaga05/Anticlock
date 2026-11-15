import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { TestAccountWrapperProvider } from './testAccountWrapper.js';
import { isTestLoginEnabled } from './testLogin.js';
import { DurableOtpProvider } from './durableOtpProvider.js';
import { BulkBlasterDelivery, isBulkBlasterConfigured } from './bulkBlasterDelivery.js';
import type { OtpProvider } from './types.js';

export * from './types.js';
export * from './testLogin.js';
export { DurableOtpProvider } from './durableOtpProvider.js';
export { PostgresOtpStore } from './postgresOtpStore.js';

export function assertProductionOtpConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.OTP_DEV_WHITELIST === 'true' || process.env.OTP_TEST_LOGIN_ENABLED === 'true' || process.env.TEST_LOGIN_DISABLED === 'false') {
    throw new Error('Development OTP and test accounts are forbidden in production');
  }
  if (process.env.SMS_PROVIDER !== 'bulkblaster' || !isBulkBlasterConfigured() || (process.env.OTP_HASH_SECRET?.trim().length ?? 0) < 32) {
    throw new Error('Production OTP requires BulkBlaster API key, approved brand/sender and OTP_HASH_SECRET (at least 32 characters)');
  }
}

export function createOtpProvider(): OtpProvider {
  // Production never activates a static fallback, even for known test numbers.
  let provider: OtpProvider = new DurableOtpProvider({ delivery: new BulkBlasterDelivery() });
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.OTP_DEV_WHITELIST === 'true') provider = new DevWhitelistOtpProvider();
    if (isTestLoginEnabled()) provider = new TestAccountWrapperProvider(provider);
  }
  return provider;
}
