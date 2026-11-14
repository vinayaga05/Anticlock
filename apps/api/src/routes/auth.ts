import { Hono, type Context } from 'hono';
import { and, eq } from 'drizzle-orm';
import { bodyLimit } from 'hono/body-limit';
import bcrypt from 'bcryptjs';
import {
  AdminLoginRequestSchema,
  MobileOtpSendRequestSchema,
  MobileOtpVerifyRequestSchema,
  UpdateMobileProfileRequestSchema,
  type Role,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mobileUsers, userRoles, users } from '../db/schema.js';
import { signToken } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { createOtpProvider, normalizePhone, OtpError, type OtpProvider, type OtpContext } from '../lib/otp/index.js';
import { getConnInfo } from '@hono/node-server/conninfo';
import { isIP } from 'node:net';
import { createMobileSession, revokeMobileSession } from '../lib/mobileSessions.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { getMobileUserContext } from '../lib/mobileUserContext.js';
import { ApiError, httpError } from '../lib/httpError.js';
import { mediaService } from '../media/MediaService.js';
import { MAX_AVATAR_BYTES } from '../media/validateAvatarUpload.js';

export function createAuthRoutes(options: { otpProvider?: OtpProvider } = {}) {
const authRoutes = new Hono<AppEnv>();
const otpProvider = options.otpProvider ?? createOtpProvider();
const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';

function displayNameFromPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const local = digits.slice(-4);
  return `User ${local}`;
}

async function issueMobileSession(user: typeof mobileUsers.$inferSelect, context: OtpContext) {
  const { roles, providerId } = await getMobileUserContext(user.id);
  const { id: sid, expiresAt } = await createMobileSession(user.id, context);
  const token = await signToken(
    {
      sub: user.id,
      email: user.phone,
      name: user.displayName,
      roles: [],
      permissions: ['catalog.read', 'cms.read'],
      kind: 'mobile',
      mobileRoles: roles,
      providerId,
      sid,
    },
    '30d',
  );

  return {
    user: {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      roles,
      providerId,
    },
    token,
    expiresAt,
  };
}

/**
 * Emergency admin upsert when the panel password is out of sync with
 * `.env.production`. Requires the live `JWT_SECRET` as `recoverSecret`.
 * Disable after use by omitting the secret from clients; the route stays
 * gated by that shared secret.
 */
authRoutes.post('/admin/recover', async c => {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 16) {
    return c.json(
      { error: { code: 'unavailable', message: 'Recover is not configured' } },
      503,
    );
  }

  let body: {
    recoverSecret?: string;
    email?: string;
    password?: string;
  };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid JSON body' } },
      400,
    );
  }

  const provided =
    c.req.header('x-admin-recover')?.trim() || body.recoverSecret?.trim();
  if (!provided || provided !== jwtSecret) {
    return c.json(
      { error: { code: 'unauthorized', message: 'Invalid recover secret' } },
      401,
    );
  }

  const email = (
    body.email?.trim() ||
    process.env.INITIAL_ADMIN_EMAIL?.trim() ||
    ''
  ).toLowerCase();
  const password =
    body.password || process.env.INITIAL_ADMIN_PASSWORD || '';
  if (!email || !password || password.length < 8) {
    return c.json(
      {
        error: {
          code: 'validation_error',
          message: 'email and password (min 8 chars) are required',
        },
      },
      400,
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  let userId = existing?.id;
  if (existing) {
    await db
      .update(users)
      .set({
        passwordHash,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        name: 'Knock Admin',
        passwordHash,
      })
      .returning();
    userId = created!.id;
  }

  await db
    .insert(userRoles)
    .values({ userId: userId!, roleId: 'super_admin' })
    .onConflictDoNothing();

  await writeAudit({
    actorId: userId!,
    actorEmail: email,
    action: 'auth.admin_recover',
    entityType: 'user',
    entityId: userId!,
  });

  return c.json({ ok: true, email });
});

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
    `anticlock_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secureCookie}; Max-Age=${maxAge}`,
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
    `anticlock_session=; Path=/; HttpOnly; SameSite=Lax${secureCookie}; Max-Age=0`,
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

authRoutes.post('/mobile/token', c => {
  // A caller-selected device ID must never become a verified user identity.
  return c.json({ error: { code: 'otp_required', message: 'Sign in with your mobile number to create a session.' } }, 410);
});

function otpContext(c: Context<AppEnv>, deviceId?: string): OtpContext {
  let ip: string | undefined;
  try { ip = getConnInfo(c).remote.address; } catch { /* no socket in in-process tests */ }
  if (process.env.OTP_TRUST_PROXY === 'true') {
    // The production API is private behind Traefik. Use its appended address,
    // never the caller-controlled first entry in a forwarded chain.
    const forwarded = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim();
    if (forwarded && isIP(forwarded)) ip = forwarded;
  }
  return { ip: ip && isIP(ip) ? ip : undefined, deviceId };
}

function otpErrorResponse(c: Context<AppEnv>, error: unknown) {
  if (!(error instanceof OtpError)) throw error;
  const status = ['rate_limit_exceeded', 'max_attempts_exceeded', 'otp_locked', 'resend_cooldown'].includes(error.code) ? 429
    : ['invalid_phone', 'invalid_otp', 'otp_expired', 'otp_invalid', 'otp_used'].includes(error.code) ? 400
    : error.code === 'phone_not_allowed' ? 403
    : 503;
  const retryAfterSeconds = error.retryAfterSeconds;
  if (retryAfterSeconds) c.header('Retry-After', String(retryAfterSeconds));
  return c.json({ error: { code: error.code, message: error.message, ...(retryAfterSeconds ? { retryAfterSeconds } : {}) } }, status);
}

authRoutes.post('/mobile/otp/send', async c => {
  const body = MobileOtpSendRequestSchema.parse(await c.req.json());
  try {
    const result = await otpProvider.sendOtp(body.phone, otpContext(c, body.deviceId));
    return c.json(result);
  } catch (err) {
    return otpErrorResponse(c, err);
  }
});

authRoutes.post('/mobile/otp/verify', async c => {
  const body = MobileOtpVerifyRequestSchema.parse(await c.req.json());
  try {
    const context = otpContext(c, body.deviceId);
    const ok = await otpProvider.verifyOtp(body.phone, body.code, body.requestId, context);
    if (!ok) {
      return c.json(
        { error: { code: 'invalid_otp', message: 'Invalid or expired OTP' } },
        400,
      );
    }

    const normalized = normalizePhone(body.phone);

    let [user] = await db
        .insert(mobileUsers)
        .values({
          phone: normalized,
          displayName: displayNameFromPhone(normalized),
        })
        .onConflictDoNothing({ target: mobileUsers.phone })
        .returning();
    if (!user) [user] = await db.select().from(mobileUsers).where(eq(mobileUsers.phone, normalized));
    if (!user || !user.isActive) {
      return c.json(
        { error: { code: 'account_disabled', message: 'This account is disabled' } },
        403,
      );
    }

    const session = await issueMobileSession(user, context);

    await writeAudit({
      actorId: user.id,
      actorEmail: user.phone,
      action: 'auth.mobile_login',
      entityType: 'mobile_user',
      entityId: user.id,
    });

    return c.json(session);
  } catch (err) {
    return otpErrorResponse(c, err);
  }
});

authRoutes.get('/mobile/me', requireAuth, async c => {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
  }

  const [user] = await db.select().from(mobileUsers).where(eq(mobileUsers.id, auth.sub));
  if (!user || !user.isActive) {
    return c.json({ error: { code: 'unauthorized', message: 'Invalid session' } }, 401);
  }

  return c.json({
    user: {
      id: user.id,
      phone: user.phone,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      ...(await getMobileUserContext(user.id)),
    },
  });
});

authRoutes.post('/mobile/avatar', requireAuth, async (c, next) => {
  if (c.get('auth').kind !== 'mobile') {
    return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
  }
  await next();
}, bodyLimit({
  maxSize: MAX_AVATAR_BYTES + 64 * 1024,
  onError: c => c.json({ error: { code: 'file_too_large', message: 'Choose a photo that is 5 MB or smaller.' } }, 413),
}), async c => {
  try {
    if (!c.req.header('content-type')?.toLowerCase().includes('multipart/form-data')) {
      throw new ApiError(400, 'validation_error', 'Send the selected photo as a multipart file.');
    }
    let form;
    try { form = await c.req.parseBody({ all: true }); }
    catch { throw new ApiError(400, 'validation_error', 'The photo could not be read. Choose it again.'); }
    const file = form.file;
    if (!(file instanceof File)) throw new ApiError(400, 'validation_error', 'Choose one photo to upload.');
    if (file.size > MAX_AVATAR_BYTES) throw new ApiError(400, 'file_too_large', 'Choose a photo that is 5 MB or smaller.');
    const result = await mediaService.uploadMobileAvatar(c.get('auth'), {
      bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type, filename: file.name,
    });
    return c.json(result, 201);
  } catch (error) {
    const { status, body } = httpError(error, 'mobile-avatar');
    return c.json(body, status);
  }
});

authRoutes.put('/mobile/profile', requireAuth, async c => {
  try {
    const auth = c.get('auth');
    if (auth.kind !== 'mobile') {
      return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
    }

    const body = UpdateMobileProfileRequestSchema.parse(await c.req.json());
    const user = await db.transaction(async transaction => {
      const [owner] = await transaction.select({ id: mobileUsers.id }).from(mobileUsers)
        .where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true))).for('update');
      if (!owner) return null;
      await mediaService.replaceMobileAvatarUsage(auth, body.avatarUrl, transaction);
      const [saved] = await transaction.update(mobileUsers).set({
        displayName: body.displayName, avatarUrl: body.avatarUrl, bio: body.bio,
        location: body.location, website: body.website, updatedAt: new Date(),
      }).where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true))).returning();
      return saved;
    });

    if (!user || !user.isActive) {
      return c.json({ error: { code: 'not_found', message: 'Profile not found' } }, 404);
    }

    await writeAudit({
      actorId: user.id,
      actorEmail: user.phone,
      action: 'mobile_user.profile_updated',
      entityType: 'mobile_user',
      entityId: user.id,
      metadata: { changed: ['displayName', 'avatarUrl', 'bio', 'location', 'website'] },
    });

    return c.json({
      user: {
        id: user.id,
        phone: user.phone,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        location: user.location,
        website: user.website,
        ...(await getMobileUserContext(user.id)),
      },
    });
  } catch (error) {
    const { status, body } = httpError(error, 'mobile-profile');
    return c.json(body, status);
  }
});

authRoutes.post('/mobile/logout', requireAuth, async c => {
  const auth = c.get('auth');
  if (auth.kind === 'mobile') {
    if (auth.sid) await revokeMobileSession(auth.sub, auth.sid);
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'auth.mobile_logout',
      entityType: 'mobile_user',
      entityId: auth.sub,
    });
  }
  return c.json({ ok: true });
});

return authRoutes;
}

export const authRoutes = createAuthRoutes();
