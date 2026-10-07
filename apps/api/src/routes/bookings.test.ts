import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { bookingAdminRoutes, bookingMobileRoutes } from './bookings.js';
import type { AppEnv } from '../middleware/auth.js';
import { signToken } from '../lib/auth.js';

async function authHeader(kind: 'mobile' | 'admin', sub: string) {
  const token = await signToken({ kind, sub, email: `${sub}@test.com`, name: sub, roles: [] });
  return { Authorization: `Bearer ${token}` };
}

function buildApp() {
  const app = new Hono<AppEnv>();
  app.route('/v1/bookings', bookingMobileRoutes);
  app.route('/admin/bookings', bookingAdminRoutes);
  return app;
}

describe('Booking Routes', () => {
  for (const [method, path] of [
    ['GET', '/v1/bookings'],
    ['GET', '/v1/bookings?status=upcoming'],
    ['POST', '/v1/bookings'],
    ['GET', '/v1/bookings/b1'],
    ['PATCH', '/v1/bookings/b1'],
    ['POST', '/v1/bookings/b1/cancel'],
    ['GET', '/admin/bookings'],
  ] as const) {
    it(`${method} ${path} - requires authentication`, async () => {
      const res = await buildApp().request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.strictEqual(res.status, 401);
    });
  }

  it('GET /v1/bookings - rejects non-mobile sessions', async () => {
    const res = await buildApp().request('/v1/bookings', {
      headers: await authHeader('admin', 'admin-1'),
    });
    assert.strictEqual(res.status, 403);
  });

  it('GET /v1/bookings - rejects invalid status filter with 400', async () => {
    const res = await buildApp().request('/v1/bookings?status=bogus', {
      headers: await authHeader('mobile', 'user-1'),
    });
    assert.strictEqual(res.status, 400);
  });

  it('POST /v1/bookings - rejects invalid body with 400', async () => {
    const res = await buildApp().request('/v1/bookings', {
      method: 'POST',
      headers: { ...(await authHeader('mobile', 'user-1')), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });
});
