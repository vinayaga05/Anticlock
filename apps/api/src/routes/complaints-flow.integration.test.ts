import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
if (testDatabase) process.env.DATABASE_URL = testDatabase;

// Opt-in against a migrated disposable database, never the production database.
describe('Nexus complaints across users (PostgreSQL integration)', { skip: !testDatabase }, () => {
  const firstUser = randomUUID();
  const secondUser = randomUUID();
  const inactiveUser = randomUUID();
  const missingUser = randomUUID();
  const fixtureAuthors = [firstUser, secondUser, inactiveUser];
  const run = randomUUID();
  const tokens: Record<string, string> = {};
  let app: any;
  let db: any;
  let sqlClient: any;
  let schema: any;

  async function request(userId: string | null, method: string, path = '/v1/complaints', body?: unknown) {
    const response = await app.request(path, {
      method,
      headers: {
        ...(userId ? { Authorization: `Bearer ${tokens[userId]}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as any };
  }

  function input(title: string, clientRequestId = `complaint-${randomUUID()}`) {
    return { title, description: 'The community needs help resolving this issue.', clientRequestId };
  }

  before(async () => {
    const { Hono } = await import('hono');
    const { complaintsMobileRoutes } = await import('./complaints.js');
    const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js');
    db = client.db;
    sqlClient = client.sql;
    schema = await import('../db/schema.js');
    app = new Hono().route('/v1/complaints', complaintsMobileRoutes);
    await db.insert(schema.mobileUsers).values([
      { id: firstUser, phone: `first-${run}`, displayName: 'First complaint author', bio: 'private account detail' },
      { id: secondUser, phone: `second-${run}`, displayName: 'Second complaint author' },
      { id: inactiveUser, phone: `inactive-${run}`, displayName: 'Inactive author', isActive: false },
    ]);
    for (const id of [...fixtureAuthors, missingUser]) {
      tokens[id] = await signToken({ kind: 'mobile', sub: id, email: 'private@example.test', name: 'Stale token name', roles: [], permissions: [] });
    }
    tokens.admin = await signToken({ kind: 'admin', sub: randomUUID(), email: 'admin@example.test', name: 'Admin', roles: [], permissions: [] });
  });

  after(async () => {
    if (!db) return;
    try {
      const { inArray } = await import('drizzle-orm');
      await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, fixtureAuthors));
    } finally {
      await sqlClient.end({ timeout: 5 });
    }
  });

  it('requires active mobile accounts and rejects unauthenticated or admin access', async () => {
    for (const user of [null, 'admin', inactiveUser, missingUser]) {
      for (const method of ['GET', 'POST']) {
        const result = await request(user, method, '/v1/complaints', method === 'POST' ? input('Access check') : undefined);
        assert.equal(result.status, user === null ? 401 : 403, `${method} for ${user}`);
      }
    }
  });

  it('persists a complaint and exposes it to another user with only public author details', async () => {
    const created = await request(firstUser, 'POST', '/v1/complaints', input('  Broken lights near the ground  '));
    assert.equal(created.status, 201);
    assert.equal(created.body.complaint.title, 'Broken lights near the ground');
    assert.equal(created.body.complaint.author.id, firstUser);
    assert.equal(created.body.complaint.author.displayName, 'First complaint author');
    const result = await request(secondUser, 'GET', '/v1/complaints?limit=50');
    assert.equal(result.status, 200);
    const visible = result.body.complaints.find((complaint: any) => complaint.id === created.body.complaint.id);
    assert.deepEqual(visible, created.body.complaint);
    assert.deepEqual(Object.keys(visible.author).sort(), ['avatarUrl', 'displayName', 'id']);
    assert.equal(JSON.stringify(result.body).includes('private@example.test'), false);
    assert.equal(JSON.stringify(result.body).includes(`first-${run}`), false);
    assert.equal(JSON.stringify(result.body).includes('private account detail'), false);
    const { eq } = await import('drizzle-orm');
    const stored = await db.select().from(schema.complaints).where(eq(schema.complaints.id, visible.id));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].description, visible.description);
  });

  it('never attributes a complaint to a user supplied in the request body', async () => {
    const result = await request(firstUser, 'POST', '/v1/complaints', { ...input('Attribution check'), authorId: secondUser, author: { id: secondUser } });
    // The contract may reject unknown fields or strip them. Neither allows spoofing.
    assert.ok([201, 400].includes(result.status));
    if (result.status === 201) assert.equal(result.body.complaint.author.id, firstUser);
  });

  it('serializes concurrent retries without duplicates and rejects key reuse with a different complaint', async () => {
    const payload = input('Repeated request', `retry-${randomUUID()}`);
    const results = await Promise.all(Array.from({ length: 6 }, () => request(firstUser, 'POST', '/v1/complaints', payload)));
    assert.ok(results.every(result => result.status === 201));
    assert.equal(new Set(results.map(result => result.body.complaint.id)).size, 1);
    const conflict = await request(firstUser, 'POST', '/v1/complaints', { ...payload, description: 'Another description must not replace the existing complaint.' });
    assert.equal(conflict.status, 409);
    const otherUser = await request(secondUser, 'POST', '/v1/complaints', payload);
    assert.equal(otherUser.status, 201);
    assert.notEqual(otherUser.body.complaint.id, results[0].body.complaint.id);
    const { and, eq } = await import('drizzle-orm');
    const stored = await db.select().from(schema.complaints).where(and(eq(schema.complaints.authorId, firstUser), eq(schema.complaints.clientRequestId, payload.clientRequestId)));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].description, payload.description);
  });

  it('paginates deterministically without losing complaints with the same timestamp', async () => {
    const tiedDate = new Date('2040-01-01T12:00:00.123Z');
    const ids = Array.from({ length: 7 }, () => randomUUID()).sort().reverse();
    await db.insert(schema.complaints).values(ids.map((id, index) => ({ id, authorId: index % 2 ? firstUser : secondUser, title: `Tied complaint ${index}`, description: 'A complaint at the same precise timestamp.', createdAt: tiedDate })));
    let cursor: string | null = null;
    const seen: string[] = [];
    const cursors = new Set<string>();
    do {
      const result = await request(secondUser, 'GET', `/v1/complaints?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      assert.equal(result.status, 200);
      assert.ok(result.body.complaints.length <= 2);
      seen.push(...result.body.complaints.map((complaint: any) => complaint.id));
      cursor = result.body.nextCursor;
      if (cursor) { assert.equal(cursors.has(cursor), false, 'cursor must progress'); cursors.add(cursor); }
    } while (cursor);
    assert.deepEqual(seen.slice(0, ids.length), ids);
    assert.equal(seen.length, new Set(seen).size);
    const stored = await db.select({ id: schema.complaints.id }).from(schema.complaints);
    assert.deepEqual(new Set(seen), new Set(stored.map((row: any) => row.id)));
  });

  it('rejects invalid bodies, limits and cursors without adding complaints', async () => {
    const before = await db.select({ id: schema.complaints.id }).from(schema.complaints);
    for (const payload of [{ title: ' ', description: 'Valid description here' }, { title: 'Valid title', description: ' ' }, { ...input('Unicode title'), title: '🏃🏃' }, { ...input('Unicode description'), description: '🏃'.repeat(5) }, { ...input('Too long'), title: 'x'.repeat(121) }, { ...input('Too long description'), description: 'x'.repeat(3001) }]) {
      assert.equal((await request(firstUser, 'POST', '/v1/complaints', payload)).status, 400);
    }
    for (const query of ['limit=0', 'limit=51', 'limit=nope', 'cursor=malformed', 'cursor=eyJjcmVhdGVkQXQiOiJpbnZhbGlkIn0']) {
      assert.equal((await request(secondUser, 'GET', `/v1/complaints?${query}`)).status, 400, query);
    }
    const afterRows = await db.select({ id: schema.complaints.id }).from(schema.complaints);
    assert.deepEqual(new Set(afterRows.map((row: any) => row.id)), new Set(before.map((row: any) => row.id)));
  });
});
