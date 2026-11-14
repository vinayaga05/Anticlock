import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const testDatabase = process.env.TEST_DATABASE_URL?.trim();
const mediaDirectory = path.join(tmpdir(), `knock-business-profile-test-${randomUUID()}`);
if (testDatabase) {
  process.env.DATABASE_URL = testDatabase;
  process.env.MEDIA_STORAGE = 'local';
  process.env.MEDIA_LOCAL_DIR = mediaDirectory;
  process.env.API_PUBLIC_URL = 'http://localhost:4000';
  delete process.env.REDIS_URL;
}
type Json = Record<string, any>;

describe('business storefront flow (PostgreSQL)', { skip: !testDatabase }, () => {
  const actors = Object.fromEntries(['owner', 'admin', 'creator', 'analyst', 'customer', 'other', 'inactive', 'inactiveOwner'].map(name => [name, randomUUID()]));
  const actorIds = Object.values(actors);
  const tokens: Record<string, string> = {};
  const providerId = randomUUID(), applicationId = randomUUID(), viewerBusinessId = randomUUID();
  const providerIds = [providerId, viewerBusinessId], applicationIds = [applicationId];
  const runId = randomUUID();
  const treeId = `business-tree-${runId}`, categoryId = `business-service-${runId}`, secondCategory = `business-second-${runId}`, hiddenCategory = `business-hidden-${runId}`;
  const base = `/v1/business-profiles/${providerId}`;
  const monday = '2100-01-04', tuesday = '2100-01-05';
  const at = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`).toISOString();
  const assets = Object.fromEntries(['logo', 'cover', 'gallery', 'private', 'pending', 'rejected', 'document', 'foreign', 'review'].map(name => [name, randomUUID()]));
  const bookingIds: string[] = [];
  const completed = [randomUUID(), randomUUID(), randomUUID()];
  const unfinished = randomUUID(), ownerBooking = randomUUID(), memberBooking = randomUUID(), wrongBusinessBooking = randomUUID();
  let app: any, db: any, sqlClient: any, schema: any;
  let offeringId = '';
  const publicProfile = {
    common: {
      basic: { mobile: '9876543210', email: 'studio@example.test', website: 'https://example.test' },
      location: { address: '12 Lake Road', city: 'Chennai', area: 'Adyar', pincode: '600020', latitude: 13.001, longitude: 80.25 },
      availability: { workingDays: ['Mon'], openingTime: '09:00', closingTime: '12:00', temporarilyUnavailable: false },
      services: { atLocation: true, homeVisit: false, online: false },
      profile: { description: 'Public studio description for customers.', tagline: 'Make time to move', logoMediaId: assets.logo, coverMediaIds: [assets.cover], galleryMediaIds: [assets.gallery, assets.private, assets.pending, assets.rejected, assets.document] },
    },
    documents: { aadhaarNumber: 'PRIVATE-AADHAAR-SENTINEL' }, dynamicPayload: { bankAccount: 'PRIVATE-BANK-SENTINEL' },
  };

  async function call(who: string | null, method: string, url = base, value?: unknown) {
    const response = await app.request(url, { method, headers: {
      ...(who ? { authorization: `Bearer ${tokens[who]}` } : {}),
      ...(value !== undefined ? { 'content-type': 'application/json' } : {}),
    }, body: value === undefined ? undefined : JSON.stringify(value) });
    const body = await response.text();
    return { status: response.status, json: body ? JSON.parse(body) as Json : {} };
  }
  async function expectStatus(who: string | null, method: string, url: string, status: number, value?: unknown) {
    const result = await call(who, method, url, value);
    assert.equal(result.status, status, JSON.stringify(result.json));
    return result.json;
  }
  async function createProvider(ownerId: string, appStatus = 'approved', status = 'active') {
    const id = randomUUID(), sourceId = randomUUID();
    providerIds.push(id); applicationIds.push(sourceId);
    await db.insert(schema.providerApplications).values({ id: sourceId, mobileUserId: ownerId, providerKind: 'business', status: appStatus });
    await db.insert(schema.providers).values({ id, mobileUserId: ownerId, sourceApplicationId: sourceId, providerKind: 'business', name: 'Additional studio', status, publicProfile });
    const { eq } = await import('drizzle-orm');
    await db.update(schema.providerApplications).set({ providerId: id }).where(eq(schema.providerApplications.id, sourceId));
    return id;
  }
  function bookingValue(id: string, mobileUserId: string, status = 'completed', businessId = providerId) {
    return { id, mobileUserId, providerId: businessId, categoryId, category: 'appointment', serviceMode: 'center', status,
      startsAt: new Date('2026-01-01T03:30:00Z'), endsAt: new Date('2026-01-01T04:30:00Z'), durationMinutes: 60, amount: 550,
      paymentStatus: status === 'completed' ? 'paid' : 'pending', detail: { serviceTitle: 'Studio session' },
      ...(status === 'completed' ? { completedAt: new Date('2026-01-01T04:30:00Z') } : {}),
    };
  }
  function bookingRequest(date = monday, time = '09:00') {
    return { providerId, categoryId, category: 'appointment', serviceMode: 'center', startsAt: at(date, time), durationMinutes: 60, amount: 1, detail: { serviceTitle: 'Studio session' } };
  }
  const availabilityUrl = (date = monday, mode = 'center') => `${base}/availability?date=${date}&categoryId=${categoryId}&serviceMode=${mode}`;
  const withViewer = (url: string, id = viewerBusinessId, type = 'business') => `${url}${url.includes('?') ? '&' : '?'}viewerProfileId=${id}&viewerProfileType=${type}`;

  before(async () => {
    const { Hono } = await import('hono');
    const { businessProfileRoutes } = await import('./business-profiles.js');
    const { bookingMobileRoutes } = await import('./bookings.js');
    const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js'); db = client.db; sqlClient = client.sql;
    schema = await import('../db/schema.js');
    app = new Hono().route('/v1/business-profiles', businessProfileRoutes).route('/v1/bookings', bookingMobileRoutes);
    await db.insert(schema.mobileUsers).values(Object.entries(actors).map(([name, id]) => ({ id, phone: `bp-${name}-${runId}`, displayName: `${name} display`, avatarUrl: null, isActive: !name.startsWith('inactive') })));
    for (const [name, sub] of Object.entries(actors)) tokens[name] = await signToken({ kind: 'mobile', sub, name, email: '', roles: [] });
    tokens.systemAdmin = await signToken({ kind: 'admin', sub: randomUUID(), name: 'System admin', email: '', roles: [] });
    tokens.invalid = 'invalid-token';
    await db.insert(schema.serviceTrees).values({ id: treeId, slug: treeId, name: 'Business profile tree' });
    await db.insert(schema.serviceCategories).values([
      { id: categoryId, treeId, name: 'Studio session', actionType: 'appointment' },
      { id: secondCategory, treeId, name: 'Online session', actionType: 'appointment' },
      { id: hiddenCategory, treeId, name: 'Unpublished session', actionType: 'appointment', status: 'draft' },
    ]);
    await db.insert(schema.providerApplications).values({ id: applicationId, mobileUserId: actors.owner, providerKind: 'business', status: 'approved', dynamicPayload: { aadhaarNumber: 'APPLICATION-KYC-SENTINEL' }, reviewNotes: 'PRIVATE-REVIEW-NOTES' });
    await db.insert(schema.providers).values({ id: providerId, mobileUserId: actors.owner, sourceApplicationId: applicationId, providerKind: 'business', name: 'Public studio', publicProfile });
    const { eq } = await import('drizzle-orm');
    await db.update(schema.providerApplications).set({ providerId }).where(eq(schema.providerApplications.id, applicationId));
    await db.insert(schema.providers).values({ id: viewerBusinessId, mobileUserId: actors.customer, providerKind: 'business', name: 'Customer business' });
    await db.insert(schema.providerMemberships).values([
      { providerId, mobileUserId: actors.owner, role: 'owner' }, { providerId, mobileUserId: actors.admin, role: 'admin' },
      { providerId, mobileUserId: actors.creator, role: 'content_creator' }, { providerId, mobileUserId: actors.analyst, role: 'analyst' },
      { providerId: viewerBusinessId, mobileUserId: actors.customer, role: 'owner' },
    ]);
    const [offering] = await db.insert(schema.providerServiceOfferings).values({ providerId, categoryId, pricingStartsAt: 550, metadata: { durationMinutes: 60, modes: ['center'], available: true, retainedField: 'keep-me' } }).returning();
    offeringId = offering.id;
    await db.insert(schema.mediaAssets).values(Object.entries(assets).map(([name, id]) => ({ id, kind: name === 'document' ? 'document' : 'image', storageProvider: 'local', bucket: name === 'private' ? 'private-documents' : 'public-media',
      storageKey: name === 'logo' ? `public/provider-app-${applicationId}/${id}/logo.png` : name === 'private' ? `private/provider-app-${applicationId}/${id}/aadhaar.png` : `public/content-${name === 'foreign' ? actors.other : name === 'review' ? actors.customer : actors.owner}/${id}/photo.png`,
      accessLevel: name === 'private' ? 'private' : 'public', processingStatus: name === 'pending' ? 'initiated' : 'ready', moderationStatus: name === 'rejected' ? 'rejected' : 'approved', mimeType: 'image/png', byteSize: 100,
    })));
    bookingIds.push(...completed, unfinished, ownerBooking, memberBooking, wrongBusinessBooking);
    await db.insert(schema.bookings).values([
      bookingValue(completed[0]!, actors.customer!), bookingValue(completed[1]!, actors.customer!), bookingValue(completed[2]!, actors.other!),
      bookingValue(unfinished, actors.customer!, 'confirmed'), bookingValue(ownerBooking, actors.owner!), bookingValue(memberBooking, actors.creator!),
      bookingValue(wrongBusinessBooking, actors.customer!, 'completed', viewerBusinessId),
    ]);
  });

  after(async () => {
    if (!db) return;
    const { inArray, or } = await import('drizzle-orm');
    try {
      await db.delete(schema.profileBlocks).where(or(inArray(schema.profileBlocks.blockerProfileId, [...actorIds, ...providerIds]), inArray(schema.profileBlocks.blockedProfileId, [...actorIds, ...providerIds])));
      await db.delete(schema.profileFollows).where(or(inArray(schema.profileFollows.followerProfileId, [...actorIds, ...providerIds]), inArray(schema.profileFollows.followedProfileId, [...actorIds, ...providerIds])));
      await db.delete(schema.mediaUsages).where(inArray(schema.mediaUsages.mediaId, Object.values(assets)));
      await db.delete(schema.mediaAssets).where(inArray(schema.mediaAssets.id, Object.values(assets)));
      await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, actorIds));
      await db.delete(schema.serviceTrees).where(inArray(schema.serviceTrees.id, [treeId]));
    } finally { await sqlClient.end({ timeout: 5 }); await rm(mediaDirectory, { recursive: true, force: true }); }
  });

  it('serves an approved business publicly using only safe public fields and ready media', async () => {
    const { business } = await expectStatus(null, 'GET', base, 200);
    const { BusinessProfileSchema } = await import('@anticlock/contracts');
    BusinessProfileSchema.parse(business);
    assert.equal(business.name, 'Public studio'); assert.equal(business.verified, true);
    assert.equal(business.viewer.role, null); assert.equal(business.viewer.canManage, false); assert.equal(business.viewer.relationship, null);
    assert.equal(business.contact.phone, '9876543210'); assert.equal(business.location.city, 'Chennai');
    assert.match(business.avatarUrl, /logo\.png/); assert.match(business.coverUrl, /photo\.png/);
    assert.deepEqual(business.gallery.map((row: Json) => row.id).sort(), [assets.cover, assets.gallery].sort());
    assert.deepEqual(business.services.map((row: Json) => row.categoryId), [categoryId]);
    assert.equal(business.services[0].price, 550); assert.equal(business.services[0].durationMinutes, 60);
    const serialized = JSON.stringify(business);
    for (const secret of ['PRIVATE-', 'APPLICATION-KYC', 'sourceApplicationId', 'dynamicPayload', 'reviewNotes', 'aadhaar', assets.private, assets.pending, assets.rejected, assets.document]) assert.ok(!serialized.includes(secret), secret);
  });

  it('hides unapproved, suspended, owner-disabled, missing-source and mismatched-source businesses', async () => {
    const hidden = [await createProvider(actors.owner!, 'submitted'), await createProvider(actors.owner!, 'rejected'), await createProvider(actors.owner!, 'approved', 'suspended'), await createProvider(actors.inactiveOwner!)];
    const missingSource = randomUUID(); providerIds.push(missingSource);
    await db.insert(schema.providers).values({ id: missingSource, mobileUserId: actors.owner, providerKind: 'business', name: 'Missing approval source' });
    hidden.push(missingSource);
    const mismatched = await createProvider(actors.other!); hidden.push(mismatched);
    const { eq } = await import('drizzle-orm');
    await db.update(schema.providers).set({ mobileUserId: actors.owner }).where(eq(schema.providers.id, mismatched));
    for (const id of hidden) for (const who of [null, 'owner']) await expectStatus(who, 'GET', `/v1/business-profiles/${id}`, 404);
    // A direct booking request cannot bypass a known failed approval gate.
    for (const id of [hidden[0], hidden[1], mismatched]) {
      await db.insert(schema.providerServiceOfferings).values({ providerId: id, categoryId, pricingStartsAt: 550, metadata: { durationMinutes: 60, modes: ['center'], available: true } });
      await expectStatus('customer', 'POST', '/v1/bookings', 404, { ...bookingRequest(), providerId: id });
      assert.deepEqual(await db.select().from(schema.bookings).where(eq(schema.bookings.providerId, id)), []);
    }
    await expectStatus(null, 'GET', '/v1/business-profiles/not-a-uuid', 404);
    await expectStatus(null, 'GET', `/v1/business-profiles/${randomUUID()}`, 404);
  });

  it('requires active mobile sessions for mutations and keeps owner, admin, creator and analyst capabilities distinct', async () => {
    await expectStatus(null, 'PUT', `${base}/save`, 401, { saved: true });
    await expectStatus('systemAdmin', 'GET', base, 403);
    await expectStatus('invalid', 'GET', base, 401);
    await expectStatus('inactive', 'GET', base, 403);
    await expectStatus(null, 'GET', `${base}/analytics`, 401);
    for (const [who, flags] of Object.entries({ owner: [true, true, true], admin: [true, true, true], creator: [false, true, false], analyst: [false, false, true], customer: [false, false, false] })) {
      const { business } = await expectStatus(who, 'GET', base, 200);
      assert.equal(business.viewer.canManage, flags[0]); assert.equal(business.viewer.canEditServices, flags[0]);
      assert.equal(business.viewer.canPublish, flags[1]); assert.equal(business.viewer.canViewAnalytics, flags[2]);
      await expectStatus(who, 'GET', `${base}/analytics`, flags[2] ? 200 : 403);
      await expectStatus(who, 'PATCH', base, flags[0] ? 200 : 403, { tagline: 'Real role-gated profile' });
    }
    await expectStatus('creator', 'POST', `${base}/reports`, 400, { reason: 'spam' });
  });

  it('enforces blocks in both directions across public reads, availability, save and booking', async () => {
    const { eq } = await import('drizzle-orm');
    const pairs = [
      [actors.customer, 'personal', providerId, 'business'], [providerId, 'business', actors.customer, 'personal'],
      [actors.customer, 'personal', actors.owner, 'personal'], [actors.owner, 'personal', actors.customer, 'personal'],
      [viewerBusinessId, 'business', providerId, 'business'], [providerId, 'business', viewerBusinessId, 'business'],
    ];
    for (const [blockerProfileId, blockerProfileType, blockedProfileId, blockedProfileType] of pairs) {
      const id = randomUUID();
      const businessOnly = blockerProfileId === viewerBusinessId || blockedProfileId === viewerBusinessId;
      const scoped = (url: string) => businessOnly ? withViewer(url) : url;
      await db.insert(schema.profileBlocks).values({ id, blockerProfileId, blockerProfileType, blockedProfileId, blockedProfileType });
      try {
        await expectStatus('customer', 'GET', scoped(base), 404);
        await expectStatus('customer', 'GET', scoped(`${base}/reviews`), 404);
        await expectStatus('customer', 'GET', scoped(availabilityUrl()), 404);
        await expectStatus('customer', 'PUT', scoped(`${base}/save`), 404, { saved: true });
        if (businessOnly) await expectStatus('customer', 'GET', base, 200);
        else await expectStatus('customer', 'POST', '/v1/bookings', 404, bookingRequest());
      } finally { await db.delete(schema.profileBlocks).where(eq(schema.profileBlocks.id, id)); }
    }
    for (const values of [{ blockerMobileUserId: actors.customer, blockedProviderId: providerId }, { blockerMobileUserId: actors.owner, blockedMobileUserId: actors.customer }]) {
      const id = randomUUID(); await db.insert(schema.mobileUserBlocks).values({ id, ...values });
      try { await expectStatus('customer', 'GET', base, 404); }
      finally { await db.delete(schema.mobileUserBlocks).where(eq(schema.mobileUserBlocks.id, id)); }
    }
    await expectStatus('customer', 'GET', base, 200);
  });

  it('calculates social state for the selected owned viewer and rejects forged or incomplete identities', async () => {
    const personalFollow = randomUUID(), businessFollow = randomUUID();
    const { inArray } = await import('drizzle-orm');
    await db.insert(schema.profileFollows).values({ id: personalFollow, followerProfileId: actors.customer, followerProfileType: 'personal', followedProfileId: providerId, followedProfileType: 'business', status: 'accepted' });
    try {
      assert.equal((await expectStatus('customer', 'GET', base, 200)).business.viewer.relationship.isFollowing, true);
      assert.equal((await expectStatus('customer', 'GET', withViewer(base), 200)).business.viewer.relationship.isFollowing, false);
      await db.insert(schema.profileFollows).values({ id: businessFollow, followerProfileId: viewerBusinessId, followerProfileType: 'business', followedProfileId: providerId, followedProfileType: 'business', status: 'pending' });
      assert.equal((await expectStatus('customer', 'GET', withViewer(base), 200)).business.viewer.relationship.isRequested, true);
      assert.equal((await expectStatus('customer', 'GET', base, 200)).business.viewer.relationship.isFollowing, true);
      await expectStatus(null, 'GET', withViewer(base), 401);
      await expectStatus('customer', 'GET', `${base}?viewerProfileId=${viewerBusinessId}`, 400);
      await expectStatus('customer', 'GET', `${base}?viewerProfileType=business`, 400);
      await expectStatus('customer', 'GET', withViewer(base, actors.other!, 'personal'), 403);
      await expectStatus('customer', 'GET', withViewer(base, providerId), 403);
      await expectStatus('customer', 'PUT', withViewer(`${base}/save`, actors.other!, 'personal'), 403, { saved: true });
      const inactiveViewer = await createProvider(actors.inactiveOwner!);
      await db.insert(schema.providerMemberships).values({ providerId: inactiveViewer, mobileUserId: actors.customer, role: 'admin' });
      await expectStatus('customer', 'GET', withViewer(base, inactiveViewer), 403);
    } finally { await db.delete(schema.profileFollows).where(inArray(schema.profileFollows.id, [personalFollow, businessFollow])); }
  });

  it('persists idempotent saves and reports without mutating another viewer’s state', async () => {
    const { and, eq } = await import('drizzle-orm');
    await expectStatus('customer', 'PUT', `${base}/save`, 200, { saved: true });
    await expectStatus('customer', 'PUT', `${base}/save`, 200, { saved: true });
    assert.equal((await expectStatus('customer', 'GET', base, 200)).business.viewer.isSaved, true);
    assert.equal((await expectStatus('other', 'GET', base, 200)).business.viewer.isSaved, false);
    assert.equal((await db.select().from(schema.businessProfileSaves).where(and(eq(schema.businessProfileSaves.providerId, providerId), eq(schema.businessProfileSaves.mobileUserId, actors.customer)))).length, 1);
    const first = await expectStatus('customer', 'POST', `${base}/reports`, 201, { reason: 'spam', details: 'Original report' });
    const second = await expectStatus('customer', 'POST', `${base}/reports`, 201, { reason: 'misleading', details: 'Updated report details' });
    assert.equal(second.reportId, first.reportId);
    const reports = await db.select().from(schema.businessProfileReports).where(eq(schema.businessProfileReports.providerId, providerId));
    assert.equal(reports.length, 1); assert.equal(reports[0].reporterId, actors.customer); assert.equal(reports[0].reason, 'misleading');
    await expectStatus('customer', 'PUT', `${base}/save`, 200, { saved: false });
    assert.equal((await expectStatus('customer', 'GET', base, 200)).business.viewer.isSaved, false);
  });

  it('validates owner image ownership, privacy and readiness before saving profile changes', async () => {
    for (const key of ['foreign', 'private', 'pending', 'rejected', 'document']) await expectStatus('owner', 'PATCH', base, 403, { logoMediaId: assets[key] });
    const { business } = await expectStatus('admin', 'PATCH', base, 200, { name: 'Updated public studio', tagline: 'Good movement, every day', brandAccentColor: '#125A54', phone: '9123456789', website: 'https://studio.example.test', workingDays: ['Mon'], openingTime: '09:00', closingTime: '12:00' });
    assert.equal(business.name, 'Updated public studio'); assert.equal(business.tagline, 'Good movement, every day');
    assert.equal(business.contact.phone, '9123456789'); assert.equal(business.brandAccentColor, '#125A54');
    const result = await expectStatus('owner', 'PATCH', base, 200, { logoMediaId: assets.logo, coverMediaId: assets.cover, galleryMediaIds: [assets.gallery, assets.gallery] });
    assert.deepEqual(result.business.gallery.map((row: Json) => row.id).sort(), [assets.cover, assets.gallery].sort());
    const { and, eq } = await import('drizzle-orm');
    const usages = await db.select().from(schema.mediaUsages).where(and(eq(schema.mediaUsages.entityType, 'business_profile'), eq(schema.mediaUsages.entityId, providerId)));
    assert.deepEqual(usages.map((row: Json) => row.mediaId).sort(), [assets.logo, assets.cover, assets.gallery].sort());
    await expectStatus('owner', 'PATCH', base, 400, { workingDays: ['Notaday'] });
    await expectStatus('owner', 'PATCH', base, 400, { openingTime: '12:00', closingTime: '09:00' });
    await expectStatus('owner', 'PATCH', base, 400, { website: 'file:///private/documents' });
  });

  it('requires the reviewer’s own completed booking and safe customer-owned photos', async () => {
    for (const [who, id] of [['customer', unfinished], ['other', completed[0]], ['customer', wrongBusinessBooking], ['owner', ownerBooking], ['creator', memberBooking]]) {
      await expectStatus(who!, 'POST', `${base}/reviews`, 403, { bookingId: id, rating: 5, body: 'A useful and detailed customer review.' });
    }
    for (const photo of [assets.foreign, assets.private, assets.pending]) await expectStatus('customer', 'POST', `${base}/reviews`, 403, { bookingId: completed[0], rating: 5, body: 'A useful and detailed customer review.', photoMediaIds: [photo] });
    await expectStatus('customer', 'POST', `${base}/reviews`, 400, { bookingId: completed[0], rating: 6, body: 'A useful and detailed customer review.' });
    const { review } = await expectStatus('customer', 'POST', `${base}/reviews`, 201, { bookingId: completed[0], rating: 5, body: 'A useful and detailed customer review.', photoMediaIds: [assets.review, assets.review] });
    assert.equal(review.verifiedBooking, true); assert.equal(review.author.id, actors.customer); assert.equal(review.serviceTitle, 'Studio session');
    assert.deepEqual(Object.keys(review.author).sort(), ['avatarUrl', 'displayName', 'id']);
    assert.deepEqual(review.photos.map((photo: Json) => photo.id), [assets.review]);
    await expectStatus('customer', 'POST', `${base}/reviews`, 409, { bookingId: completed[0], rating: 1, body: 'A second duplicate customer review.' });
    const { eq } = await import('drizzle-orm');
    const usages = await db.select().from(schema.mediaUsages).where(eq(schema.mediaUsages.entityId, review.id));
    assert.equal(usages.length, 1); assert.equal(usages[0].mediaId, assets.review);
  });

  it('serializes duplicate reviews, aggregates verified ratings and paginates tied timestamps without repeats', async () => {
    const duplicate = await Promise.all([0, 1].map(() => call('customer', 'POST', `${base}/reviews`, { bookingId: completed[1], rating: 4, body: 'Another completed customer experience.' })));
    assert.deepEqual(duplicate.map(result => result.status).sort(), [201, 409]);
    await expectStatus('other', 'POST', `${base}/reviews`, 201, { bookingId: completed[2], rating: 3, body: 'A third completed customer experience.' });
    const { eq } = await import('drizzle-orm');
    await db.update(schema.businessReviews).set({ createdAt: new Date('2026-01-02T00:00:00.123Z') }).where(eq(schema.businessReviews.providerId, providerId));
    const all = await db.select().from(schema.businessReviews).where(eq(schema.businessReviews.providerId, providerId));
    const seen: string[] = []; let cursor: string | null = null;
    do {
      const page = await expectStatus(null, 'GET', `${base}/reviews?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 200);
      seen.push(...page.reviews.map((review: Json) => review.id)); cursor = page.nextCursor;
      assert.ok(seen.length <= 3, 'cursor must always make progress');
    } while (cursor);
    assert.deepEqual(seen, all.map((row: Json) => row.id).sort().reverse());
    const { business } = await expectStatus('customer', 'GET', base, 200);
    assert.deepEqual(business.rating, { average: 4, count: 3 }); assert.equal(business.viewer.canReview, false);
    assert.deepEqual((await expectStatus('customer', 'GET', `${base}/reviews`, 200)).eligibleBookings, []);
    await expectStatus(null, 'GET', `${base}/reviews?cursor=invalid`, 400);
  });

  it('does not expose legacy local, data or credential-bearing reviewer avatars', async () => {
    const { eq } = await import('drizzle-orm');
    try {
      for (const avatarUrl of ['file:///private/customer-photo.png', 'data:image/png;base64,cHJpdmF0ZQ==', 'https://user:private-password@example.test/photo.png']) {
        await db.update(schema.mobileUsers).set({ avatarUrl }).where(eq(schema.mobileUsers.id, actors.customer));
        const page = await expectStatus(null, 'GET', `${base}/reviews`, 200);
        assert.ok(page.reviews.filter((review: Json) => review.author.id === actors.customer).every((review: Json) => review.author.avatarUrl === null));
        assert.ok(!JSON.stringify(page).includes(avatarUrl));
      }
      await db.update(schema.mobileUsers).set({ avatarUrl: 'https://example.test/public-avatar.png' }).where(eq(schema.mobileUsers.id, actors.customer));
      const page = await expectStatus(null, 'GET', `${base}/reviews`, 200);
      assert.ok(page.reviews.filter((review: Json) => review.author.id === actors.customer).every((review: Json) => review.author.avatarUrl === 'https://example.test/public-avatar.png'));
    } finally { await db.update(schema.mobileUsers).set({ avatarUrl: null }).where(eq(schema.mobileUsers.id, actors.customer)); }
  });

  it('uses working days, durations, modes, pause flags and overlapping bookings for availability', async () => {
    assert.equal(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date(at(monday, '09:00'))), 'Mon');
    const initial = await expectStatus(null, 'GET', availabilityUrl(), 200);
    assert.equal(initial.availability.slots[0].startsAt, at(monday, '09:00')); assert.equal(initial.availability.slots[0].available, true);
    assert.equal((await expectStatus(null, 'GET', availabilityUrl(tuesday), 200)).availability.slots.length, 0);
    assert.equal((await expectStatus(null, 'GET', availabilityUrl(monday, 'online'), 200)).availability.slots.length, 0);
    await expectStatus(null, 'GET', `${availabilityUrl()}&durationMinutes=30`, 400);
    await expectStatus(null, 'GET', availabilityUrl('2100-02-30'), 400);
    const conflictId = randomUUID(); bookingIds.push(conflictId);
    await db.insert(schema.bookings).values({ ...bookingValue(conflictId, actors.other!, 'confirmed'), startsAt: new Date(at(monday, '09:00')), endsAt: null, durationMinutes: 90 });
    try {
      const { availability } = await expectStatus('customer', 'GET', availabilityUrl(), 200);
      assert.equal(availability.slots.find((slot: Json) => slot.startsAt === at(monday, '10:00')).available, false);
      const rejected = await expectStatus('customer', 'POST', '/v1/bookings', 409, bookingRequest(monday, '10:00'));
      assert.equal(rejected.error.code, 'booking_conflict');
      assert.equal(availability.slots.find((slot: Json) => slot.startsAt === at(monday, '10:30')).available, true);
    } finally { const { eq } = await import('drizzle-orm'); await db.delete(schema.bookings).where(eq(schema.bookings.id, conflictId)); }
    await expectStatus('owner', 'PATCH', base, 200, { temporarilyUnavailable: true });
    assert.equal((await expectStatus(null, 'GET', availabilityUrl(), 200)).availability.slots.length, 0);
    await expectStatus('customer', 'POST', '/v1/bookings', 409, bookingRequest());
    await expectStatus('owner', 'PATCH', base, 200, { temporarilyUnavailable: false });
  });

  it('persists one booking under concurrent slot requests, using server pricing and provider/category identity', async () => {
    await expectStatus('owner', 'POST', '/v1/bookings', 403, bookingRequest());
    await expectStatus('creator', 'POST', '/v1/bookings', 403, bookingRequest());
    await expectStatus('customer', 'POST', '/v1/bookings', 409, bookingRequest(tuesday));
    await expectStatus('customer', 'POST', '/v1/bookings', 409, bookingRequest(monday, '08:30'));
    await expectStatus('customer', 'POST', '/v1/bookings', 400, { ...bookingRequest(), durationMinutes: 30 });
    const results = await Promise.all(['customer', 'other'].map(who => call(who, 'POST', '/v1/bookings', { ...bookingRequest(), detail: { serviceTitle: 'Forged client service', providerName: 'Forged client business' } })));
    assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
    const created = results.find(result => result.status === 201)!.json.booking; bookingIds.push(created.id);
    assert.equal(created.providerId, providerId); assert.equal(created.categoryId, categoryId); assert.equal(created.amount, 550); assert.equal(created.status, 'pending');
    assert.equal(created.detail.serviceTitle, 'Studio session'); assert.equal(created.detail.providerName, 'Updated public studio');
    const { eq } = await import('drizzle-orm');
    const [stored] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, created.id));
    assert.equal(stored.amount, 550); assert.equal(stored.providerId, providerId);
    assert.equal(stored.detail.serviceTitle, 'Studio session'); assert.equal(stored.detail.providerName, 'Updated public studio');
    const { availability } = await expectStatus('customer', 'GET', availabilityUrl(), 200);
    assert.equal(availability.slots[0].available, false);
  });

  it('updates owner services while retaining offering identity and metadata, and gates real analytics', async () => {
    const payload = { services: [{ categoryId, description: 'Updated session details', price: 850, durationMinutes: 60, modes: ['center', 'online'], available: true }, { categoryId: secondCategory, description: null, price: null, durationMinutes: 30, modes: ['online'], available: false }] };
    for (const who of ['creator', 'analyst', 'customer']) await expectStatus(who, 'PUT', `${base}/services`, 403, payload);
    const { business } = await expectStatus('admin', 'PUT', `${base}/services`, 200, payload);
    assert.equal(business.services.find((service: Json) => service.categoryId === categoryId).id, offeringId);
    assert.equal(business.services.find((service: Json) => service.categoryId === categoryId).price, 850);
    assert.equal(business.services.find((service: Json) => service.categoryId === secondCategory).available, false);
    const { and, eq } = await import('drizzle-orm');
    const [offering] = await db.select().from(schema.providerServiceOfferings).where(and(eq(schema.providerServiceOfferings.providerId, providerId), eq(schema.providerServiceOfferings.categoryId, categoryId)));
    assert.equal(offering.metadata.retainedField, 'keep-me');
    await expectStatus('owner', 'PUT', `${base}/services`, 400, { services: [payload.services[0], payload.services[0]] });
    await expectStatus('owner', 'PUT', `${base}/services`, 400, { services: [{ ...payload.services[0], categoryId: hiddenCategory }] });
    const { analytics } = await expectStatus('analyst', 'GET', `${base}/analytics`, 200);
    assert.equal(analytics.completedBookings, 5); assert.equal(analytics.totalReviews, 3); assert.equal(analytics.averageRating, 4);
    assert.equal(analytics.paidRevenue, 2750); assert.equal(analytics.profileViews, null);
    assert.equal(analytics.totalBookings, 7); assert.equal(analytics.upcomingBookings, 1);
  });

  it('keeps an unpriced service unpriced when a customer supplies a forged amount', async () => {
    const { and, eq } = await import('drizzle-orm');
    await db.update(schema.providerServiceOfferings).set({ metadata: { durationMinutes: 30, modes: ['online'], available: true }, pricingStartsAt: null }).where(and(eq(schema.providerServiceOfferings.providerId, providerId), eq(schema.providerServiceOfferings.categoryId, secondCategory)));
    const result = await expectStatus('customer', 'POST', '/v1/bookings', 201, { ...bookingRequest(monday, '11:00'), categoryId: secondCategory, serviceMode: 'online', durationMinutes: 30, amount: 1234567 });
    bookingIds.push(result.booking.id);
    assert.equal(result.booking.amount, null);
    const [stored] = await db.select().from(schema.bookings).where(eq(schema.bookings.id, result.booking.id));
    assert.equal(stored.amount, null); assert.equal(stored.categoryId, secondCategory);
  });

  it('discovers saved businesses with exact stable pagination and lifecycle, account and viewer safety filters', async () => {
    const { and, eq, inArray } = await import('drizzle-orm');
    const extra = await Promise.all([0, 1, 2].map(() => createProvider(actors.owner!)));
    const expected = [providerId, ...extra];
    await db.insert(schema.businessProfileSaves).values(providerIds.map(id => ({ providerId: id, mobileUserId: actors.customer }))).onConflictDoNothing();
    // Old saves can retain PostgreSQL microseconds. The public cursor must not skip them.
    await sqlClient`UPDATE business_profile_saves SET created_at = '2026-01-03T00:00:00.123456Z'::timestamptz WHERE mobile_user_id = ${actors.customer}`;
    const stored = await db.select().from(schema.businessProfileSaves).where(and(eq(schema.businessProfileSaves.mobileUserId, actors.customer), inArray(schema.businessProfileSaves.providerId, expected)));
    const ordered = stored.sort((a: Json, b: Json) => b.id.localeCompare(a.id)).map((row: Json) => row.providerId);
    const seen: string[] = []; let cursor: string | null = null;
    const { SavedBusinessesResponseSchema } = await import('@anticlock/contracts');
    do {
      const page = await expectStatus('customer', 'GET', `/v1/business-profiles/saved?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, 200);
      SavedBusinessesResponseSchema.parse(page);
      seen.push(...page.businesses.map((row: Json) => row.id)); cursor = page.nextCursor;
      assert.ok(seen.length <= expected.length, 'saved cursor must make progress');
      assert.ok(page.businesses.every((row: Json) => row.savedAt === '2026-01-03T00:00:00.123Z'));
    } while (cursor);
    assert.deepEqual(seen, ordered);
    const all = await expectStatus('customer', 'GET', '/v1/business-profiles/saved?limit=50', 200);
    const card = all.businesses.find((row: Json) => row.id === providerId);
    assert.equal(card.categoryLabel, 'Studio session'); assert.equal(card.city, 'Chennai'); assert.match(card.avatarUrl, /logo\.png/);
    assert.ok(!JSON.stringify(all).includes('PRIVATE-')); assert.ok(!JSON.stringify(all).includes('APPLICATION-KYC'));
    await expectStatus(null, 'GET', '/v1/business-profiles/saved', 401);
    await expectStatus('customer', 'GET', '/v1/business-profiles/saved?cursor=invalid', 400);
    await expectStatus('customer', 'GET', '/v1/business-profiles/saved?limit=100', 400);
    assert.deepEqual((await expectStatus('other', 'GET', '/v1/business-profiles/saved', 200)).businesses, []);
    await expectStatus('other', 'PUT', `${base}/save`, 200, { saved: false });
    assert.equal((await expectStatus('customer', 'GET', base, 200)).business.viewer.isSaved, true);
    const blockId = randomUUID();
    await db.insert(schema.profileBlocks).values({ id: blockId, blockerProfileId: providerId, blockerProfileType: 'business', blockedProfileId: viewerBusinessId, blockedProfileType: 'business' });
    try {
      assert.ok((await expectStatus('customer', 'GET', '/v1/business-profiles/saved', 200)).businesses.some((row: Json) => row.id === providerId));
      assert.ok(!(await expectStatus('customer', 'GET', withViewer('/v1/business-profiles/saved'), 200)).businesses.some((row: Json) => row.id === providerId));
    } finally { await db.delete(schema.profileBlocks).where(eq(schema.profileBlocks.id, blockId)); }
    await db.update(schema.providers).set({ status: 'suspended' }).where(eq(schema.providers.id, extra[0]));
    assert.ok(!(await expectStatus('customer', 'GET', '/v1/business-profiles/saved', 200)).businesses.some((row: Json) => row.id === extra[0]));
    await expectStatus('customer', 'PUT', `${base}/save`, 200, { saved: false });
    assert.ok(!(await expectStatus('customer', 'GET', '/v1/business-profiles/saved', 200)).businesses.some((row: Json) => row.id === providerId));
  });
});
