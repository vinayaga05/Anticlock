import { createMiddleware } from 'hono/factory';
import type { Permission } from '@anticlock/contracts';
import { verifyToken, type AuthClaims } from '../lib/auth.js';

export type AppEnv = {
  Variables: {
    auth: AuthClaims;
  };
};

function readSessionCookie(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(';')
    .map(p => p.trim())
    .find(p => p.startsWith('anticlock_session='));
  return match ? decodeURIComponent(match.slice('anticlock_session='.length)) : null;
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header('authorization');
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearer ?? readSessionCookie(c.req.header('cookie'));
  if (!token) {
    return c.json({ error: { code: 'unauthorized', message: 'Missing token' } }, 401);
  }
  try {
    const claims = await verifyToken(token);
    c.set('auth', claims);
    await next();
  } catch {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid token' } }, 401);
  }
});

export function requirePermission(...needed: Permission[]) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return c.json({ error: { code: 'unauthorized', message: 'Missing auth' } }, 401);
    }
    const ok = needed.every(p => auth.permissions.includes(p));
    if (!ok) {
      return c.json(
        { error: { code: 'forbidden', message: 'Insufficient permissions' } },
        403,
      );
    }
    await next();
  });
}
