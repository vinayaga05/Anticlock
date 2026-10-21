/**
 * True when the signed-in account still has a system placeholder name
 * (new OTP accounts get "User 1234"; guests and blank names count too).
 * Temporary in-app guests are excluded — they are not a persisted account.
 */
export function needsDisplayName(
  user: { id: string; displayName?: string | null } | null | undefined,
): boolean {
  if (!user || user.id === 'temporary-guest') return false;
  const name = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  if (name.length < 2) return true;
  if (/^guest$/i.test(name)) return true;
  if (/^user\s+\d{1,6}$/i.test(name)) return true;
  return false;
}
