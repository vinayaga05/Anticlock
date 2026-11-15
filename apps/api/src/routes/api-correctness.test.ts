/**
 * DB-backed regression tests for API correctness bugs found in the app audit:
 *  - GET /v1/courses/enrollments was shadowed by GET /v1/courses/:id (500)
 *  - raw JS Date interpolated into drizzle `sql` templates (500 on cursor pages)
 *  - malformed cursors / ids reached Postgres and surfaced as 500s that leaked SQL
 * Runs only when TEST_DATABASE_URL is set (CI provides one).
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL?.trim();
if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

type Json = Record<string, any>;

describe('API correctness regressions (integration)', { skip: !TEST_DATABASE_URL }, () => {
  let app: { request: (path: string, init?: RequestInit) => Promise<Response> };
  let db: any;
  let sqlClient: any;
  let schema: any;
  const runId = randomUUID().slice(0, 8);
  const USER = randomUUID();
  const courseIds: string[] = [];
  let token = '';
  let adminToken = '';

  async function call(path: string, init: RequestInit = {}, as: 'user' | 'admin' = 'user') {
    const res = await app.request(path, {
      ...init,
      headers: {
        authorization: `Bearer ${as === 'admin' ? adminToken : token}`,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    const text = await res.text();
    return { status: res.status, json: (text ? JSON.parse(text) : {}) as Json };
  }

  before(async () => {
    const { Hono } = await import('hono');
    const { httpError } = await import('../lib/httpError.js');
    const courses = await import('./courses.js');
    const notifications = await import('./notifications.js');
    const bookings = await import('./bookings.js');
    const shop = await import('./shop.js');
    const trips = await import('./trips.js');
    const { moderationAdminRoutes } = await import('./moderation.js');
    const { signToken } = await import('../lib/auth.js');
    const client = await import('../db/client.js');
    db = client.db;
    sqlClient = client.sql;
    schema = await import('../db/schema.js');

    const hono = new Hono();
    hono.route('/v1/courses', courses.coursesMobileRoutes);
    hono.route('/admin/courses', courses.coursesAdminRoutes);
    hono.route('/v1/notifications', notifications.notificationsMobileRoutes);
    hono.route('/v1/bookings', bookings.bookingMobileRoutes);
    hono.route('/v1/shop', shop.shopMobileRoutes);
    hono.route('/v1/trips', trips.tripsMobileRoutes);
    hono.route('/admin/moderation', moderationAdminRoutes);
    hono.onError((err, c) => {
      const { status, body } = httpError(err, 'test');
      return c.json(body, status);
    });
    app = hono as unknown as typeof app;

    await db.insert(schema.mobileUsers).values({ id: USER, phone: `+91x${runId}`, displayName: 'Audit Learner' });
    // Three published courses with distinct creation times for cursor paging.
    for (let i = 0; i < 3; i += 1) {
      const [row] = await db
        .insert(schema.courses)
        .values({
          slug: `audit-course-${runId}-${i}`,
          name: `Audit course ${i}`,
          shortDescription: 'Short',
          description: 'Long',
          difficulty: 'beginner',
          durationHours: 2,
          price: 49900,
          instructorName: 'Meera Iyer',
          status: 'published',
          createdAt: new Date(Date.now() - (i + 1) * 60_000),
        })
        .returning({ id: schema.courses.id });
      courseIds.push(row.id);
    }
    token = await signToken({ sub: USER, email: '', name: 'Audit Learner', roles: [], kind: 'mobile' });
    adminToken = await signToken({
      sub: randomUUID(),
      email: 'admin@example.com',
      name: 'Admin',
      roles: [],
      permissions: ['moderation.act', 'catalog.read', 'catalog.write', 'courses.manage'],
      kind: 'admin',
    });
  });

  after(async () => {
    if (!db) return;
    await db.delete(schema.courseEnrollments).where(
      (await import('drizzle-orm')).eq(schema.courseEnrollments.mobileUserId, USER),
    );
    for (const id of courseIds) {
      await db.delete(schema.courses).where((await import('drizzle-orm')).eq(schema.courses.id, id));
    }
    await db.delete(schema.mobileUsers).where((await import('drizzle-orm')).eq(schema.mobileUsers.id, USER));
    await sqlClient.end({ timeout: 5 });
  });

  it('GET /v1/courses/enrollments is not captured by /:id', async () => {
    const empty = await call('/v1/courses/enrollments');
    assert.equal(empty.status, 200, JSON.stringify(empty.json));
    assert.deepEqual(empty.json.enrollments, []);

    const enrolled = await call(`/v1/courses/${courseIds[0]}/enroll`, { method: 'POST', body: '{}' });
    assert.equal(enrolled.status, 201, JSON.stringify(enrolled.json));

    const list = await call('/v1/courses/enrollments');
    assert.equal(list.status, 200, JSON.stringify(list.json));
    assert.equal(list.json.enrollments.length, 1);

    const detail = await call(`/v1/courses/${courseIds[0]}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.json.course.id, courseIds[0]);
  });

  it('pages courses with a timestamp cursor (no raw Date in sql)', async () => {
    const cursor = new Date(Date.now() - 90_000).toISOString();
    const page = await call(`/v1/courses?limit=50&cursor=${encodeURIComponent(cursor)}`);
    assert.equal(page.status, 200, JSON.stringify(page.json));
    const ids = page.json.courses.map((c: Json) => c.id);
    assert.ok(ids.includes(courseIds[1]));
    assert.ok(ids.includes(courseIds[2]));
    assert.ok(!ids.includes(courseIds[0]));

    const enrollments = await call(`/v1/courses/enrollments?cursor=${encodeURIComponent(new Date().toISOString())}`);
    assert.equal(enrollments.status, 200, JSON.stringify(enrollments.json));
  });

  it('rejects malformed cursors with 400 instead of 500', async () => {
    for (const path of [
      '/v1/courses?cursor=garbage',
      '/v1/courses/enrollments?cursor=garbage',
      '/v1/notifications?cursor=garbage',
      '/v1/bookings?cursor=garbage',
      '/v1/shop/orders?cursor=garbage',
      '/v1/trips/trip-bookings?cursor=garbage',
    ]) {
      const res = await call(path);
      assert.equal(res.status, 400, `${path} -> ${res.status} ${JSON.stringify(res.json)}`);
      assert.equal(res.json.error.code, 'invalid_cursor');
    }
    const mod = await call('/admin/moderation/reports?cursor=garbage', {}, 'admin');
    assert.equal(mod.status, 400, JSON.stringify(mod.json));
  });

  it('treats malformed ids as 404 and never leaks SQL', async () => {
    for (const path of ['/v1/courses/not-a-uuid', '/v1/shop/products/not-a-uuid', '/v1/trips/trips/not-a-uuid']) {
      const res = await call(path);
      assert.equal(res.status, 404, `${path} -> ${res.status} ${JSON.stringify(res.json)}`);
      assert.doesNotMatch(JSON.stringify(res.json), /select|Failed query/i);
    }
  });

  it('admin GET /admin/courses/enrollments is not captured by /:id', async () => {
    const res = await call('/admin/courses/enrollments', {}, 'admin');
    assert.notEqual(res.status, 500, JSON.stringify(res.json));
    assert.doesNotMatch(JSON.stringify(res.json), /Failed query/i);
  });
});
