import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Hono } from 'hono';
import { exploreAdminRoutes, exploreMobileRoutes } from './explore.js';
import { shopAdminRoutes, shopMobileRoutes } from './shop.js';
import type { AppEnv } from '../middleware/auth.js';
import { signToken } from '../lib/auth.js';
import type { Permission } from '@anticlock/contracts';

async function authHeader(kind: 'mobile' | 'admin', permissions: Permission[] = []) {
  const token = await signToken({
    kind,
    sub: '3ecdda28-0747-4357-aa2c-6c2e67f6e861',
    email: 'audit@example.com',
    name: 'Audit',
    roles: [],
    permissions,
  });
  return { Authorization: `Bearer ${token}` };
}

function app() {
  const instance = new Hono<AppEnv>();
  instance.route('/v1/explore', exploreMobileRoutes);
  instance.route('/v1/shop', shopMobileRoutes);
  instance.route('/admin/explore', exploreAdminRoutes);
  instance.route('/admin/shop', shopAdminRoutes);
  return instance;
}

describe('Explore route authorization', () => {
  it('requires authentication for every mobile submission endpoint', async () => {
    const event = await app().request('/v1/explore/events', { method: 'POST', body: '{}' });
    const product = await app().request('/v1/shop/products', { method: 'POST', body: '{}' });
    assert.equal(event.status, 401);
    assert.equal(product.status, 401);
  });

  it('rejects invalid submissions before any database action', async () => {
    const headers = { ...(await authHeader('mobile')), 'Content-Type': 'application/json' };
    const event = await app().request('/v1/explore/events', { method: 'POST', headers, body: '{}' });
    const product = await app().request('/v1/shop/products', { method: 'POST', headers, body: '{}' });
    assert.equal(event.status, 400);
    assert.equal(product.status, 400);
  });

  it('does not let a catalog reader perform moderation actions', async () => {
    const headers = { ...(await authHeader('admin', ['catalog.read'])), 'Content-Type': 'application/json' };
    const event = await app().request('/admin/explore/events/3ecdda28-0747-4357-aa2c-6c2e67f6e861/review', {
      method: 'POST', headers, body: JSON.stringify({ action: 'approve' }),
    });
    const product = await app().request('/admin/shop/products/3ecdda28-0747-4357-aa2c-6c2e67f6e861/review', {
      method: 'POST', headers, body: JSON.stringify({ action: 'approve' }),
    });
    assert.equal(event.status, 403);
    assert.equal(product.status, 403);
  });

  it('does not let a mobile session access Admin queues', async () => {
    const headers = await authHeader('mobile');
    const event = await app().request('/admin/explore/events', { headers });
    const product = await app().request('/admin/shop/products', { headers });
    assert.equal(event.status, 403);
    assert.equal(product.status, 403);
  });
});
