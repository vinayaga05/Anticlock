import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, beforeEach, after, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';

const database = process.env.TEST_DATABASE_URL;
if (database) process.env.DATABASE_URL = database;
// Tests use local records only: no Stream channels or push notifications.
process.env.STREAM_API_KEY = '';
process.env.STREAM_API_SECRET = '';
process.env.FIREBASE_SERVICE_ACCOUNT_JSON = '';
process.env.REDIS_URL = '';
process.env.MEDIA_STORAGE = 'local';
delete process.env.CONTENT_REQUIRE_REVIEW;

describe('profile connection lists and privacy (database integration)', { skip: !database }, () => {
  const A = randomUUID(), B = randomUUID(), C = randomUUID(), D = randomUUID();
  const ids = [A, B, C, D];
  const BUSINESS = randomUUID();
  const ref = (id: string) => ({ id, type: 'personal' });
  const body = (from: string, to: string) => ({ followerProfileId: from, followerProfileType: 'personal', followedProfileId: to, followedProfileType: 'personal' });
  let app: any, db: any, schema: any, sql: any;
  const tokens: Record<string, string> = {};
  const root = '/v1/profile-follows';
  async function call(who: string, path: string, method = 'GET', data?: unknown) {
    const response = await app.request(path, { method, headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
    return { status: response.status, data: await response.json() as any };
  }
  const list = (who: string, target: string, direction = 'followers', query = '') => call(who, `${root}/connections/personal/${target}/${direction}${query}`);
  const follow = (from: string, to: string) => call(from, root, 'POST', body(from, to));
  const accept = (owner: string, follower: string) => call(owner, `${root}/requests/personal/${owner}/accept`, 'POST', ref(follower));
  before(async () => {
    const { Hono } = await import('hono');
    const routes = await import('./profile-follows.js');
    const content = await import('./content.js');
    const auth = await import('./auth.js');
    const client = await import('../db/client.js');
    ({ db, sql } = client); schema = await import('../db/schema.js');
    app = new Hono(); app.route(root, routes.profileFollowRoutes);
    app.route('/v1/content', content.contentMobileRoutes);
    app.route('/v1/content', content.contentPublicRoutes);
    app.route('/auth', auth.createAuthRoutes());
    const { signToken } = await import('../lib/auth.js');
    await db.insert(schema.mobileUsers).values(ids.map((id, index) => ({ id, phone: `qa-follow-${id}`, displayName: `QA profile ${index}`, handle: `qa_${id.replaceAll('-', '').slice(0, 16)}` })));
    await db.insert(schema.providers).values({ id: BUSINESS, mobileUserId: B, providerKind: 'business', name: 'QA business', status: 'active' });
    await db.insert(schema.providerMemberships).values({ providerId: BUSINESS, mobileUserId: B, role: 'owner' });
    for (const id of ids) tokens[id] = await signToken({ sub: id, kind: 'mobile', email: '', name: 'QA', roles: [] });
  });
  beforeEach(async () => {
    const { inArray, eq } = await import('drizzle-orm');
    await db.delete(schema.profileFollows).where(inArray(schema.profileFollows.followerProfileId, ids));
    await db.delete(schema.profileBlocks).where(inArray(schema.profileBlocks.blockerProfileId, ids));
    await db.update(schema.mobileUsers).set({ isPrivate: false, isActive: true, showFollowerLists: true, allowFollowRequests: true }).where(inArray(schema.mobileUsers.id, ids));
    await db.update(schema.mobileUsers).set({ isPrivate: true }).where(eq(schema.mobileUsers.id, B));
  });
  after(async () => {
    if (!db) return;
    const { inArray } = await import('drizzle-orm');
    await db.delete(schema.profileFollows).where(inArray(schema.profileFollows.followerProfileId, ids));
    await db.delete(schema.profileBlocks).where(inArray(schema.profileBlocks.blockerProfileId, ids));
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, ids));
    await sql.end({ timeout: 5 });
  });
  it('public follows update both lists immediately, with relationship and identity fields', async () => {
    const result = await follow(A, C); assert.equal(result.status, 201);
    const following = await list(A, A, 'following');
    assert.equal(following.data.data.items[0].profile.id, C);
    assert.ok(following.data.data.items[0].profile.handle);
    assert.equal(following.data.data.items[0].relationship.isFollowing, true);
    const followers = await list(C, C);
    assert.equal(followers.data.data.items[0].profile.id, A);
    assert.equal(followers.data.data.items[0].canRemove, true);
    assert.equal(following.data.data.counts.following, 1);
    assert.equal(followers.data.data.counts.followers, 1);
  });
  it('private requests do not appear in accepted lists, and accept/repeated follow is idempotent', async () => {
    const pending = await follow(A, B);
    assert.equal(pending.status, 202);
    assert.equal(pending.data.data.followedCounts.pendingRequests, 0);
    assert.equal((await list(A, B)).status, 403);
    assert.equal((await list(A, A, 'following')).data.data.items.length, 0);
    assert.equal((await call(B, `${root}/requests/personal/${B}`)).data.data.length, 1);
    assert.equal((await accept(C, A)).status, 404);
    assert.equal((await accept(B, A)).status, 200);
    assert.equal((await accept(B, A)).status, 200);
    await follow(A, B);
    await db.update(schema.mobileUsers).set({ allowFollowRequests: false }).where(eq(schema.mobileUsers.id, B));
    assert.equal((await follow(A, B)).status, 201);
    assert.equal((await follow(C, B)).status, 403);
    const followers = await list(A, B);
    assert.equal(followers.status, 200);
    assert.equal(followers.data.data.items.length, 1);
    assert.equal(followers.data.data.counts.followers, 1);
  });
  it('decline, cancel, unfollow, and owner removal update both sides without unauthorized removal', async () => {
    await follow(A, B);
    await call(B, `${root}/requests/personal/${B}/reject`, 'POST', ref(A));
    assert.equal((await list(B, B)).data.data.items.length, 0);
    await follow(A, B);
    await call(A, root, 'DELETE', body(A, B));
    assert.equal((await call(B, `${root}/requests/personal/${B}`)).data.data.length, 0);
    await follow(A, B); await accept(B, A);
    assert.equal((await call(C, `${root}/followers/personal/${B}`, 'DELETE', ref(A))).status, 403);
    assert.equal((await call(B, `${root}/followers/personal/${B}`, 'DELETE', ref(A))).status, 200);
    assert.equal((await call(B, `${root}/followers/personal/${B}`, 'DELETE', ref(A))).status, 200);
    assert.equal((await list(A, A, 'following')).data.data.counts.following, 0);
    assert.equal((await list(A, B)).status, 403);
  });
  it('paginates without duplicates, rejects invalid cursors, and excludes deactivated and blocked profiles', async () => {
    await follow(A, C); await follow(A, D);
    await follow(A, B); await accept(B, A);
    const first = (await list(A, A, 'following', '?limit=1')).data.data;
    assert.equal(first.items.length, 1); assert.ok(first.nextCursor);
    const second = (await list(A, A, 'following', `?limit=1&cursor=${first.nextCursor}`)).data.data;
    assert.notEqual(first.items[0].profile.id, second.items[0].profile.id);
    assert.equal((await list(A, A, 'following', '?cursor=invalid')).status, 400);
    const { eq } = await import('drizzle-orm');
    await db.update(schema.mobileUsers).set({ isActive: false }).where(eq(schema.mobileUsers.id, D));
    assert.equal((await list(A, A, 'following')).data.data.counts.following, 2);
    await call(A, `${root}/blocks`, 'POST', body(A, C));
    assert.equal((await list(A, A, 'following')).data.data.items.length, 1);
    assert.equal((await follow(A, C)).status, 403);
    assert.equal((await list(C, A)).status, 404);
  });
  it('enforces hidden lists even for an approved follower and prevents forged viewer identities', async () => {
    await follow(A, B); await accept(B, A);
    await call(B, `${root}/privacy/personal/${B}`, 'PATCH', { showFollowerLists: false });
    assert.equal((await list(A, B)).status, 403);
    assert.equal((await list(B, B)).status, 200);
    assert.equal((await list(A, B, 'followers', `?viewerProfileId=${B}&viewerProfileType=personal`)).status, 403);
  });
  it('enforces private post access through direct links, feeds and profile grids before and after removal', async () => {
    const draft = await call(B, '/v1/content/drafts', 'POST', { contentType: 'flash', publisherProfileId: B, publisherProfileType: 'personal', visibility: 'public', metadata: { mediaType: 'text', caption: 'Private QA post' } });
    assert.equal(draft.status, 201, JSON.stringify(draft.data));
    const publish = await call(B, `/v1/content/drafts/${draft.data.draft.id}/publish`, 'POST', {});
    assert.equal(publish.status, 201, JSON.stringify(publish.data));
    const postId = publish.data.post.id;
    const direct = () => call(A, `/v1/content/posts/${postId}`);
    assert.equal((await direct()).status, 404);
    const anonymous = await app.request('/v1/content/feeds/flash');
    assert.equal(JSON.stringify(await anonymous.json()).includes(postId), false);
    await follow(A, B); assert.equal((await direct()).status, 404);
    await accept(B, A); assert.equal((await direct()).status, 200);
    await call(B, `${root}/followers/personal/${B}`, 'DELETE', ref(A));
    assert.equal((await direct()).status, 404);
    const feed = await call(A, '/v1/content/posts?format=flash');
    assert.equal(JSON.stringify(feed.data).includes(postId), false);
    const grid = await call(A, `/v1/content/profiles/personal/${B}/posts?format=flash`);
    assert.equal(JSON.stringify(grid.data).includes(postId), false);
  });
  it('paginates pending requests for the owner without granting list access to requesters', async () => {
    await follow(A, B); await follow(C, B); await follow(D, B);
    const first = await call(B, `${root}/requests/personal/${B}/page?limit=1`);
    assert.equal(first.status, 200); assert.equal(first.data.data.items.length, 1);
    const second = await call(B, `${root}/requests/personal/${B}/page?limit=1&cursor=${first.data.data.nextCursor}`);
    assert.notEqual(first.data.data.items[0].id, second.data.data.items[0].id);
    assert.equal((await call(A, `${root}/requests/personal/${B}/page`)).status, 403);
    assert.equal((await list(B, B)).data.data.counts.followers, 0);
  });
  it('serializes rapid duplicate follows, acceptance and privacy transitions', async () => {
    await Promise.all(Array.from({ length: 6 }, () => follow(A, C)));
    assert.equal((await list(C, C)).data.data.counts.followers, 1);
    await follow(A, B);
    await Promise.all([accept(B, A), accept(B, A)]);
    assert.equal((await list(B, B)).data.data.counts.followers, 1);
    await Promise.all([call(B, `${root}/privacy/personal/${B}`, 'PATCH', { isPrivate: false }), follow(D, B)]);
    assert.equal((await list(B, B)).data.data.counts.followers, 2);
  });
  it('keeps business connections profile-scoped and allows the owner to manage them from a personal identity', async () => {
    const privacy = await call(B, `${root}/privacy/business/${BUSINESS}`, 'PATCH', { isPrivate: true });
    assert.equal(privacy.status, 200, JSON.stringify(privacy.data));
    const businessBody = { ...body(C, BUSINESS), followedProfileType: 'business' };
    assert.equal((await call(C, root, 'POST', businessBody)).status, 202);
    assert.equal((await call(B, `${root}/requests/business/${BUSINESS}/accept`, 'POST', ref(C))).status, 200);
    const own = await call(B, `${root}/connections/business/${BUSINESS}/followers`);
    assert.equal(own.status, 200); assert.equal(own.data.data.isOwner, true);
    assert.equal(own.data.data.items[0].canRemove, true);
    assert.equal((await call(A, `${root}/connections/business/${BUSINESS}/followers`)).status, 403);
    assert.equal((await call(B, `${root}/followers/business/${BUSINESS}`, 'DELETE', ref(C))).status, 200);
  });
  it('social refresh events are scoped to affected accounts; global privacy refresh carries no profile data', async () => {
    const { viewerEventPayload } = await import('./content.js');
    const event = { type: 'social.changed' as const, postId: B, format: '', publisherProfileType: 'personal', publisherProfileId: B, at: new Date().toISOString(), affectedUserIds: [A, B] };
    assert.deepEqual(await viewerEventPayload(A, ref(A) as any, event), { type: 'social.changed' });
    assert.equal(await viewerEventPayload(C, ref(C) as any, event), null);
    assert.deepEqual(await viewerEventPayload(C, ref(C) as any, { ...event, affectedUserIds: undefined }), { type: 'social.changed' });
  });
  it('stores unique usernames and returns a safe conflict instead of taking another account’s handle', async () => {
    const payload = { displayName: 'QA updated', handle: `qa_unique_${A.slice(0, 8)}`, avatarUrl: null, bio: null, location: null, website: null };
    assert.equal((await call(A, '/auth/mobile/profile', 'PUT', payload)).status, 200);
    assert.equal((await call(C, '/auth/mobile/profile', 'PUT', payload)).status, 409);
  });
});
