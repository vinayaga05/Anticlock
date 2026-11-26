import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, after, describe, it } from 'node:test';
import { normalizeUsername, usernameProblem } from '@anticlock/contracts/username';

const database = process.env.TEST_DATABASE_URL;
if (database) process.env.DATABASE_URL = database;
process.env.STREAM_API_KEY = '';
process.env.STREAM_API_SECRET = '';
process.env.REDIS_URL = '';
process.env.MEDIA_STORAGE = 'local';

describe('username policy', () => {
  it('normalizes one @ and rejects invalid punctuation and non-ASCII', () => {
    assert.equal(normalizeUsername(' @Arun.Fit '), 'arun.fit');
    for (const value of ['ab', 'a'.repeat(31), '___', '...', '.abc', 'abc.', 'a..b', 'a b', 'éab', 'ab🙂', '@@abc']) assert.ok(usernameProblem(value), value);
    for (const value of ['arun.fit', '_abc_', 'a_1', '@Arun.Fit', 'a'.repeat(30)]) assert.equal(usernameProblem(value), null, value);
  });
});

describe('username signup, search and rename (PostgreSQL)', { skip: !database }, () => {
  let app: any, db: any, sql: any, schema: any;
  const ids: string[] = [];
  const tokens: string[] = [];
  const suffix = randomUUID().slice(0, 8);
  const handle = `arun.${suffix}`;
  async function call(index: number, path: string, method = 'GET', body?: unknown) {
    const res = await app.request(path, { method, headers: { authorization: `Bearer ${tokens[index]}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: res.status, body: await res.json() as any };
  }
  before(async () => {
    const { Hono } = await import('hono');
    const { createAuthRoutes } = await import('./auth.js');
    const { requireAuth } = await import('../middleware/auth.js');
    const { usernameSetupGate } = await import('../middleware/usernameSetupGate.js');
    ({ db, sql } = await import('../db/client.js'));
    schema = await import('../db/schema.js');
    app = new Hono();
    app.use('*', usernameSetupGate);
    app.route('/auth', createAuthRoutes({ otpProvider: { verifyOtp: async () => true } as any }));
    app.get('/main', requireAuth, (c: any) => c.json({ ok: true }));
    const { contentMobileRoutes } = await import('./content.js');
    app.route('/content', contentMobileRoutes);
    for (let index = 0; index < 3; index++) {
      const res = await app.request('/auth/mobile/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`, code: '123456', requestId: randomUUID() }) });
      assert.equal(res.status, 200);
      const session = await res.json() as any;
      ids.push(session.user.id); tokens.push(session.token);
      assert.equal(session.user.needsUsername, true);
    }
  });
  after(async () => {
    if (!db) return;
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.profileFollows).where(inArray(schema.profileFollows.followerProfileId, ids));
    await db.delete(schema.profileBlocks).where(inArray(schema.profileBlocks.blockerProfileId, ids));
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, ids));
    await sql.end({ timeout: 5 });
  });
  it('resumes incomplete signup and denies a protected deep-link/API target', async () => {
    assert.equal((await call(0, '/auth/mobile/me')).body.user.needsUsername, true);
    const protectedResult = await call(0, '/main');
    assert.equal(protectedResult.status, 403);
    assert.equal(protectedResult.body.error.code, 'USERNAME_REQUIRED');
    assert.equal((await call(0, '/auth/mobile/username', 'PUT', { username: 'admin' })).body.error.code, 'USERNAME_RESERVED');
    assert.equal((await call(0, '/auth/mobile/username', 'PUT', { username: 'a..b' })).status, 400);
    assert.equal((await call(0, '/auth/mobile/username', 'PUT', { username: '@@abc' })).status, 400);
  });
  it('exactly one concurrent case-insensitive claim wins and retries recover it', async () => {
    const claims = await Promise.all([call(0, '/auth/mobile/username', 'PUT', { username: ` @${handle.toUpperCase()} ` }), call(1, '/auth/mobile/username', 'PUT', { username: handle })]);
    assert.deepEqual(claims.map(result => result.status).sort(), [200, 409]);
    const winner = claims.findIndex(result => result.status === 200);
    const loser = winner === 0 ? 1 : 0;
    assert.equal(claims[loser]!.body.error.code, 'USERNAME_TAKEN');
    assert.equal((await call(winner, '/auth/mobile/username', 'PUT', { username: handle })).status, 200);
    assert.equal((await call(winner, '/auth/mobile/me')).body.user.needsUsername, false);
    assert.equal((await call(winner, '/main')).status, 200);
    const suggestions = (await call(loser, `/auth/mobile/username/availability?username=${handle}`)).body.suggestions;
    assert.equal(suggestions.length, 3);
    assert.equal(new Set(suggestions).size, 3);
    for (const suggestion of suggestions) assert.equal((await call(loser, `/auth/mobile/username/availability?username=${suggestion}`)).body.status, 'available');
    // Complete every account for subsequent private-profile and graph scenarios.
    assert.equal((await call(loser, '/auth/mobile/username', 'PUT', { username: suggestions[0] })).status, 200);
    assert.equal((await call(2, '/auth/mobile/username', 'PUT', { username: `viewer_${suffix}` })).status, 200);
  });
  it('finds private headers by case-insensitive handle, ranks exact first and honors blocks', async () => {
    const { eq } = await import('drizzle-orm');
    const owner = (await call(0, '/auth/mobile/me')).body.user.handle === handle ? 0 : 1;
    await db.update(schema.mobileUsers).set({ isPrivate: true }).where(eq(schema.mobileUsers.id, ids[owner]));
    const search = await call(2, `/auth/mobile/users?q=${encodeURIComponent('@' + handle.toUpperCase())}`);
    assert.equal(search.body.data[0].id, ids[owner]);
    assert.equal(search.body.data[0].phone, undefined);
    const profile = await call(2, `/content/profiles/personal/${ids[owner]}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.profile.relationship.canViewContent, false);
    await db.insert(schema.profileBlocks).values({ blockerProfileId: ids[owner], blockerProfileType: 'personal', blockedProfileId: ids[2], blockedProfileType: 'personal' });
    assert.equal((await call(2, `/auth/mobile/users?q=${handle}&exact=true`)).body.data.length, 0);
    assert.equal((await call(2, `/content/profiles/personal/${ids[owner]}`)).status, 404);
    await db.delete(schema.profileBlocks).where(eq(schema.profileBlocks.blockerProfileId, ids[owner]));
  });
  it('renames atomically, releases the old name and preserves IDs, follows and shared profile paths', async () => {
    const { eq } = await import('drizzle-orm');
    const owner = (await call(0, '/auth/mobile/me')).body.user.handle === handle ? 0 : 1;
    const target = owner === 0 ? 1 : 0;
    const targetHandle = (await call(target, '/auth/mobile/me')).body.user.handle;
    await db.insert(schema.profileFollows).values({ followerProfileId: ids[2], followerProfileType: 'personal', followedProfileId: ids[owner], followedProfileType: 'personal', status: 'accepted' });
    assert.equal((await call(owner, '/auth/mobile/username', 'PUT', { username: targetHandle })).status, 409);
    assert.equal((await call(owner, '/auth/mobile/me')).body.user.handle, handle);
    const next = `renamed_${suffix}`;
    assert.equal((await call(owner, '/auth/mobile/username', 'PUT', { username: next })).body.user.id, ids[owner]);
    assert.equal((await call(2, `/auth/mobile/users?q=${next}&exact=true`)).body.data[0].id, ids[owner]);
    assert.equal((await call(2, `/auth/mobile/username/availability?username=${handle}`)).body.status, 'available');
    const graph = await db.select().from(schema.profileFollows).where(eq(schema.profileFollows.followedProfileId, ids[owner]));
    assert.equal(graph[0].followerProfileId, ids[2]);
    assert.equal((await call(2, `/content/profiles/personal/${ids[owner]}`)).body.profile.publisher.handle, next);
    // Direct SQL cannot insert a noncanonical username to evade API validation.
    await assert.rejects(db.update(schema.mobileUsers).set({ handle: next.toUpperCase() }).where(eq(schema.mobileUsers.id, ids[owner])));
  });
});
