import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
let mediaDirectory: string | undefined;
if (testDatabase) {
  process.env.DATABASE_URL = testDatabase;
  process.env.MEDIA_STORAGE = 'local';
  mediaDirectory = mkdtempSync(path.join(tmpdir(), 'anticlock-clip-commerce-'));
  process.env.MEDIA_LOCAL_DIR = mediaDirectory;
  process.env.API_PUBLIC_URL = 'http://localhost:4000';
  delete process.env.CONTENT_REQUIRE_REVIEW;
}
type Json = Record<string, any>;
type Cta = { entityType: 'product' | 'provider'; entityId: string; ctaLabel: 'Buy' | 'Book' } | null;
type Fixture = { id: string; label: string; providerId: string | null; expected: Cta };

// Opt-in only: all fixtures are UUID-tagged and removed from the migrated test database.
describe('business Clip Buy / Book across mobile surfaces (PostgreSQL integration)', { skip: !testDatabase }, () => {
  const run = randomUUID();
  const owner = randomUUID(); const viewer = randomUUID(); const otherOwner = randomUUID();
  const business = randomUUID(); const otherBusiness = randomUUID(); const individual = randomUUID();
  const treeId = `clip-commerce-tree-${run}`; const serviceCategory = `clip-commerce-service-${run}`; const productCategory = randomUUID();
  const mediaIds: string[] = []; const productIds: string[] = []; const containers: string[] = []; const fixtures: Fixture[] = [];
  const tokens: Record<string, string> = {};
  let app: any; let db: any; let sqlClient: any; let schema: any;
  let publishedProduct: string; let publishedClip: Json; let conditionalProduct: string; let conditionalClip: Fixture;
  const book = (id = business): Cta => ({ entityType: 'provider', entityId: id, ctaLabel: 'Book' });
  const buy = (id: string): Cta => ({ entityType: 'product', entityId: id, ctaLabel: 'Buy' });

  async function call(userId: string, method: string, url: string, body?: unknown) {
    const response = await app.request(url, { method, headers: { Authorization: `Bearer ${tokens[userId]}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() as Json };
  }
  async function asset(kind: 'video' | 'image' = 'video', changes: Json = {}) {
    const id = randomUUID(); mediaIds.push(id);
    await db.insert(schema.mediaAssets).values({ id, kind, storageProvider: 'local', storageKey: `public/content-${owner}/${id}/final.${kind === 'video' ? 'mp4' : 'png'}`, bucket: 'public-media', mimeType: kind === 'video' ? 'video/mp4' : 'image/png', byteSize: 1000, durationMs: kind === 'video' ? 10000 : null, width: 1080, height: 1920, accessLevel: 'public', processingStatus: 'ready', moderationStatus: 'approved', checksumSha256: `${run}-${id}`, ...changes });
    return id;
  }
  async function product(media: string[], changes: Json = {}) {
    const id = randomUUID(); productIds.push(id);
    await db.insert(schema.products).values({ id, categoryId: productCategory, slug: `clip-commerce-${id}`, name: `Product ${id}`, price: 14900, inventory: 10, ownerMobileUserId: owner, authorProviderId: business, status: 'published', reviewStatus: 'approved', requestedVisibility: 'public', ...changes });
    if (media.length) await db.insert(schema.productImages).values(media.map(mediaAssetId => ({ productId: id, mediaAssetId })));
    return id;
  }
  async function clip(label: string, media: string[], expected: Cta, options: { authorProviderId?: string | null; changes?: Json } = {}) {
    const provider = options.authorProviderId === undefined ? business : options.authorProviderId;
    const fixture = { id: randomUUID(), label, providerId: provider, expected }; fixtures.push(fixture);
    await db.insert(schema.contentPosts).values({ id: fixture.id, createdByMobileUserId: owner, authorMobileUserId: provider ? null : owner, authorProviderId: provider, providerId: provider, businessId: provider === individual ? null : provider, serviceCategoryId: provider ? serviceCategory : null, format: 'clip', mediaType: 'video', caption: `${run}: ${label}`, mediaIds: media, duplicateClusterId: `${run}:${fixture.id}`, status: 'published', visibility: 'public', ...options.changes });
    return fixture;
  }
  async function surface(url: string) {
    const result = await call(viewer, 'GET', url);
    assert.equal(result.status, 200, JSON.stringify(result.body)); assert.ok(Array.isArray(result.body.items), url);
    return result.body;
  }
  function assertCtas(items: Json[], expected: Fixture[], label: string) {
    const byId = new Map(items.map(item => [item.id, item]));
    for (const fixture of expected) {
      const item = byId.get(fixture.id); assert.ok(item, `${label} contains ${fixture.label}`);
      assert.deepEqual(item.cta, fixture.expected, `${label}: ${fixture.label}`);
      if (fixture.providerId) assert.equal(item.publisher.id, fixture.providerId, 'CTA follows the canonical publishing business');
    }
  }

  before(async () => {
    const { Hono } = await import('hono'); const { contentMobileRoutes } = await import('./content.js'); const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js'); db = client.db; sqlClient = client.sql; schema = await import('../db/schema.js');
    app = new Hono().route('/v1/content', contentMobileRoutes);
    await db.insert(schema.mobileUsers).values([{ id: owner, phone: `clip-owner-${run}`, displayName: 'Business owner' }, { id: viewer, phone: `clip-viewer-${run}`, displayName: 'Unrelated viewer' }, { id: otherOwner, phone: `clip-other-${run}`, displayName: 'Other owner' }]);
    await db.insert(schema.serviceTrees).values({ id: treeId, slug: treeId, name: 'Clip commerce test' });
    await db.insert(schema.serviceCategories).values({ id: serviceCategory, treeId, name: 'Clip commerce service' });
    await db.insert(schema.productCategories).values({ id: productCategory, slug: `clip-commerce-${run}`, name: 'Clip commerce products', status: 'published' });
    await db.insert(schema.providers).values([{ id: business, mobileUserId: owner, providerKind: 'business', name: 'Publishing business' }, { id: otherBusiness, mobileUserId: otherOwner, providerKind: 'business', name: 'Unrelated business' }, { id: individual, mobileUserId: owner, providerKind: 'individual', name: 'Individual provider' }]);
    await db.insert(schema.providerMemberships).values({ providerId: business, mobileUserId: owner, role: 'owner' });
    await db.insert(schema.providerServiceOfferings).values([business, otherBusiness, individual].map(providerId => ({ providerId, categoryId: serviceCategory })));
    for (const id of [owner, viewer]) tokens[id] = await signToken({ kind: 'mobile', sub: id, name: 'Commerce test', email: '', roles: [], permissions: [] });

    // The primary positive fixture goes through real draft, attach and publish routes.
    const video = await asset(); publishedProduct = await product([video]);
    const created = await call(owner, 'POST', '/v1/content/drafts', { contentType: 'clip', publisherProfileId: business, publisherProfileType: 'business', visibility: 'public', metadata: { mediaType: 'video', caption: `${run}: published product video` } });
    assert.equal(created.status, 201, JSON.stringify(created.body)); const container = created.body.draft.id; containers.push(container);
    const attached = await call(owner, 'PATCH', `/v1/content/drafts/${container}`, { mediaIds: [video] }); assert.equal(attached.status, 200, JSON.stringify(attached.body));
    const published = await call(owner, 'POST', `/v1/content/drafts/${container}/publish`, {}); assert.equal(published.status, 201, JSON.stringify(published.body)); publishedClip = published.body.post;
    fixtures.push({ id: publishedClip.id, label: 'published product video', providerId: business, expected: buy(publishedProduct) });
    await clip('business video with no product', [await asset()], book());
    const image = await asset('image'); await product([image]);
    await clip('image-only product association', [await asset(), image], book(), { changes: { thumbnailMediaId: image } });
    const foreign = await asset(); await product([foreign], { ownerMobileUserId: otherOwner, authorProviderId: otherBusiness }); await clip('same video on another business product', [foreign], book());
    for (const [label, changes] of [['followers-only product', { requestedVisibility: 'followers_only' }], ['draft product', { status: 'draft' }], ['pending-review product', { reviewStatus: 'pending_review' }], ['rejected product', { reviewStatus: 'rejected' }]] as const) {
      const media = await asset(); await product([media], changes); await clip(label, [media], book());
    }
    const ambiguous = await asset(); await product([ambiguous]); await product([ambiguous]); await clip('one video shared by multiple products', [ambiguous], book());
    const one = await asset(); const two = await asset(); await product([one]); await product([two]); await clip('different videos identify multiple products', [one, two], book());
    const duplicate = await asset(); const duplicateProduct = await product([duplicate, duplicate]); await clip('duplicate rows for the same product', [duplicate], buy(duplicateProduct));
    for (const [label, changes] of [['processing product video', { processingStatus: 'processing' }], ['archived product video', { archivedAt: new Date() }], ['deleted product video', { deletedAt: new Date() }], ['rejected product video', { moderationStatus: 'rejected' }]] as const) {
      const linked = await asset('video', changes); await product([linked]); await clip(label, [await asset(), linked], book());
    }
    await clip('individual provider remains a business publisher', [await asset()], book(individual), { authorProviderId: individual });
    await clip('personal video does not inherit provider CTA metadata', [video], null, { authorProviderId: null, changes: { providerId: business, businessId: business, serviceCategoryId: serviceCategory } });
    const conditionalVideo = await asset(); conditionalProduct = await product([conditionalVideo]); conditionalClip = await clip('eligibility changes after publication', [conditionalVideo], buy(conditionalProduct));
  });

  after(async () => {
    if (!db) return;
    try {
      const { inArray, eq } = await import('drizzle-orm');
      if (fixtures.length) await db.delete(schema.contentPosts).where(inArray(schema.contentPosts.id, fixtures.map(item => item.id)));
      if (containers.length) await db.delete(schema.contentContainers).where(inArray(schema.contentContainers.id, containers));
      if (productIds.length) await db.delete(schema.products).where(inArray(schema.products.id, productIds));
      await db.delete(schema.providers).where(inArray(schema.providers.id, [business, otherBusiness, individual]));
      await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [owner, viewer, otherOwner]));
      if (mediaIds.length) await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, mediaIds));
      await db.delete(schema.productCategories).where(eq(schema.productCategories.id, productCategory));
      await db.delete(schema.serviceCategories).where(eq(schema.serviceCategories.id, serviceCategory)); await db.delete(schema.serviceTrees).where(eq(schema.serviceTrees.id, treeId));
    } finally { await sqlClient.end({ timeout: 5 }); if (mediaDirectory) await rm(mediaDirectory, { recursive: true, force: true }); }
  });

  it('emits Buy when the canonical product Clip is read after the real publish flow', async () => {
    const result = await call(viewer, 'GET', `/v1/content/posts/${publishedClip.id}`);
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.deepEqual(result.body.post.cta, buy(publishedProduct));
    assert.equal(result.body.post.publisher.id, business); assert.equal(result.body.post.publisher.type, 'business');
  });
  it('preserves Buy / Book / null in the canonical feed without image or business-owner guesses', async () => {
    const items: Json[] = []; let cursor: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const result = await surface(`/v1/content/feeds/clip?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
      items.push(...result.items); if (!result.nextCursor) break; cursor = result.nextCursor;
    }
    assertCtas(items, fixtures, 'canonical feed');
  });
  it('returns the same associations on the publishing business profile', async () => {
    const result = await surface(`/v1/content/profiles/business/${business}/posts?format=clip&limit=50`);
    assertCtas(result.items, fixtures.filter(item => item.providerId === business), 'business profile');
  });
  it('keeps provider-first Clips consistent, including individual providers and personal fallback safety', async () => {
    const result = await surface(`/v1/content/feeds/provider-clips?providerId=${business}&serviceCategoryId=${serviceCategory}&limit=50`);
    assertCtas(result.items, fixtures, 'provider Clips');
    const solo = result.items.find((item: Json) => item.publisher.id === individual);
    assert.ok(solo); assert.equal(solo.publisher.type, 'business'); assert.equal(solo.businessId, null); assert.deepEqual(solo.cta, book(individual));
  });
  it('leaves personal-profile CTAs empty and preserves the same targets in single-Clip reads', async () => {
    const personal = fixtures.find(item => item.providerId === null)!;
    const profile = await surface(`/v1/content/profiles/personal/${owner}/posts?format=clip&limit=50`); assertCtas(profile.items, [personal], 'personal profile');
    for (const fixture of [fixtures[0]!, fixtures[1]!, personal]) {
      const result = await call(viewer, 'GET', `/v1/content/posts/${fixture.id}`); assert.equal(result.status, 200, JSON.stringify(result.body)); assert.deepEqual(result.body.post.cta, fixture.expected);
    }
  });
  it('rechecks product visibility, moderation and publishing state instead of keeping a stale Buy target', async () => {
    const { eq } = await import('drizzle-orm');
    for (const changes of [{ requestedVisibility: 'followers_only' }, { requestedVisibility: 'public', reviewStatus: 'rejected' }, { reviewStatus: 'approved', status: 'draft' }]) {
      await db.update(schema.products).set(changes).where(eq(schema.products.id, conditionalProduct));
      const result = await call(viewer, 'GET', `/v1/content/posts/${conditionalClip.id}`); assert.equal(result.status, 200); assert.deepEqual(result.body.post.cta, book());
    }
    await db.update(schema.products).set({ requestedVisibility: 'public', reviewStatus: 'approved', status: 'published' }).where(eq(schema.products.id, conditionalProduct));
    const result = await call(viewer, 'GET', `/v1/content/posts/${conditionalClip.id}`); assert.equal(result.status, 200); assert.deepEqual(result.body.post.cta, buy(conditionalProduct));
  });
});
