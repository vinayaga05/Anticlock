/**
 * DB-backed Explore flow. CI/local runners opt in with TEST_DATABASE_URL after
 * applying migrations. This verifies the same route surfaces used by mobile
 * and Admin rather than calling service internals.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.MEDIA_STORAGE = 'local';
  process.env.MEDIA_LOCAL_DIR = `/tmp/anticlock-explore-${randomUUID()}`;
  process.env.API_PUBLIC_URL = 'http://localhost:4000';
}

type Json = Record<string, any>;

describe('Explore event and product flow (integration)', { skip: !TEST_DATABASE_URL }, () => {
  const run = randomUUID().slice(0, 8);
  const OWNER = randomUUID();
  const FOLLOWER = randomUUID();
  const STRANGER = randomUUID();
  const ADMIN = randomUUID();
  const MEDIA = randomUUID();
  const PRODUCT_CATEGORY = randomUUID();
  const treeId = `explore-tree-${run}`;
  const eventCategory = `explore-event-${run}`;
  const tokens: Record<string, string> = {};
  let adminToken = '';
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let sqlClient: any;
  let schema: any;
  const productIds: string[] = [];
  const eventStartsAt = new Date(Date.now() + 7 * 86_400_000);

  async function call(who: string, method: string, path: string, body?: unknown) {
    const response = await app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${who === 'ADMIN' ? adminToken : tokens[who]}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, json: text ? JSON.parse(text) as Json : {} };
  }

  function eventInput(title: string, visibility: 'public' | 'followers_only') {
    return {
      title,
      description: `${title} description`,
      categoryId: eventCategory,
      tags: ['integration'],
      startsAt: eventStartsAt.toISOString(),
      endsAt: new Date(eventStartsAt.getTime() + 3_600_000).toISOString(),
      timezone: 'Asia/Kolkata',
      venueType: 'physical',
      location: { name: 'Test ground', address: '1 Test Road, Chennai' },
      onlineUrl: null,
      ticketType: 'free',
      capacity: 1,
      price: 0,
      currency: 'INR',
      contact: { name: 'Owner', phone: '9876543210' },
      requestedVisibility: visibility,
      mediaIds: [MEDIA],
    };
  }

  function productInput(name: string) {
    return {
      categoryId: PRODUCT_CATEGORY,
      name,
      description: `${name} description`,
      price: 50_00,
      compareAtPrice: 60_00,
      inventory: 2,
      imageIds: [MEDIA],
      tags: ['integration'],
      requestedVisibility: 'public',
      deliveryMethods: ['shipping'],
      pickupDetails: null,
      contact: { name: 'Owner', phone: '9876543210' },
    };
  }

  before(async () => {
    const { Hono } = await import('hono');
    const explore = await import('./explore.js');
    const shop = await import('./shop.js');
    const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js');
    db = client.db;
    sqlClient = client.sql;
    schema = await import('../db/schema.js');
    const hono = new Hono();
    hono.route('/v1/explore', explore.exploreMobileRoutes);
    hono.route('/v1/shop', shop.shopMobileRoutes);
    hono.route('/admin/explore', explore.exploreAdminRoutes);
    hono.route('/admin/shop', shop.shopAdminRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: OWNER, phone: `+91owner${run}`, displayName: 'Explore Owner' },
      { id: FOLLOWER, phone: `+91follow${run}`, displayName: 'Explore Follower' },
      { id: STRANGER, phone: `+91strange${run}`, displayName: 'Explore Stranger' },
    ]);
    await db.insert(schema.users).values({ id: ADMIN, email: `explore-${run}@example.com`, name: 'Reviewer', passwordHash: 'x' });
    await db.insert(schema.serviceTrees).values({ id: treeId, slug: treeId, name: 'Explore tree' });
    await db.insert(schema.serviceCategories).values({ id: eventCategory, treeId, name: 'Events' });
    await db.insert(schema.productCategories).values({ id: PRODUCT_CATEGORY, slug: `explore-${run}`, name: 'Gear' });
    await db.insert(schema.mediaAssets).values({
      id: MEDIA,
      kind: 'image',
      storageProvider: 'local',
      storageKey: `uploads/content-${OWNER}/cover.png`,
      bucket: 'private-documents',
      mimeType: 'image/png',
      byteSize: 68,
      accessLevel: 'private',
      processingStatus: 'ready',
      moderationStatus: 'not_required',
    });
    await db.insert(schema.profileFollows).values({
      followerProfileId: FOLLOWER,
      followerProfileType: 'personal',
      followedProfileId: OWNER,
      followedProfileType: 'personal',
      status: 'accepted',
      acceptedAt: new Date(),
    });

    for (const [label, id] of [['OWNER', OWNER], ['FOLLOWER', FOLLOWER], ['STRANGER', STRANGER]] as const) {
      tokens[label] = await signToken({ sub: id, email: '', name: label, roles: [], kind: 'mobile' });
    }
    adminToken = await signToken({
      sub: ADMIN, email: `explore-${run}@example.com`, name: 'Reviewer', roles: [],
      permissions: ['catalog.read', 'moderation.act'], kind: 'admin',
    });
  });

  after(async () => {
    if (!db) return;
    try {
      const { eq, inArray } = await import('drizzle-orm');
      if (productIds.length) await db.delete(schema.products).where(inArray(schema.products.id, productIds));
      await db.delete(schema.exploreEvents).where(eq(schema.exploreEvents.ownerMobileUserId, OWNER));
      await db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, MEDIA));
      await db.delete(schema.productCategories).where(eq(schema.productCategories.id, PRODUCT_CATEGORY));
      await db.delete(schema.serviceCategories).where(eq(schema.serviceCategories.id, eventCategory));
      await db.delete(schema.serviceTrees).where(eq(schema.serviceTrees.id, treeId));
      await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [OWNER, FOLLOWER, STRANGER]));
      await db.delete(schema.users).where(eq(schema.users.id, ADMIN));
    } finally {
      await sqlClient.end({ timeout: 5 });
    }
  });

  it('enforces follower visibility, review transitions, registration capacity, and resubmission', async () => {
    const created = await call('OWNER', 'POST', '/v1/explore/events', eventInput(`Follower run ${run}`, 'followers_only'));
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const eventId = created.json.event.id;
    assert.equal((await call('OWNER', 'POST', `/v1/explore/events/${eventId}/submit`)).status, 200);

    const followerFeed = await call('FOLLOWER', 'GET', '/v1/explore/events?following=true');
    const strangerFeed = await call('STRANGER', 'GET', '/v1/explore/events');
    assert.ok(followerFeed.json.events.some((event: Json) => event.id === eventId));
    assert.ok(!strangerFeed.json.events.some((event: Json) => event.id === eventId));

    const queue = await call('ADMIN', 'GET', '/admin/explore/events?status=pending_review');
    assert.ok(queue.json.events.some((event: Json) => event.id === eventId));
    assert.equal((await call('ADMIN', 'POST', `/admin/explore/events/${eventId}/review`, { action: 'approve' })).status, 200);

    const registration = await call('FOLLOWER', 'POST', `/v1/explore/events/${eventId}/register`);
    assert.equal(registration.status, 200, JSON.stringify(registration.json));
    assert.equal(registration.json.event.registrationCount, 1);
    assert.equal((await call('STRANGER', 'POST', `/v1/explore/events/${eventId}/register`)).status, 404);

    const revision = await call('OWNER', 'POST', '/v1/explore/events', eventInput(`Revision event ${run}`, 'public'));
    const revisionId = revision.json.event.id;
    await call('OWNER', 'POST', `/v1/explore/events/${revisionId}/submit`);
    assert.equal((await call('ADMIN', 'POST', `/admin/explore/events/${revisionId}/review`, { action: 'request_changes', reason: 'Clarify the venue' })).status, 200);
    assert.equal((await call('OWNER', 'PATCH', `/v1/explore/events/${revisionId}`, { description: 'Updated venue details for everyone.' })).status, 200);
    const resubmitted = await call('OWNER', 'POST', `/v1/explore/events/${revisionId}/submit`);
    assert.equal(resubmitted.json.event.reviewVersion, 2);
    const duplicate = await call('OWNER', 'POST', '/v1/explore/events', eventInput(`Revision event ${run}`, 'public'));
    assert.equal(duplicate.status, 409);
  });

  it('keeps public products hidden until approval and persists saved items', async () => {
    const created = await call('OWNER', 'POST', '/v1/shop/products', productInput(`Bands ${run}`));
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const productId = created.json.product.id;
    productIds.push(productId);
    assert.equal((await call('OWNER', 'POST', `/v1/shop/products/${productId}/submit`)).status, 200);
    const before = await call('STRANGER', 'GET', '/v1/shop/products/explore');
    assert.ok(!before.json.products.some((product: Json) => product.id === productId));
    assert.equal((await call('ADMIN', 'POST', `/admin/shop/products/${productId}/review`, { action: 'approve' })).status, 200);
    const afterApproval = await call('STRANGER', 'GET', `/v1/shop/products/explore?search=${run}`);
    assert.ok(afterApproval.json.products.some((product: Json) => product.id === productId));
    assert.equal((await call('STRANGER', 'POST', `/v1/shop/products/${productId}/save`)).status, 200);
    const saved = await call('STRANGER', 'GET', '/v1/shop/products/saved');
    assert.ok(saved.json.products.some((product: Json) => product.id === productId));

    const { eq, and } = await import('drizzle-orm');
    const notifications = await db.select().from(schema.notifications).where(and(
      eq(schema.notifications.mobileUserId, OWNER),
      eq(schema.notifications.type, 'explore_approved'),
    ));
    assert.ok(notifications.length >= 2);
  });
});
