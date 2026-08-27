import { SignJWT, jwtVerify } from 'jose';
import type { Permission, Role } from '@anticlock/contracts';
import { ROLE_PERMISSIONS } from '@anticlock/contracts';

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'anticlock-dev-jwt-secret-change-me',
  );

export type AuthClaims = {
  sub: string;
  email: string;
  name: string;
  roles: Role[];
  permissions: Permission[];
  kind: 'admin' | 'mobile';
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
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, secret());
  return {
    sub: String(payload.sub),
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
    roles: (payload.roles as Role[]) ?? [],
    permissions: (payload.permissions as Permission[]) ?? [],
    kind: (payload.kind as 'admin' | 'mobile') ?? 'admin',
  };
}
