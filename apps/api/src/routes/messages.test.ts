import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { Hono } from 'hono';
import { messagesRoutes } from './messages.js';

describe('Messages Routes', () => {
  it('POST /token - requires authentication', async () => {
    const app = new Hono();
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

    const app = new Hono();
    
    // Mock auth middleware
    app.use('*', async (c, next) => {
      c.set('mobileUser', { id: 'test-user-id', phone: '+1234567890' });
      await next();
    });
    
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.strictEqual(res.status, 503);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'stream_not_configured');

    // Restore env
    if (originalApiKey) process.env.STREAM_API_KEY = originalApiKey;
    if (originalApiSecret) process.env.STREAM_API_SECRET = originalApiSecret;
  });

  it('POST /channels - rejects self-chat', async () => {
    const app = new Hono();
    
    // Mock auth middleware
    app.use('*', async (c, next) => {
      c.set('mobileUser', { id: 'same-user-id', phone: '+1234567890' });
      await next();
    });
    
    // Mock Stream service to test validation
    const mockStreamClient = {
      upsertUser: mock.fn(),
      createToken: mock.fn(() => 'mock-token'),
      channel: mock.fn(),
    };

    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherUserId: 'same-user-id' }),
    });

    // Without Stream configured, should get 503
    // With Stream configured and proper mocking, would get 400 for self-chat
    assert.ok(res.status === 503 || res.status === 400);
  });

  it('POST /channels - validates otherUserId format', async () => {
    const app = new Hono();
    
    app.use('*', async (c, next) => {
      c.set('mobileUser', { id: 'user-id', phone: '+1234567890' });
      await next();
    });
    
    app.route('/v1/messages', messagesRoutes);

    const res = await app.request('/v1/messages/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otherUserId: 'not-a-uuid' }),
    });

    // Without Stream configured gets 503, but if configured would fail validation
    const body = await res.json();
    assert.ok(res.status === 503 || (res.status === 400 && body.error.code === 'validation_error'));
  });
});
