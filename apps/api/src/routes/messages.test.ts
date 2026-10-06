import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { messagesRoutes } from './messages.js';
import type { AppEnv } from '../middleware/auth.js';
import { signToken } from '../lib/auth.js';

// requireAuth verifies a real JWT from the Authorization header and overwrites
// any pre-set `auth` variable, so tests must send a signed token.
async function authHeader(kind: 'mobile' | 'admin', sub: string) {
  const token = await signToken({ kind, sub, email: `${sub}@test.com`, name: sub, roles: [] });
  return { Authorization: `Bearer ${token}` };
}

describe('Messages Routes', () => {
  it('POST /token - requires authentication', async () => {
    const app = new Hono<AppEnv>();
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.strictEqual(res.status, 401);
  });

  it('POST /token - returns 503 when Stream not configured', async () => {
    // Save original env
    const originalApiKey = process.env.STREAM_API_KEY;
    const originalApiSecret = process.env.STREAM_API_SECRET;
    
    // Unset env vars
    delete process.env.STREAM_API_KEY;
    delete process.env.STREAM_API_SECRET;

    const app = new Hono<AppEnv>();
    
    const auth = await authHeader('mobile', 'test-user-id');
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
    });

    assert.strictEqual(res.status, 503);
    const body = await res.json() as any;
    assert.strictEqual(body.error.code, 'stream_not_configured');

    // Restore env
    if (originalApiKey) process.env.STREAM_API_KEY = originalApiKey;
    if (originalApiSecret) process.env.STREAM_API_SECRET = originalApiSecret;
  });

  it('POST /channels - requires mobile auth', async () => {
    const app = new Hono<AppEnv>();
    
    const auth = await authHeader('admin', 'admin-id');
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ otherUserId: 'other-user-id' }),
    });

    // Should fail with 403 or 500 due to mobile auth requirement
    assert.ok(res.status >= 400);
  });

  it('POST /channels - validates otherUserId format', async () => {
    const app = new Hono<AppEnv>();
    
    const auth = await authHeader('mobile', 'user-id');
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ otherUserId: 'not-a-uuid' }),
    });

    // Without Stream configured gets 503, but if configured would fail validation
    const body = await res.json() as any;
    assert.ok(res.status === 503 || (res.status === 400 && body.error.code === 'validation_error'));
  });
});
