import { createMiddleware } from 'hono/factory';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mobileUsers } from '../db/schema.js';
import { verifyToken } from '../lib/auth.js';
import { readSessionCookie, type AppEnv } from './auth.js';

/** Installed before all application routes, including public routes and deep-link targets. */
export const usernameSetupGate = createMiddleware<AppEnv>(async (c, next) => {
  // Setup and sign-in recovery must stay reachable for an incomplete account.
  if (/^\/auth\/mobile\/(otp\/(?:send|verify)|me|username(?:\/availability)?|logout|account)$/.test(c.req.path)) return next();
  const header = c.req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : readSessionCookie(c.req.header('cookie'));
  if (!token) return next(); // Anonymous preview and route-specific auth rules stay intact.
  let auth;
  try { auth = await verifyToken(token); }
  catch { return next(); } // Protected routes reject invalid sessions through requireAuth.
  if (auth.kind !== 'mobile') return next();
  try {
    const [user] = await db.select({ handle: mobileUsers.handle }).from(mobileUsers)
      .where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true))).limit(1);
    if (!user) return c.json({ error: { code: 'unauthorized', message: 'Invalid session' } }, 401);
    if (!user.handle) return c.json({ error: { code: 'USERNAME_REQUIRED', message: 'Choose a username to finish signup.' } }, 403);
  } catch {
    // A database outage is retryable and must not clear a valid stored login.
    return c.json({ error: { code: 'setup_unavailable', message: 'Could not verify account setup. Please try again.' } }, 503);
  }
  return next();
});
