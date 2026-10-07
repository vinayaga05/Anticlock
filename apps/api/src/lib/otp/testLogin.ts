/**
 * ⚠️ TEMPORARY TEST LOGIN CONFIGURATION ⚠️
 * 
 * REMOVE BEFORE REAL LAUNCH / PRODUCTION DEPLOYMENT
 * 
 * This file provides hardcoded test accounts for production testing
 * without triggering real SMS/OTP provider calls.
 * 
 * ⚠️ SECURITY WARNING: These accounts bypass real phone verification.
 * Only use for internal testing. Disable via TEST_LOGIN_DISABLED=true
 * before public launch.
 */

/**
 * Test accounts that bypass SMS sending and accept a fixed OTP code.
 * All numbers are normalized to +91 format.
 */
export const TEST_LOGIN_ACCOUNTS = [
  '+919876543210',
  '+919876543211',
  '+919876543212',
  '+919876543213',
  '+919876543214',
  '+919876543215',
  '+919876543216',
  '+919876543217',
  '+919876543218',
  '+919876543219',
] as const;

/**
 * The OTP code that is valid for all test accounts.
 */
export const TEST_LOGIN_OTP = '123456';

/**
 * Check if test login is enabled.
 * Enabled by default, set TEST_LOGIN_DISABLED=true to disable.
 */
export function isTestLoginEnabled(): boolean {
  return process.env.TEST_LOGIN_DISABLED !== 'true';
}

/**
 * Check if a phone number is a test account.
 */
export function isTestAccount(normalizedPhone: string): boolean {
  if (!isTestLoginEnabled()) return false;
  return TEST_LOGIN_ACCOUNTS.includes(normalizedPhone as any);
}

/**
 * Log a warning if test login is enabled in production.
 * Call this at server startup.
 */
export function logTestLoginWarning(): void {
  if (process.env.NODE_ENV === 'production' && isTestLoginEnabled()) {
    console.warn('⚠️  WARNING: Test login accounts are ENABLED in production');
    console.warn('⚠️  Test accounts:', TEST_LOGIN_ACCOUNTS.join(', '));
    console.warn('⚠️  Set TEST_LOGIN_DISABLED=true to disable test login');
  }
}
