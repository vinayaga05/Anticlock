import type { AuthClaims } from '../lib/auth.js';
import type { Permission } from '@anticlock/contracts';

/** Mint the same identity claims as a successful production OTP verification.
 * Imports are deferred until after each integration file selects its disposable database.
 * Tests for forged or guest claims deliberately import the real signer instead.
 */
export async function signToken(
  claims: Omit<AuthClaims, 'permissions'> & { permissions?: Permission[] },
  expiresIn = '7d',
) {
  const { signToken: sign } = await import('../lib/auth.js');
  if (claims.kind !== 'mobile') return sign(claims, expiresIn);
  const { db } = await import('../db/client.js');
  const { mobileUsers } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');
  const [account] = await db.select({ phone: mobileUsers.phone }).from(mobileUsers)
    .where(eq(mobileUsers.id, claims.sub)).limit(1);
  return sign({ ...claims, email: account?.phone ?? claims.email }, expiresIn);
}
