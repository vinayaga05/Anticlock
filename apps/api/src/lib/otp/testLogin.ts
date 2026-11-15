/** Local test accounts are available only through an explicit development flag. */
export const TEST_LOGIN_ACCOUNTS = [
  '+919876543210', '+919876543211', '+919876543212', '+919876543213', '+919876543214',
  '+919876543215', '+919876543216', '+919876543217', '+919876543218', '+919876543219',
] as const;
export const TEST_LOGIN_OTP = '123456';
export function isTestLoginEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.OTP_TEST_LOGIN_ENABLED === 'true' && process.env.TEST_LOGIN_DISABLED !== 'true';
}
export function isTestAccount(phone: string): boolean {
  return isTestLoginEnabled() && TEST_LOGIN_ACCOUNTS.includes(phone as typeof TEST_LOGIN_ACCOUNTS[number]);
}
export function logTestLoginWarning(): void {
  if (isTestLoginEnabled()) console.warn('[otp] Explicit local test-number sign-in is enabled.');
}
