import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) {
  process.env.DATABASE_URL = testDatabase;
  process.env.MEDIA_STORAGE = 'local';
  delete process.env.REDIS_URL;
}

type Json = Record<string, any>;
type Context = { deviceId: string; ip: string };
type Sms = { phone: string; code: string; requestId: string; expiresInSeconds: number };

describe('mobile OTP and revocable sessions (PostgreSQL)', { skip: !testDatabase, concurrency: false }, () => {
  const run = randomUUID();
  const digits = String(Number.parseInt(run.slice(0, 8), 16) % 10_000_000).padStart(7, '0');
  const phones: string[] = [];
  const captured = new Map<string, Sms>();
  const userIds = new Set<string>();
  let phoneIndex = 0, codeIndex = 310_000;
  let sql: any, db: any, schema: any, Hono: any, createAuthRoutes: any, DurableOtpProvider: any, PostgresOtpStore: any, httpError: any;

  function phone() {
    const value = `+919${digits}${String(++phoneIndex).padStart(2, '0')}`;
    phones.push(value);
    return value;
  }
  const context = (): Context => ({ deviceId: `otp-integration-${randomUUID()}`, ip: `198.18.${Math.floor(phoneIndex / 200)}.${phoneIndex % 200 + 1}` });
  const wrongCode = (sms: Sms) => sms.code === '000000' ? '000001' : '000000';

  function harness(input: { clock?: number; failDelivery?: boolean } = {}) {
    let now = input.clock ?? Date.now();
    const sent: Sms[] = [];
    const options = {
      store: new PostgresOtpStore(),
      delivery: { send: async (sms: Sms) => {
        sent.push(sms);
        captured.set(sms.requestId, sms);
        if (input.failDelivery) throw new Error('test delivery unavailable');
      } },
      clock: () => now,
      randomCode: () => String(++codeIndex),
      // Instances within one run share limits; a later test run must not
      // inherit this run's deliberately exhausted IP/device budgets.
      pepper: `otp-postgres-integration-pepper-${run}`,
      event: () => {},
    };
    const provider = new DurableOtpProvider(options);
    const app = new Hono().onError((error: unknown, c: any) => {
      const mapped = httpError(error, 'otp-integration');
      return c.json(mapped.body, mapped.status);
    }).route('/auth', createAuthRoutes({ otpProvider: provider }));
    return { provider, app, sent, advance: (milliseconds: number) => { now += milliseconds; }, now: () => now };
  }

  async function call(app: any, path: string, data?: unknown, token?: string) {
    const response = await app.request(`/auth${path}`, {
      method: data === undefined ? 'GET' : 'POST',
      headers: {
        ...(data === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) as Json : {};
    if (json.user?.id) userIds.add(json.user.id);
    return { status: response.status, json, retryAfter: response.headers.get('retry-after') };
  }
  const send = (h: ReturnType<typeof harness>, mobile: string, ctx: Context) => call(h.app, '/mobile/otp/send', { phone: mobile, deviceId: ctx.deviceId });
  const verify = (h: ReturnType<typeof harness>, mobile: string, requestId: string, ctx: Context, code = captured.get(requestId)!.code) => call(h.app, '/mobile/otp/verify', { phone: mobile, requestId, code, deviceId: ctx.deviceId });
  async function successfulSend(h: ReturnType<typeof harness>, mobile: string, ctx: Context) {
    const result = await send(h, mobile, ctx);
    assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.json.expiresInSeconds, 300);
    assert.equal(Date.parse(result.json.expiresAt), h.now() + 300_000);
    assert.equal(Date.parse(result.json.resendAvailableAt), h.now() + 60_000);
    assert.ok(captured.has(result.json.requestId), 'successful response follows the delivery adapter acknowledgement');
    assert.equal('code' in result.json || 'otp' in result.json, false);
    return result.json.requestId as string;
  }

  before(async () => {
    ({ Hono } = await import('hono'));
    ({ createAuthRoutes } = await import('./auth.js'));
    ({ DurableOtpProvider } = await import('../lib/otp/durableOtpProvider.js'));
    ({ PostgresOtpStore } = await import('../lib/otp/postgresOtpStore.js'));
    ({ httpError } = await import('../lib/httpError.js'));
    const client = await import('../db/client.js');
    sql = client.sql; db = client.db;
    schema = await import('../db/schema.js');
  });

  after(async () => {
    if (!sql) return;
    try {
      const ids = [...captured.keys()];
      if (ids.length) {
        const rows = await sql`SELECT DISTINCT phone_hash FROM otp_challenges WHERE id = ANY(${ids}::uuid[])`;
        await sql`DELETE FROM otp_challenges WHERE id = ANY(${ids}::uuid[])`;
        if (rows.length) await sql`DELETE FROM otp_phone_states WHERE phone_hash = ANY(${rows.map((row: Json) => row.phone_hash)}::text[])`;
      }
      if (phones.length) {
        const rows = await sql`SELECT id FROM mobile_users WHERE phone = ANY(${phones}::text[])`;
        for (const row of rows) userIds.add(row.id);
        if (userIds.size) await sql`DELETE FROM audit_logs WHERE actor_id = ANY(${[...userIds]}::uuid[])`;
        await sql`DELETE FROM mobile_users WHERE phone = ANY(${phones}::text[])`;
      }
    } finally { await sql.end({ timeout: 5 }); }
  });

  it('creates a new account only after verification and reuses that account on later login', async () => {
    const h = harness(), mobile = phone(), ctx = context();
    const id = await successfulSend(h, mobile, ctx);
    const before = await sql`SELECT id FROM mobile_users WHERE phone = ${mobile}`;
    assert.equal(before.length, 0);
    const rows = await sql`SELECT phone_hash, code_hash FROM otp_challenges WHERE id = ${id}::uuid`;
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].phone_hash, mobile);
    assert.notEqual(rows[0].code_hash, captured.get(id)!.code);
    const loggedIn = await verify(h, mobile, id, ctx);
    assert.equal(loggedIn.status, 200, JSON.stringify(loggedIn.json));
    assert.equal(loggedIn.json.user.phone, mobile);
    assert.ok(loggedIn.json.token);
    assert.ok(Date.parse(loggedIn.json.expiresAt) > Date.now());
    const userId = loggedIn.json.user.id;
    await sql`UPDATE mobile_users SET display_name = 'Returning OTP user' WHERE id = ${userId}::uuid`;
    h.advance(60_001);
    const secondId = await successfulSend(h, mobile, ctx);
    const returning = await verify(h, mobile, secondId, ctx);
    assert.equal(returning.status, 200, JSON.stringify(returning.json));
    assert.equal(returning.json.user.id, userId);
    assert.equal(returning.json.user.displayName, 'Returning OTP user');
    const accounts = await sql`SELECT id FROM mobile_users WHERE phone = ${mobile}`;
    assert.equal(accounts.length, 1);
  });

  it('rejects a wrong code and the exact five-minute expiry boundary without issuing a session', async () => {
    const h = harness(), mobile = phone(), ctx = context();
    const id = await successfulSend(h, mobile, ctx);
    const wrong = await verify(h, mobile, id, ctx, wrongCode(captured.get(id)!));
    assert.equal(wrong.status, 400, JSON.stringify(wrong.json));
    assert.equal(wrong.json.token, undefined);
    h.advance(300_000);
    const expired = await verify(h, mobile, id, ctx);
    assert.equal(expired.status, 400, JSON.stringify(expired.json));
    assert.equal(expired.json.error.code, 'otp_expired');
    const accounts = await sql`SELECT id FROM mobile_users WHERE phone = ${mobile}`;
    assert.equal(accounts.length, 0);
  });

  it('enforces the resend cooldown in another API instance and invalidates the old request after resend', async () => {
    const first = harness(), mobile = phone(), ctx = context();
    const oldId = await successfulSend(first, mobile, ctx);
    const second = harness({ clock: first.now() });
    const cooldown = await send(second, mobile, ctx);
    assert.equal(cooldown.status, 429, JSON.stringify(cooldown.json));
    assert.equal(cooldown.json.error.code, 'resend_cooldown');
    assert.ok(Number(cooldown.retryAfter) > 0 && Number(cooldown.retryAfter) <= 60);
    second.advance(60_001);
    const newId = await successfulSend(second, mobile, ctx);
    assert.notEqual(newId, oldId);
    assert.equal((await verify(first, mobile, oldId, ctx)).status, 400);
    assert.equal((await verify(second, mobile, newId, ctx)).status, 200);
  });

  it('allows exactly one concurrent verification across separate store instances', async () => {
    const first = harness(), mobile = phone(), ctx = context();
    const id = await successfulSend(first, mobile, ctx);
    const second = harness({ clock: first.now() });
    const results = await Promise.all([verify(first, mobile, id, ctx), verify(second, mobile, id, ctx)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    const [account] = await sql`SELECT id FROM mobile_users WHERE phone = ${mobile}`;
    const sessions = await sql`SELECT id FROM mobile_auth_sessions WHERE user_id = ${account.id}::uuid`;
    assert.equal(sessions.length, 1);
    assert.equal((await verify(first, mobile, id, ctx)).status, 400);
  });

  it('sends only one SMS when two instances receive the same resend concurrently', async () => {
    const first = harness(), mobile = phone(), ctx = context();
    const oldId = await successfulSend(first, mobile, ctx);
    const one = harness({ clock: first.now() + 60_001 });
    const two = harness({ clock: first.now() + 60_001 });
    const results = await Promise.allSettled([one.provider.sendOtp(mobile, ctx), two.provider.sendOtp(mobile, ctx)]);
    const accepted = results.filter(result => result.status === 'fulfilled');
    const blocked = results.filter(result => result.status === 'rejected');
    assert.equal(accepted.length, 1);
    assert.equal(blocked.length, 1);
    assert.equal((blocked[0] as PromiseRejectedResult).reason.code, 'resend_cooldown');
    assert.equal(one.sent.length + two.sent.length, 1);
    assert.equal(await first.provider.verifyOtp(mobile, captured.get(oldId)!.code, oldId, ctx), false);
    const latest = (accepted[0] as PromiseFulfilledResult<Json>).value.requestId;
    assert.equal(await one.provider.verifyOtp(mobile, captured.get(latest)!.code, latest, ctx), true);
  });

  it('persists failed-attempt lockout across new instances and resend, then permits recovery after it expires', async () => {
    const first = harness(), mobile = phone(), ctx = context();
    const id = await successfulSend(first, mobile, ctx);
    const wrong = wrongCode(captured.get(id)!);
    for (let index = 0; index < 4; index += 1) assert.equal((await verify(first, mobile, id, ctx, wrong)).status, 400);
    const locked = await verify(first, mobile, id, ctx, wrong);
    assert.equal(locked.status, 429, JSON.stringify(locked.json));
    assert.equal(locked.json.error.code, 'otp_locked');
    const restarted = harness({ clock: first.now() + 60_001 });
    const stillLocked = await send(restarted, mobile, ctx);
    assert.equal(stillLocked.status, 429, JSON.stringify(stillLocked.json));
    assert.equal(stillLocked.json.error.code, 'otp_locked');
    restarted.advance(15 * 60_000);
    const recovered = await successfulSend(restarted, mobile, ctx);
    assert.equal((await verify(restarted, mobile, recovered, ctx)).status, 200);
  });

  it('does not create a usable challenge or session when the delivery provider fails', async () => {
    const h = harness({ failDelivery: true }), mobile = phone(), ctx = context();
    const result = await send(h, mobile, ctx);
    assert.equal(result.status, 503, JSON.stringify(result.json));
    assert.equal(h.sent.length, 1, 'an ambiguous provider failure must not automatically send twice');
    const sent = h.sent[0]!;
    assert.equal((await verify(h, mobile, sent.requestId, ctx)).status, 400);
    const users = await sql`SELECT id FROM mobile_users WHERE phone = ${mobile}`;
    assert.equal(users.length, 0);
  });

  it('persists phone resend, hourly and daily send budgets across provider instances', async () => {
    const dayStart = Math.floor(Date.now() / 86_400_000) * 86_400_000;
    for (const policy of [
      { accepted: 4, spacing: 61_000 },
      { accepted: 5, spacing: 11 * 60_000 },
      { accepted: 10, spacing: 61 * 60_000 },
    ]) {
      const mobile = phone(), ctx = context();
      for (let index = 0; index < policy.accepted; index += 1) {
        const h = harness({ clock: dayStart + 1_000 + index * policy.spacing });
        await h.provider.sendOtp(mobile, ctx);
      }
      const restarted = harness({ clock: dayStart + 1_000 + policy.accepted * policy.spacing });
      await assert.rejects(() => restarted.provider.sendOtp(mobile, ctx), (error: any) => {
        assert.equal(error.code, 'rate_limit_exceeded');
        assert.ok(error.retryAfterSeconds > 0);
        return true;
      });
    }
  });

  it('limits a shared device across phone changes and a shared IP across device changes', async () => {
    const hourStart = Math.floor(Date.now() / 3_600_000) * 3_600_000 + 1_000;
    const sameDevice = `otp-shared-device-${randomUUID()}`;
    for (let index = 0; index < 10; index += 1) {
      const mobile = phone(), ctx = { ...context(), deviceId: sameDevice };
      await harness({ clock: hourStart }).provider.sendOtp(mobile, ctx);
    }
    await assert.rejects(() => harness({ clock: hourStart }).provider.sendOtp(phone(), { ...context(), deviceId: sameDevice }), (error: any) => error.code === 'rate_limit_exceeded');

    const sameIp = `198.19.253.${Math.floor(Math.random() * 200) + 1}`;
    for (let index = 0; index < 30; index += 1) {
      const mobile = phone(), ctx = { ...context(), ip: sameIp };
      await harness({ clock: hourStart }).provider.sendOtp(mobile, ctx);
    }
    await assert.rejects(() => harness({ clock: hourStart }).provider.sendOtp(phone(), { ...context(), ip: sameIp }), (error: any) => error.code === 'rate_limit_exceeded');
  });

  it('restores a verified session in another API instance and rejects the old token after logout', async () => {
    const h = harness(), mobile = phone(), ctx = context();
    const id = await successfulSend(h, mobile, ctx);
    const login = await verify(h, mobile, id, ctx);
    assert.equal(login.status, 200, JSON.stringify(login.json));
    const token = login.json.token as string;
    const restarted = harness();
    assert.equal((await call(restarted.app, '/mobile/me', undefined, token)).status, 200);
    assert.equal((await call(restarted.app, '/mobile/logout', {}, token)).status, 200);
    assert.equal((await call(h.app, '/mobile/me', undefined, token)).status, 401);
    const { verifyToken } = await import('../lib/auth.js');
    await assert.rejects(() => verifyToken(token), /session/i);
    const sessions = await sql`SELECT revoked_at FROM mobile_auth_sessions WHERE user_id = ${login.json.user.id}::uuid`;
    assert.ok(sessions[0].revoked_at);
  });

  it('rejects expired sessions and sessions owned by disabled accounts', async () => {
    for (const mode of ['expired', 'disabled']) {
      const h = harness(), mobile = phone(), ctx = context();
      const id = await successfulSend(h, mobile, ctx);
      const login = await verify(h, mobile, id, ctx);
      assert.equal(login.status, 200, JSON.stringify(login.json));
      if (mode === 'expired') await sql`UPDATE mobile_auth_sessions SET expires_at = now() - interval '1 second' WHERE user_id = ${login.json.user.id}::uuid`;
      else await sql`UPDATE mobile_users SET is_active = false WHERE id = ${login.json.user.id}::uuid`;
      assert.equal((await call(h.app, '/mobile/me', undefined, login.json.token)).status, 401);
    }
  });

  it('cannot manufacture a user session by submitting an arbitrary device ID', async () => {
    const h = harness();
    const result = await call(h.app, '/mobile/token', { deviceId: randomUUID(), displayName: 'Unverified identity' });
    assert.equal(result.status, 410);
    assert.equal(result.json.token, undefined);
  });
});
