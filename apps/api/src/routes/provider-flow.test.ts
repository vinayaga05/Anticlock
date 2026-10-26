/**
 * DB-backed integration tests for service-provider onboarding:
 * drafts -> uploads -> submit -> admin review state machine -> approval
 * (one NEW business profile per application) -> notifications -> marketplace
 * -> bookings/dashboard. Runs when TEST_DATABASE_URL is set (CI provides
 * one); otherwise skipped. See content-publisher.test.ts for local setup.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
if (TEST_DATABASE_URL) {
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.MEDIA_STORAGE = 'local';
  process.env.MEDIA_LOCAL_DIR = mkdtempSync(path.join(tmpdir(), 'anticlock-provider-'));
  process.env.API_PUBLIC_URL = 'http://localhost:4000';
  delete process.env.R2_ACCOUNT_ID;
}

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

type Json = Record<string, any>;

describe('provider onboarding flow (integration)', { skip: !TEST_DATABASE_URL }, () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let sqlClient: any;
  let schema: any;
  let listOwnedPublishers: any;

  const runId = randomUUID().slice(0, 8);
  const OWNER = randomUUID();
  const OTHER = randomUUID();
  const ADMIN = randomUUID();
  const treeId = `pf-tree-${runId}`;
  const categoryId = `pf-cat-${runId}`;
  const tokens: Record<string, string> = {};
  let adminToken = '';
  const appIds: string[] = [];

  async function call(
    who: string,
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ status: number; json: Json }> {
    const res = await app.request(url, {
      method,
      headers: {
        authorization: `Bearer ${who === 'admin' ? adminToken : tokens[who]}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : {} };
  }

  async function upload(
    who: string,
    applicationId: string,
    fieldKey: string,
    purpose: 'document' | 'profile',
    kind: 'image' | 'document' = 'image',
  ) {
    const session = await call(who, 'POST', `/v1/provider/applications/${applicationId}/kyc-upload-session`, {
      fieldKey,
      purpose,
      kind,
      filename: `${fieldKey}.png`,
      contentType: 'image/png',
      byteSize: PNG_BYTES.length,
    });
    assert.equal(session.status, 201, JSON.stringify(session.json));
    assert.match(session.json.uploadUrl, /\/v1\/provider\/applications\/.+\/kyc-upload-sessions\/.+\/content$/);
    const put = await app.request(
      `/v1/provider/applications/${applicationId}/kyc-upload-sessions/${session.json.sessionId}/content`,
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${tokens[who]}`, 'content-type': 'image/png' },
        body: PNG_BYTES,
      },
    );
    assert.equal(put.status, 200, await put.text());
    const done = await call(
      who,
      'POST',
      `/v1/provider/applications/${applicationId}/kyc-upload-sessions/${session.json.sessionId}/complete`,
      { fieldKey, purpose },
    );
    assert.equal(done.status, 200, JSON.stringify(done.json));
    return done.json as { mediaId: string; url: string | null };
  }

  function completePayload(name: string) {
    return {
      commonPayload: {
        basic: { providerName: name, contactPerson: 'Asha', mobile: '9876543210', email: 'asha@example.com' },
        location: { address: '12 Lake Road', city: 'Chennai', area: 'Adyar', pincode: '600020', latitude: 13.001, longitude: 80.25 },
        availability: { workingDays: ['mon', 'tue'], openingTime: '09:00', closingTime: '18:00' },
        services: { pricingStartsAt: '1,500', atLocation: true, homeVisit: true, online: true },
        profile: { description: `${name} description for guests`, yearsInOperation: '4' },
      },
      aadhaarNumber: '234567890123',
    };
  }

  function nextAvailableTime(weeks = 0, hour = 10, minute = 0) {
    const now = new Date();
    for (let offset = 1 + weeks * 7; offset <= 21 + weeks * 7; offset += 1) {
      const cursor = new Date(now.getTime() + offset * 86_400_000);
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
      }).formatToParts(cursor);
      const part = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find(item => item.type === type)?.value ?? '';
      if (!['Mon', 'Tue'].includes(part('weekday'))) continue;
      const candidate = new Date(
        `${part('year')}-${part('month')}-${part('day')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+05:30`,
      );
      if (candidate > now) return candidate.toISOString();
    }
    throw new Error('Could not find an available provider time');
  }

  /** Creates a complete application (services, payload, docs) as a draft. */
  async function completeDraft(name: string, kind: 'business' | 'individual' = 'business') {
    const created = await call('OWNER', 'POST', '/v1/provider/applications', { providerKind: kind });
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const id = created.json.application.id as string;
    appIds.push(id);
    assert.equal((await call('OWNER', 'PUT', `/v1/provider/applications/${id}/services`, { categoryIds: [categoryId] })).status, 200);
    const logo = await upload('OWNER', id, 'profile.logo', 'profile', 'image');
    const patched = await call('OWNER', 'PATCH', `/v1/provider/applications/${id}`, {
      ...completePayload(name),
      commonPayload: {
        ...completePayload(name).commonPayload,
        profile: {
          ...completePayload(name).commonPayload.profile,
          logoMediaId: logo.mediaId,
        },
      },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.json));
    // The mobile app sends document fields as kind "document" even when the
    // file is a photo of the document (JPEG/PNG).
    await upload('OWNER', id, 'identity.aadhaarDocument', 'document', 'document');
    await upload('OWNER', id, 'identity.idDocument', 'document', 'document');
    if (kind === 'business') {
      await upload('OWNER', id, 'identity.businessRegistration', 'document', 'document');
    }
    return id;
  }

  async function notificationsFor(userId: string) {
    const { eq, desc } = await import('drizzle-orm');
    return db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.mobileUserId, userId))
      .orderBy(desc(schema.notifications.createdAt));
  }

  before(async () => {
    const { Hono } = await import('hono');
    const provider = await import('./provider.js');
    const bookingsRoutes = await import('./bookings.js');
    const { signToken } = await import('../lib/auth.js');
    ({ listOwnedPublishers } = await import('../publishing/publisher.js'));
    const client = await import('../db/client.js');
    db = client.db;
    sqlClient = client.sql;
    schema = await import('../db/schema.js');

    const hono = new Hono();
    hono.route('/v1/provider', provider.providerMobileRoutes);
    hono.route('/v1/marketplace', provider.marketplaceRoutes);
    hono.route('/admin/provider', provider.providerAdminRoutes);
    hono.route('/v1/bookings', bookingsRoutes.bookingMobileRoutes);
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values([
      { id: OWNER, phone: `+91o${runId}`, displayName: 'Asha Owner' },
      { id: OTHER, phone: `+91x${runId}`, displayName: 'Bala Customer' },
    ]);
    await db.insert(schema.serviceTrees).values({ id: treeId, slug: treeId, name: 'PF tree' }).onConflictDoNothing();
    await db
      .insert(schema.serviceCategories)
      .values({ id: categoryId, treeId, name: `Pilates ${runId}`, actionType: 'appointment' })
      .onConflictDoNothing();

    tokens.OWNER = await signToken({ sub: OWNER, email: '', name: 'Owner', roles: [], kind: 'mobile' });
    tokens.OTHER = await signToken({ sub: OTHER, email: '', name: 'Other', roles: [], kind: 'mobile' });
    await db.insert(schema.users).values({
      id: ADMIN,
      email: `pf-admin-${runId}@example.com`,
      name: 'Reviewer',
      passwordHash: 'x',
    });
    adminToken = await signToken({
      sub: ADMIN,
      email: 'admin@example.com',
      name: 'Admin',
      roles: [],
      permissions: ['provider.read', 'provider.verify', 'catalog.read'],
      kind: 'admin',
    });
  });

  after(async () => {
    if (!db) return;
    const { inArray, like, or } = await import('drizzle-orm');
    if (appIds.length) {
      await db
        .delete(schema.mediaAssets)
        .where(or(...appIds.map(id => like(schema.mediaAssets.storageKey, `%provider-app-${id}%`)), ...appIds.map(id => like(schema.mediaAssets.storageKey, `%provider-applications/${id}/%`))));
    }
    await db.delete(schema.mobileUsers).where(inArray(schema.mobileUsers.id, [OWNER, OTHER]));
    await db.delete(schema.users).where(inArray(schema.users.id, [ADMIN]));
    await db.delete(schema.serviceCategories).where(inArray(schema.serviceCategories.id, [categoryId]));
    await db.delete(schema.serviceTrees).where(inArray(schema.serviceTrees.id, [treeId]));
    await sqlClient.end({ timeout: 5 });
  });

  let firstId = '';
  let secondId = '';
  let rejectedId = '';
  let firstProviderId = '';
  let secondProviderId = '';

  it('keeps every draft: starting a new application never deletes existing drafts', async () => {
    const a = await call('OWNER', 'POST', '/v1/provider/applications', { providerKind: 'business' });
    const b = await call('OWNER', 'POST', '/v1/provider/applications', { providerKind: 'individual' });
    assert.equal(a.status, 201);
    assert.equal(b.status, 201);
    appIds.push(a.json.application.id, b.json.application.id);
    const list = await call('OWNER', 'GET', '/v1/provider/applications');
    assert.equal(list.status, 200);
    const ids = (list.json.applications as Json[]).map(x => x.id);
    assert.ok(ids.includes(a.json.application.id), 'first draft still listed');
    assert.ok(ids.includes(b.json.application.id), 'second draft listed');
    assert.ok((list.json.applications as Json[]).every(x => x.status === 'draft'));
    // Drafts are private: not in the admin queue.
    const queue = await call('admin', 'GET', '/admin/provider/applications');
    assert.ok(!(queue.json.data as Json[]).some(x => x.id === a.json.application.id));
    // Clean up the empty drafts.
    assert.equal((await call('OWNER', 'DELETE', `/v1/provider/applications/${a.json.application.id}`)).status, 200);
    assert.equal((await call('OWNER', 'DELETE', `/v1/provider/applications/${b.json.application.id}`)).status, 200);
  });

  it('parses numeric strings into numbers and rejects non-numeric values', async () => {
    firstId = await completeDraft(`Lotus Pilates ${runId}`);
    const detail = await call('OWNER', 'GET', `/v1/provider/applications/${firstId}`);
    assert.equal(detail.json.application.commonPayload.services.pricingStartsAt, 1500);
    assert.equal(detail.json.application.commonPayload.profile.yearsInOperation, 4);
    const bad = await call('OWNER', 'PATCH', `/v1/provider/applications/${firstId}`, {
      commonPayload: { profile: { yearsInOperation: 'four' } },
    });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error.code, 'validation_error');
    // Restore a valid profile section.
    assert.equal((await call('OWNER', 'PATCH', `/v1/provider/applications/${firstId}`, { commonPayload: { profile: { description: 'Reformer classes' } } })).status, 200);
  });

  it('stores profile images as profile media ids (not application documents)', async () => {
    const logo = await upload('OWNER', firstId, 'profile.logo', 'profile');
    assert.ok(logo.url, 'public URL returned for profile media');
    const patched = await call('OWNER', 'PATCH', `/v1/provider/applications/${firstId}`, {
      commonPayload: { profile: { description: 'Reformer classes', logoMediaId: logo.mediaId } },
    });
    assert.equal(patched.status, 200, JSON.stringify(patched.json));
    const app1 = patched.json.application;
    assert.equal(app1.commonPayload.profile.logoMediaId, logo.mediaId);
    assert.ok(!(app1.documents as Json[]).some(d => d.fieldKey === 'profile.logo'));
    assert.ok((app1.mediaPreviews as Json[]).some(m => m.mediaId === logo.mediaId && m.url));
    // Someone else's / unknown media id is refused.
    const forged = await call('OWNER', 'PATCH', `/v1/provider/applications/${firstId}`, {
      commonPayload: { profile: { logoMediaId: randomUUID() } },
    });
    assert.equal(forged.status, 403);
  });

  it('reports field-level readiness and blocks incomplete submissions', async () => {
    const id = (await call('OWNER', 'POST', '/v1/provider/applications', { providerKind: 'business' })).json.application.id;
    appIds.push(id);
    await call('OWNER', 'PUT', `/v1/provider/applications/${id}/services`, { categoryIds: [categoryId] });
    await call('OWNER', 'PATCH', `/v1/provider/applications/${id}`, {
      commonPayload: { basic: { providerName: 'Half done', email: 'not-an-email' } },
    });
    const detail = await call('OWNER', 'GET', `/v1/provider/applications/${id}`);
    const readiness = detail.json.application.readiness;
    assert.equal(readiness.complete, false);
    const keys = (readiness.missing as Json[]).map(m => m.key);
    for (const k of ['basic.contactPerson', 'location.city', 'identity.aadhaarDocument', 'identity.aadhaarNumber', 'availability.workingDays']) {
      assert.ok(keys.includes(k), `missing ${k}`);
    }
    assert.equal((readiness.missing as Json[]).find(m => m.key === 'basic.email').reason, 'invalid');
    const submit = await call('OWNER', 'POST', `/v1/provider/applications/${id}/submit`);
    assert.equal(submit.status, 400);
    assert.equal(submit.json.error.code, 'application_incomplete');
    assert.ok(Array.isArray(submit.json.error.details));
    assert.equal((await call('OWNER', 'DELETE', `/v1/provider/applications/${id}`)).status, 200);
  });

  it('enforces admin state transitions and notifies the applicant', async () => {
    const review = (action: string, extra: Json = {}) =>
      call('admin', 'POST', `/admin/provider/applications/${firstId}/review`, { action, ...extra });

    // Draft: no admin action is valid.
    assert.equal((await review('approve')).status, 409);

    const submitted = await call('OWNER', 'POST', `/v1/provider/applications/${firstId}/submit`);
    assert.equal(submitted.status, 200, JSON.stringify(submitted.json));
    assert.equal(submitted.json.application.status, 'pending_review');
    {
      const { eq } = await import('drizzle-orm');
      const [persisted] = await db.select({ status: schema.providerApplications.status })
        .from(schema.providerApplications)
        .where(eq(schema.providerApplications.id, firstId));
      assert.equal(persisted.status, 'pending_review');
    }
    let notes = await notificationsFor(OWNER);
    assert.equal(notes[0].type, 'provider_application_submitted');
    assert.equal(notes[0].data.status, 'pending_review');
    // Applicant cannot edit or re-submit while in review.
    assert.equal((await call('OWNER', 'PATCH', `/v1/provider/applications/${firstId}`, { commonPayload: {} })).status, 409);
    assert.equal((await call('OWNER', 'POST', `/v1/provider/applications/${firstId}/submit`)).status, 409);

    const detail = await call('admin', 'GET', `/admin/provider/applications/${firstId}`);
    assert.deepEqual(detail.json.application.allowedActions, [
      'approve',
      'request_changes',
      'reject',
    ]);

    // Queue shows the submitted application (drafts are hidden).
    const queue = await call('admin', 'GET', '/admin/provider/applications');
    assert.equal(queue.status, 200);
    assert.ok(
      (queue.json.data as { id: string; status: string }[]).some(
        a => a.id === firstId && a.status === 'pending_review',
      ),
      'submitted application appears in the admin queue',
    );

    // Pending businesses do not have a public profile or search result.
    const hidden = await call('OTHER', 'GET', `/v1/marketplace/providers?q=${encodeURIComponent(`Lotus Pilates ${runId}`)}`);
    assert.deepEqual(hidden.json.data, []);

    assert.equal((await review('request_changes')).status, 400, 'message required');
    const info = await review('request_changes', {
      infoRequestMessage: 'Please upload a clearer ID',
    });
    assert.equal(info.status, 200);
    assert.equal(info.json.application.status, 'changes_requested');
    notes = await notificationsFor(OWNER);
    assert.equal(notes[0].type, 'provider_application_changes_requested');
    assert.equal(notes[0].data.status, 'changes_requested');
    assert.match(notes[0].body, /clearer ID/);

    // Applicant fixes and resubmits.
    await upload('OWNER', firstId, 'identity.idDocument', 'document');
    const resubmitted = await call(
      'OWNER',
      'POST',
      `/v1/provider/applications/${firstId}/submit`,
    );
    assert.equal(resubmitted.status, 200);
    assert.equal(resubmitted.json.application.status, 'pending_review');
    assert.equal(
      resubmitted.json.application.infoRequestMessage,
      null,
      'answered info request is cleared',
    );

    // Approval is allowed directly from pending review.
    const approved = await review('approve', { notes: 'Looks good' });
    assert.equal(approved.status, 200, JSON.stringify(approved.json));
    assert.equal(approved.json.application.status, 'approved');
    firstProviderId = approved.json.application.providerId;
    assert.ok(firstProviderId);
    notes = await notificationsFor(OWNER);
    assert.equal(notes[0].type, 'provider_application_approved');
    assert.equal(notes[0].data.status, 'approved');
    assert.equal(notes[0].data.providerId, firstProviderId);

    const { and, eq } = await import('drizzle-orm');
    const audit = await db.select().from(schema.auditLogs).where(and(
      eq(schema.auditLogs.entityId, firstId),
      eq(schema.auditLogs.action, 'provider_application.approve'),
    ));
    assert.equal(audit[0].actorId, ADMIN);
    assert.equal(audit[0].metadata.previousStatus, 'pending_review');
    assert.equal(audit[0].metadata.newStatus, 'approved');

    // Terminal: nothing else is allowed, and approving twice is a 409.
    assert.equal((await review('approve')).status, 409);
    assert.equal((await review('reject', { notes: 'x' })).status, 409);
  });

  it('approves a second business for the same user as a NEW business profile', async () => {
    secondId = await completeDraft(`Lotus Physio ${runId}`, 'individual');
    assert.equal((await call('OWNER', 'POST', `/v1/provider/applications/${secondId}/submit`)).status, 200);
    const approved = await call('admin', 'POST', `/admin/provider/applications/${secondId}/review`, { action: 'approve' });
    assert.equal(approved.status, 200, JSON.stringify(approved.json));
    secondProviderId = approved.json.application.providerId;
    assert.ok(secondProviderId);
    assert.notEqual(secondProviderId, firstProviderId);

    const { eq } = await import('drizzle-orm');
    const owned = await db.select().from(schema.providers).where(eq(schema.providers.mobileUserId, OWNER));
    assert.equal(owned.length, 2);
    assert.deepEqual(
      owned.map((p: Json) => p.sourceApplicationId).sort(),
      [firstId, secondId].sort(),
    );

    const businesses = await call('OWNER', 'GET', '/v1/provider/businesses');
    assert.equal(businesses.status, 200);
    assert.deepEqual(
      (businesses.json.businesses as Json[]).map(b => b.id).sort(),
      [firstProviderId, secondProviderId].sort(),
    );

    // Both appear as publisher identities (PR #27), after the personal one.
    const identities = await listOwnedPublishers(OWNER);
    assert.equal(identities[0].ref.type, 'personal');
    assert.deepEqual(
      identities.slice(1).map((i: Json) => i.ref.id).sort(),
      [firstProviderId, secondProviderId].sort(),
    );
    const lotus = identities.find((i: Json) => i.ref.id === firstProviderId);
    assert.ok(lotus.publisher.avatarUrl, 'logo becomes the business avatar');
  });

  it('requires a reason to reject and lets the applicant reopen and resubmit', async () => {
    rejectedId = await completeDraft(`Rejected Spa ${runId}`);
    assert.equal((await call('OWNER', 'POST', `/v1/provider/applications/${rejectedId}/submit`)).status, 200);
    const noReason = await call('admin', 'POST', `/admin/provider/applications/${rejectedId}/review`, { action: 'reject' });
    assert.equal(noReason.status, 400);
    const rejected = await call('admin', 'POST', `/admin/provider/applications/${rejectedId}/review`, {
      action: 'reject',
      notes: 'Registration certificate is unreadable',
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.json.application.status, 'rejected');
    const notes = await notificationsFor(OWNER);
    assert.equal(notes[0].data.status, 'rejected');

    const mine = await call('OWNER', 'GET', `/v1/provider/applications/${rejectedId}`);
    assert.equal(mine.json.application.reviewNotes, 'Registration certificate is unreadable');
    assert.equal((await call('OWNER', 'POST', `/v1/provider/applications/${firstId}/reopen`)).status, 409);
    const reopened = await call('OWNER', 'POST', `/v1/provider/applications/${rejectedId}/reopen`);
    assert.equal(reopened.status, 200);
    assert.equal(reopened.json.application.status, 'draft');
    assert.equal(reopened.json.application.reviewNotes, 'Registration certificate is unreadable');
    const again = await call('OWNER', 'POST', `/v1/provider/applications/${rejectedId}/submit`);
    assert.equal(again.status, 200, JSON.stringify(again.json));
    assert.equal(again.json.application.status, 'pending_review');
    assert.equal(again.json.application.reviewNotes, null, 'old rejection reason is cleared on resubmit');
  });

  it('lists only approved, active businesses in the marketplace', async () => {
    const byCategory = await call('OTHER', 'GET', `/v1/marketplace/providers?categoryId=${categoryId}`);
    assert.equal(byCategory.status, 200);
    const ids = (byCategory.json.data as Json[]).map(p => p.id).sort();
    assert.deepEqual(ids, [firstProviderId, secondProviderId].sort());
    const card = (byCategory.json.data as Json[]).find(p => p.id === firstProviderId);
    assert.equal(card.city, 'Chennai');
    assert.equal(card.priceFrom, 1500);
    assert.deepEqual(card.modes, ['center', 'home', 'online']);
    assert.equal(card.categories[0].name, `Pilates ${runId}`);
    assert.ok(!JSON.stringify(card).includes('234567890123'), 'never leaks KYC');
    assert.ok(!('mobile' in card) && !('email' in card));

    const search = await call('OTHER', 'GET', `/v1/marketplace/providers?q=${encodeURIComponent(`Physio ${runId}`)}`);
    assert.deepEqual((search.json.data as Json[]).map(p => p.id), [secondProviderId]);
    const byService = await call('OTHER', 'GET', `/v1/marketplace/providers?q=${encodeURIComponent(`Pilates ${runId}`)}`);
    assert.equal((byService.json.data as Json[]).length, 2);

    const detail = await call('OTHER', 'GET', `/v1/marketplace/providers/${firstProviderId}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.provider.name, `Lotus Pilates ${runId}`);

    // Suspended businesses disappear.
    const { eq } = await import('drizzle-orm');
    await db.update(schema.providers).set({ status: 'suspended' }).where(eq(schema.providers.id, secondProviderId));
    const after = await call('OTHER', 'GET', `/v1/marketplace/providers?categoryId=${categoryId}`);
    assert.deepEqual((after.json.data as Json[]).map(p => p.id), [firstProviderId]);
    assert.equal((await call('OTHER', 'GET', `/v1/marketplace/providers/${secondProviderId}`)).status, 404);
    const booking = await call('OTHER', 'POST', '/v1/bookings', {
      providerId: secondProviderId,
      categoryId,
      category: 'appointment',
      serviceMode: 'center',
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      detail: { serviceTitle: 'Physio session' },
    });
    assert.equal(booking.status, 400);
    assert.equal(booking.json.error.code, 'provider_unavailable');
    await db.update(schema.providers).set({ status: 'active' }).where(eq(schema.providers.id, secondProviderId));

    // Viewer-controlled blocks also remove a business from discovery/detail.
    await db.insert(schema.mobileUserBlocks).values({
      blockerMobileUserId: OTHER,
      blockedProviderId: firstProviderId,
    });
    const blocked = await call('OTHER', 'GET', `/v1/marketplace/providers?categoryId=${categoryId}`);
    assert.deepEqual((blocked.json.data as Json[]).map(p => p.id), [secondProviderId]);
    assert.equal((await call('OTHER', 'GET', `/v1/marketplace/providers/${firstProviderId}`)).status, 404);
    await db.delete(schema.mobileUserBlocks).where(eq(schema.mobileUserBlocks.blockerMobileUserId, OTHER));
  });

  it('runs booking lifecycle, permissions, conflicts and notifications end to end', async () => {
    const create = (startsAt: string, title: string) => call('OTHER', 'POST', '/v1/bookings', {
      providerId: firstProviderId,
      categoryId,
      category: 'appointment',
      serviceMode: 'center',
      startsAt,
      durationMinutes: 60,
      amount: 1, // The server must use the approved offering price instead.
      detail: { serviceTitle: title, providerName: 'Untrusted client name' },
    });
    const act = (bookingId: string, action: string, extra: Json = {}) =>
      call('OWNER', 'POST', `/v1/provider/businesses/${firstProviderId}/bookings/${bookingId}/action`, { action, ...extra });

    const firstStart = nextAvailableTime(0, 10);
    const created = await create(firstStart, 'Reformer class');
    assert.equal(created.status, 201, JSON.stringify(created.json));
    const bookingId = created.json.booking.id as string;
    assert.equal(created.json.booking.status, 'pending');
    assert.equal(created.json.booking.amount, 1500);
    assert.equal(created.json.booking.paymentStatus, 'pending');
    assert.equal(created.json.booking.bookingMode, 'on_site');
    assert.equal(created.json.booking.bookingType, 'appointment');
    assert.equal(created.json.booking.viewerRole, 'customer');
    assert.equal(created.json.booking.detail.providerName, `Lotus Pilates ${runId}`);
    {
      const { eq } = await import('drizzle-orm');
      const [persisted] = await db.select().from(schema.bookings)
        .where(eq(schema.bookings.id, bookingId));
      assert.equal(persisted.status, 'pending');
      assert.equal(persisted.amount, 1500);
    }

    let ownerNotes = await notificationsFor(OWNER);
    assert.equal(ownerNotes[0].type, 'booking_created');
    assert.equal(ownerNotes[0].data.bookingId, bookingId);
    assert.equal(ownerNotes[0].data.screen, 'BookingDetail');

    const onlineBooking = await call('OTHER', 'POST', '/v1/bookings', {
      providerId: firstProviderId,
      categoryId,
      category: 'appointment',
      serviceMode: 'online',
      startsAt: nextAvailableTime(0, 15),
      durationMinutes: 60,
      detail: { serviceTitle: 'Online coaching' },
    });
    assert.equal(onlineBooking.status, 201, JSON.stringify(onlineBooking.json));
    assert.equal(onlineBooking.json.booking.bookingMode, 'online');

    const classBooking = await call('OTHER', 'POST', '/v1/bookings', {
      providerId: firstProviderId,
      categoryId,
      category: 'class',
      bookingType: 'group_session',
      serviceMode: 'center',
      startsAt: nextAvailableTime(1, 15),
      durationMinutes: 60,
      detail: { serviceTitle: 'Small group reformer' },
    });
    assert.equal(classBooking.status, 201, JSON.stringify(classBooking.json));
    assert.equal(classBooking.json.booking.bookingType, 'group_session');

    const allList = await call('OTHER', 'GET', '/v1/bookings?filter=all&limit=100');
    const allIds = new Set((allList.json.bookings as Json[]).map(item => item.id));
    assert.ok(allIds.has(bookingId));
    assert.ok(allIds.has(onlineBooking.json.booking.id));
    assert.ok(allIds.has(classBooking.json.booking.id));
    assert.ok(allList.json.counts.all >= 3);
    const onSiteList = await call('OTHER', 'GET', '/v1/bookings?filter=on_site&limit=100');
    const onSiteIds = new Set((onSiteList.json.bookings as Json[]).map(item => item.id));
    assert.ok(onSiteIds.has(bookingId));
    assert.ok(onSiteIds.has(classBooking.json.booking.id));
    assert.ok(!onSiteIds.has(onlineBooking.json.booking.id));
    const onlineList = await call('OTHER', 'GET', '/v1/bookings?filter=online&limit=100');
    assert.ok((onlineList.json.bookings as Json[]).some(item => item.id === onlineBooking.json.booking.id));
    const classList = await call('OTHER', 'GET', '/v1/bookings?filter=classes&limit=100');
    assert.ok((classList.json.bookings as Json[]).some(item => item.id === classBooking.json.booking.id));

    const providerList = await call('OWNER', 'GET', '/v1/bookings?filter=all&limit=100');
    const providerView = (providerList.json.bookings as Json[]).find(item => item.id === bookingId);
    assert.equal(providerView.viewerRole, 'provider');
    assert.equal(providerView.customerName, 'Bala Customer');

    const overlapping = await create(
      new Date(new Date(firstStart).getTime() + 30 * 60_000).toISOString(),
      'Overlapping class',
    );
    assert.equal(overlapping.status, 409);
    assert.equal(overlapping.json.error.code, 'duplicate_booking');

    const dash = await call('OWNER', 'GET', `/v1/provider/businesses/${firstProviderId}`);
    assert.equal(dash.status, 200);
    assert.equal(dash.json.business.counts.upcomingBookings, 3);
    assert.equal(dash.json.business.upcomingBookings[0].customerName, 'Bala Customer');
    assert.equal(dash.json.business.services[0].categoryId, categoryId);

    // Neither a random user nor the customer lifecycle endpoint can accept it.
    assert.equal((await call('OTHER', 'POST', `/v1/provider/businesses/${firstProviderId}/bookings/${bookingId}/action`, { action: 'accept' })).status, 404);
    assert.equal((await call('OTHER', 'PATCH', `/v1/bookings/${bookingId}`, { status: 'confirmed' })).status, 400);
    assert.equal((await call('OWNER', 'PATCH', `/v1/bookings/${bookingId}`, { detail: { notes: 'tamper' } })).status, 404);
    assert.equal((await call('OTHER', 'POST', `/admin/provider/applications/${rejectedId}/review`, { action: 'approve' })).status, 403);

    const accepted = await act(bookingId, 'accept');
    assert.equal(accepted.status, 200, JSON.stringify(accepted.json));
    assert.equal(accepted.json.booking.status, 'confirmed');
    let customerNotes = await notificationsFor(OTHER);
    assert.equal(customerNotes[0].type, 'booking_confirmed');
    assert.equal(customerNotes[0].data.screen, 'BookingDetail');

    const customerMovedStart = nextAvailableTime(2, 15);
    const customerMoved = await call(
      'OTHER',
      'POST',
      `/v1/bookings/${onlineBooking.json.booking.id}/reschedule`,
      { startsAt: customerMovedStart, reason: 'Customer requested another day' },
    );
    assert.equal(customerMoved.status, 200, JSON.stringify(customerMoved.json));
    assert.equal(customerMoved.json.booking.status, 'reschedule_requested');
    assert.equal(customerMoved.json.booking.startsAt, customerMovedStart);
    ownerNotes = await notificationsFor(OWNER);
    assert.equal(ownerNotes[0].type, 'booking_rescheduled');
    assert.equal(ownerNotes[0].data.bookingId, onlineBooking.json.booking.id);
    assert.equal((await act(onlineBooking.json.booking.id, 'accept')).json.booking.status, 'confirmed');
    assert.equal((await call('OTHER', 'POST', `/v1/bookings/${onlineBooking.json.booking.id}/cancel`, { reason: 'Cleanup' })).json.booking.status, 'cancelled');

    assert.equal((await act(classBooking.json.booking.id, 'accept')).json.booking.status, 'confirmed');
    assert.equal((await act(classBooking.json.booking.id, 'complete')).json.booking.status, 'completed');

    const movedStart = new Date(new Date(firstStart).getTime() + 90 * 60_000).toISOString();
    const moved = await act(bookingId, 'reschedule', { startsAt: movedStart, reason: 'Trainer availability changed' });
    assert.equal(moved.status, 200, JSON.stringify(moved.json));
    assert.equal(moved.json.booking.status, 'reschedule_requested');
    assert.equal(moved.json.booking.startsAt, movedStart);
    customerNotes = await notificationsFor(OTHER);
    assert.equal(customerNotes[0].type, 'booking_rescheduled');

    const customerView = await call('OTHER', 'GET', `/v1/bookings/${bookingId}`);
    assert.equal(customerView.json.booking.status, 'reschedule_requested');
    const customerAccepted = await call('OTHER', 'POST', `/v1/bookings/${bookingId}/confirm-reschedule`);
    assert.equal(customerAccepted.status, 200, JSON.stringify(customerAccepted.json));
    assert.equal(customerAccepted.json.booking.status, 'confirmed');
    ownerNotes = await notificationsFor(OWNER);
    assert.equal(ownerNotes[0].type, 'booking_confirmed');
    const cancelled = await call('OTHER', 'POST', `/v1/bookings/${bookingId}/cancel`, { reason: 'Cannot attend the new time' });
    assert.equal(cancelled.status, 200, JSON.stringify(cancelled.json));
    assert.equal(cancelled.json.booking.status, 'cancelled');
    ownerNotes = await notificationsFor(OWNER);
    assert.equal(ownerNotes[0].type, 'booking_cancelled');

    const raceStart = nextAvailableTime(2, 10);
    const raced = await Promise.all([
      create(raceStart, 'Concurrent request A'),
      create(raceStart, 'Concurrent request B'),
    ]);
    assert.deepEqual(raced.map(result => result.status).sort(), [201, 409]);
    const raceWinner = raced.find(result => result.status === 201)!;
    assert.equal((await act(raceWinner.json.booking.id, 'reject', { reason: 'Concurrency test cleanup' })).status, 200);

    const rejectedBooking = await create(nextAvailableTime(0, 13), 'Private session');
    assert.equal(rejectedBooking.status, 201, JSON.stringify(rejectedBooking.json));
    const rejectedAction = await act(rejectedBooking.json.booking.id, 'reject', { reason: 'Slot unavailable' });
    assert.equal(rejectedAction.json.booking.status, 'rejected');
    customerNotes = await notificationsFor(OTHER);
    assert.equal(customerNotes[0].type, 'booking_rejected');

    const completedBooking = await create(nextAvailableTime(1, 10), 'Assessment');
    assert.equal(completedBooking.status, 201, JSON.stringify(completedBooking.json));
    assert.equal((await act(completedBooking.json.booking.id, 'accept')).json.booking.status, 'confirmed');
    const completed = await act(completedBooking.json.booking.id, 'complete');
    assert.equal(completed.json.booking.status, 'completed');
    customerNotes = await notificationsFor(OTHER);
    assert.equal(customerNotes[0].type, 'booking_completed');

    const reminderBooking = await create(nextAvailableTime(1, 13), 'Reminder session');
    assert.equal(reminderBooking.status, 201, JSON.stringify(reminderBooking.json));
    assert.equal((await act(reminderBooking.json.booking.id, 'accept')).status, 200);
    const { eq } = await import('drizzle-orm');
    const reminderStart = new Date(Date.now() + 60 * 60_000);
    await db.update(schema.bookings).set({
      startsAt: reminderStart,
      endsAt: new Date(reminderStart.getTime() + 60 * 60_000),
      reminderSentAt: null,
    }).where(eq(schema.bookings.id, reminderBooking.json.booking.id));
    const { bookingService } = await import('../booking/BookingService.js');
    assert.ok(await bookingService.sendDueReminders(new Date()));
    customerNotes = await notificationsFor(OTHER);
    ownerNotes = await notificationsFor(OWNER);
    assert.equal(customerNotes[0].type, 'booking_reminder');
    assert.equal(ownerNotes[0].type, 'booking_reminder');
    assert.equal(ownerNotes[0].data.screen, 'BookingDetail');

    const edited = await call('OWNER', 'PATCH', `/v1/provider/businesses/${firstProviderId}`, {
      description: 'Small-group reformer Pilates',
      pricingStartsAt: '1200',
    });
    assert.equal(edited.status, 200, JSON.stringify(edited.json));
    assert.equal(edited.json.business.profile.description, 'Small-group reformer Pilates');
    assert.equal(edited.json.business.profile.pricingStartsAt, 1200);

    // Not a member -> 404; unknown fields rejected.
    assert.equal((await call('OTHER', 'GET', `/v1/provider/businesses/${firstProviderId}`)).status, 404);
    assert.equal((await call('OWNER', 'PATCH', `/v1/provider/businesses/${firstProviderId}`, { name: 'x' })).status, 400);
  });
});
