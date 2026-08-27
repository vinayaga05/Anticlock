import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  AdminLoginRequestSchema,
  MobileTokenRequestSchema,
  type Role,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mobileDevices, userRoles, users } from '../db/schema.js';
import { signToken } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';

export const authRoutes = new Hono<AppEnv>();

authRoutes.post('/admin/login', async c => {
  const body = AdminLoginRequestSchema.parse(await c.req.json());
  const [user] = await db.select().from(users).where(eq(users.email, body.email));
  if (!user || !user.isActive) {
    return c.json(
      { error: { code: 'invalid_credentials', message: 'Invalid email or password' } },
      401,
    );
  }
  const ok = await bcrypt.compare(body.password, user.passwordHash);
  if (!ok) {
    return c.json(
      { error: { code: 'invalid_credentials', message: 'Invalid email or password' } },
      401,
    );
  }

  const roleRows = await db
    .select()
    .from(userRoles)
    .where(eq(userRoles.userId, user.id));
  const roles = roleRows.map(r => r.roleId as Role);

  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    roles,
    kind: 'admin',
  });

  await writeAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
  });

  const { ROLE_PERMISSIONS } = await import('@anticlock/contracts');
  const permissions = Array.from(
    new Set(roles.flatMap(r => ROLE_PERMISSIONS[r] ?? [])),
  );

  const maxAge = 7 * 24 * 60 * 60;
  c.header(
    'Set-Cookie',
    `anticlock_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`,
  );

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    },
    token,
  });
});

authRoutes.post('/admin/logout', requireAuth, async c => {
  const auth = c.get('auth');
  await writeAudit({
    actorId: auth.sub,
    actorEmail: auth.email,
    action: 'auth.logout',
    entityType: 'user',
    entityId: auth.sub,
  });
  c.header(
    'Set-Cookie',
    'anticlock_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  );
  return c.json({ ok: true });
});

authRoutes.get('/admin/me', requireAuth, async c => {
  const auth = c.get('auth');
  return c.json({
    user: {
      id: auth.sub,
      email: auth.email,
      name: auth.name,
      roles: auth.roles,
      permissions: auth.permissions,
    },
  });
});

authRoutes.post('/mobile/token', async c => {
  const body = MobileTokenRequestSchema.parse(await c.req.json());
  await db
    .insert(mobileDevices)
    .values({
      id: body.deviceId,
      displayName: body.displayName ?? 'Guest',
    })
    .onConflictDoUpdate({
      target: mobileDevices.id,
      set: { displayName: body.displayName ?? 'Guest' },
    });

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const token = await signToken(
    {
      sub: body.deviceId,
      email: '',
      name: body.displayName ?? 'Guest',
      roles: [],
      permissions: ['catalog.read', 'cms.read'],
      kind: 'mobile',
    },
    '30d',
  );

  return c.json({
    userId: body.deviceId,
    displayName: body.displayName ?? 'Guest',
    token,
    expiresAt,
  });
});
