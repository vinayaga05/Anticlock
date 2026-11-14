import { SignJWT, jwtVerify } from 'jose';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import type { Permission, Role } from '@anticlock/contracts';
import { ROLE_PERMISSIONS } from '@anticlock/contracts';

const secret = () => {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }
  return new TextEncoder().encode('anticlock-dev-jwt-secret-change-me');
};

export type AuthClaims = {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  permissions: Permission[];
  kind: 'admin' | 'mobile';
  mobileRoles?: string[];
  providerId?: string | null;
};

export async function signToken(
  claims: Omit<AuthClaims, 'permissions'> & { permissions?: Permission[] },
  expiresIn = '7d',
) {
  const permissions =
    claims.permissions ??
    Array.from(
      new Set(claims.roles.flatMap(r => ROLE_PERMISSIONS[r] ?? [])),
    );

  return new SignJWT({
    email: claims.email,
    name: claims.name,
    roles: claims.roles,
    permissions,
    kind: claims.kind,
    mobileRoles: claims.mobileRoles ?? [],
    providerId: claims.providerId ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

/** Match PostgreSQL UUID aliases before treating any signed mobile subject as a guest. */
export function mobileAccountIdForSubject(value: string): string | undefined {
  const hex = value.trim().replace(/[{}-]/g, '');
  if (!/^[0-9a-f]{32}$/i.test(hex)) return undefined;
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`.toLowerCase();
}

export async function verifyToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, secret());
  // Legacy production JWTs have no sid. Account closure revokes them through
  // the retained mobile-user inactive flag, without changing OTP delivery.
  let sub = String(payload.sub);
  const accountId = mobileAccountIdForSubject(sub);
  if (payload.kind === 'mobile' && accountId) {
    const [account] = await db.select({ isActive: mobileUsers.isActive, phone: mobileUsers.phone }).from(mobileUsers).where(eq(mobileUsers.id, accountId)).limit(1);
    if (account && (account.isActive !== true || typeof account.phone !== 'string' || payload.email !== account.phone)) throw new Error('Mobile account session is invalid');
    if (account) sub = accountId;
  }
  return {
    sub,
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
    roles: (payload.roles as Role[]) ?? [],
    permissions: (payload.permissions as Permission[]) ?? [],
    kind: (payload.kind as 'admin' | 'mobile') ?? 'admin',
    mobileRoles: (payload.mobileRoles as string[]) ?? [],
    providerId: (payload.providerId as string | null | undefined) ?? null,
  };
}
