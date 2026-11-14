import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
const mediaDirectory = path.join(tmpdir(), `knock-profile-test-${randomUUID()}`);
if (testDatabase) {
  process.env.DATABASE_URL = testDatabase;
  process.env.MEDIA_STORAGE = 'local';
  process.env.MEDIA_LOCAL_DIR = mediaDirectory;
  process.env.API_PUBLIC_URL = 'http://localhost:4000';
}
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==', 'base64');

describe('profile photo upload and save (PostgreSQL + local media)', { skip: !testDatabase }, () => {
  const owner = randomUUID(); const other = randomUUID(); const inactive = randomUUID();
  const fixtureUsers = [owner, other, inactive];
  const mediaIds: string[] = [];
  const tokens: Record<string, string> = {};
  let app: any; let db: any; let sqlClient: any; let schema: any;
  let uploadedUrl = '';

  function form(bytes = png, contentType = 'image/png') {
    const value = new FormData();
    value.append('file', new Blob([new Uint8Array(bytes)], { type: contentType }), '../../somebody-else/photo.png');
    value.append('userId', other);
    return value;
  }
  function headers(id: string | null) { return id ? { Authorization: `Bearer ${tokens[id]}` } : {}; }
  async function user(id: string) {
    const { eq } = await import('drizzle-orm');
    return (await db.select().from(schema.mobileUsers).where(eq(schema.mobileUsers.id, id)))[0];
  }
  function profile(avatarUrl: string | null) {
    return { displayName: 'Arjun Mehta', avatarUrl, bio: 'Runner, maker, always moving.', location: 'Bengaluru, India', website: 'https://example.test/' };
  }

  before(async () => {
    const { Hono } = await import('hono');
    const { authRoutes } = await import('./auth.js');
    const { mediaPublicRoutes } = await import('./media.js');
    const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js');
    db = client.db; sqlClient = client.sql; schema = await import('../db/schema.js');
    app = new Hono().route('/auth', authRoutes).route('/v1/media', mediaPublicRoutes);
    await db.insert(schema.mobileUsers).values([
      { id: owner, phone: `owner-${owner}`, displayName: 'Original owner', avatarUrl: 'https://example.test/old.png' },
      { id: other, phone: `other-${other}`, displayName: 'Other user' },
      { id: inactive, phone: `inactive-${inactive}`, displayName: 'Inactive user', isActive: false },
    ]);
    for (const id of fixtureUsers) tokens[id] = await signToken({ kind: 'mobile', sub: id, name: 'Profile test', email: '', roles: [], permissions: [] });
    tokens.admin = await signToken({ kind: 'admin', sub: randomUUID(), name: 'Admin', email: '', roles: [], permissions: [] });
  });
  after(async () => {
    if (!db) return;
    try {
      const { inArray, like } = await import('drizzle-orm');
      await db.delete(schema.mediaAssets).where(like(schema.mediaAssets.storageKey, `public/avatars/${owner}/%`));
      await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, fixtureUsers));
    } finally { await sqlClient.end({ timeout: 5 }); await rm(mediaDirectory, { recursive: true, force: true }); }
  });

  it('requires an active mobile account for uploading', async () => {
    for (const id of [null, 'admin', inactive]) {
      const response = await app.request('/auth/mobile/avatar', { method: 'POST', headers: headers(id), body: form() });
      assert.equal(response.status, id === null ? 401 : 403);
    }
  });

  it('uploads into the authenticated owner prefix and returns a durable public image URL without saving the profile', async () => {
    const response = await app.request('/auth/mobile/avatar', { method: 'POST', headers: headers(owner), body: form() });
    assert.equal(response.status, 201, await response.clone().text());
    const body = await response.json(); uploadedUrl = body.avatarUrl;
    const url = new URL(uploadedUrl);
    assert.equal(url.origin, 'http://localhost:4000');
    assert.equal(url.search, '');
    assert.match(decodeURIComponent(url.pathname), new RegExp(`^/v1/media/file/public-media/public/avatars/${owner}/[0-9a-f-]+/original\\.png$`));
    const { eq } = await import('drizzle-orm');
    const rows = await db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.storageKey, decodeURIComponent(url.pathname).split('/public-media/')[1]));
    assert.equal(rows.length, 1); mediaIds.push(rows[0].id);
    assert.equal(rows[0].processingStatus, 'ready'); assert.equal(rows[0].accessLevel, 'public');
    assert.equal(rows[0].mimeType, 'image/png'); assert.equal(rows[0].byteSize, png.length);
    const usages = await db.select().from(schema.mediaUsages).where(eq(schema.mediaUsages.mediaId, rows[0].id));
    assert.equal(usages.length, 0, 'a draft upload is not yet a saved avatar');
    assert.equal((await user(owner)).avatarUrl, 'https://example.test/old.png');
    assert.equal((await user(other)).avatarUrl, null);
    const image = await app.request(url.pathname);
    assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  });

  it('persists profile edits only after Save and supports explicit photo removal', async () => {
    const response = await app.request('/auth/mobile/profile', { method: 'PUT', headers: { ...headers(owner), 'Content-Type': 'application/json' }, body: JSON.stringify(profile(uploadedUrl)) });
    assert.equal(response.status, 200, await response.clone().text());
    assert.equal((await response.json()).user.avatarUrl, uploadedUrl);
    assert.equal((await user(owner)).displayName, 'Arjun Mehta');
    assert.equal((await user(owner)).avatarUrl, uploadedUrl);
    assert.equal((await user(other)).displayName, 'Other user');
    const { eq, and } = await import('drizzle-orm');
    const usages = () => db.select().from(schema.mediaUsages).where(and(eq(schema.mediaUsages.entityType, 'MOBILE_USER'), eq(schema.mediaUsages.entityId, owner), eq(schema.mediaUsages.usageType, 'PROFILE')));
    assert.deepEqual((await usages()).map((row: any) => row.mediaId), [mediaIds[0]]);
    const { mediaService } = await import('../media/MediaService.js');
    await assert.rejects(mediaService.delete({ kind: 'admin', sub: randomUUID(), email: '', name: 'Test', roles: [], permissions: ['media.delete'] }, mediaIds[0]!), (error: any) => error.status === 409 && error.code === 'in_use');
    const remove = await app.request('/auth/mobile/profile', { method: 'PUT', headers: { ...headers(owner), 'Content-Type': 'application/json' }, body: JSON.stringify(profile(null)) });
    assert.equal(remove.status, 200); assert.equal((await remove.json()).user.avatarUrl, null);
    assert.equal((await user(owner)).avatarUrl, null);
    assert.equal((await usages()).length, 0);
  });

  it('replaces only the owner avatar usage and releases it for an external photo', async () => {
    const save = (id: string, url: string | null) => app.request('/auth/mobile/profile', { method: 'PUT', headers: { ...headers(id), 'Content-Type': 'application/json' }, body: JSON.stringify(profile(url)) });
    const { eq, and } = await import('drizzle-orm');
    const usages = () => db.select().from(schema.mediaUsages).where(and(eq(schema.mediaUsages.entityType, 'MOBILE_USER'), eq(schema.mediaUsages.entityId, owner), eq(schema.mediaUsages.usageType, 'PROFILE')));
    assert.equal((await save(owner, uploadedUrl)).status, 200);
    const forbidden = await save(other, uploadedUrl);
    assert.equal(forbidden.status, 403);
    assert.equal((await user(other)).avatarUrl, null);
    const upload = await app.request('/auth/mobile/avatar', { method: 'POST', headers: headers(owner), body: form() });
    assert.equal(upload.status, 201);
    const { avatarUrl: replacement } = await upload.json();
    const mediaId = decodeURIComponent(new URL(replacement).pathname).split('/').at(-2)!;
    mediaIds.push(mediaId);
    assert.equal((await save(owner, replacement)).status, 200);
    assert.deepEqual((await usages()).map((row: any) => row.mediaId), [mediaId]);
    const old = await db.select().from(schema.mediaUsages).where(eq(schema.mediaUsages.mediaId, mediaIds[0]));
    assert.equal(old.length, 0);
    assert.equal((await save(owner, 'https://example.test/external-photo.png')).status, 200);
    assert.equal((await usages()).length, 0);
    assert.equal((await save(owner, null)).status, 200);
  });

  it('rejects disguised, corrupt or oversized files and non-HTTP avatar links', async () => {
    for (const [bytes, mime] of [[Buffer.from('<svg onload="bad()"/>'), 'image/png'], [png, 'text/plain'], [png.subarray(0, 30), 'image/png']] as const) {
      const response = await app.request('/auth/mobile/avatar', { method: 'POST', headers: headers(owner), body: form(bytes, mime) });
      assert.equal(response.status, 400);
    }
    const oversized = await app.request('/auth/mobile/avatar', { method: 'POST', headers: headers(owner), body: form(Buffer.alloc(5 * 1024 * 1024 + 1)) });
    assert.ok([400, 413].includes(oversized.status));
    const empty = await app.request('/auth/mobile/avatar', { method: 'POST', headers: { ...headers(owner), 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(empty.status, 400);
    for (const value of ['file:///private/photo.png', 'data:image/png;base64,AAAA', 'javascript:bad()', 'not a URL']) {
      const response = await app.request('/auth/mobile/profile', { method: 'PUT', headers: { ...headers(owner), 'Content-Type': 'application/json' }, body: JSON.stringify(profile(value)) });
      assert.equal(response.status, 400);
    }
    assert.equal((await user(owner)).avatarUrl, null);
  });

  it('never updates the profile of an inactive account', async () => {
    const response = await app.request('/auth/mobile/profile', { method: 'PUT', headers: { ...headers(inactive), 'Content-Type': 'application/json' }, body: JSON.stringify(profile(null)) });
    assert.equal(response.status, 404);
    assert.equal((await user(inactive)).displayName, 'Inactive user');
  });
});
