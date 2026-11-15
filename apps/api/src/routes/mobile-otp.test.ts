import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import { createAuthRoutes } from './auth.js';
import { OtpError, type OtpContext, type OtpProvider } from '../lib/otp/index.js';

const originalTrust = process.env.OTP_TRUST_PROXY;
afterEach(() => {
  if (originalTrust === undefined) delete process.env.OTP_TRUST_PROXY;
  else process.env.OTP_TRUST_PROXY = originalTrust;
  mock.restoreAll();
});
function harness(send: OtpProvider['sendOtp']) {
  return new Hono().route('/auth', createAuthRoutes({ otpProvider: { sendOtp: send, verifyOtp: async () => false } }));
}
const request = (body: string, forwarded?: string) => ({ method: 'POST', headers: { 'content-type': 'application/json', ...(forwarded ? { 'x-forwarded-for': forwarded } : {}) }, body });
const sendBody = JSON.stringify({ phone: '+919000000001', deviceId: 'test-installation' });
const sent = { requestId: 'fixture-request', expiresInSeconds: 300, expiresAt: '2099-01-01T00:05:00Z', resendAvailableAt: '2099-01-01T00:01:00Z' };

describe('mobile OTP boundaries', () => {
  it('does not trust a forged forwarded IP unless a trusted proxy is configured', async () => {
    delete process.env.OTP_TRUST_PROXY;
    let context: OtpContext | undefined;
    const app = harness(async (_phone, value) => { context = value; return sent; });
    assert.equal((await app.request('/auth/mobile/otp/send', request(sendBody, '192.0.2.1'))).status, 200);
    assert.deepEqual(context, { ip: undefined, deviceId: 'test-installation' });
    process.env.OTP_TRUST_PROXY = 'true';
    await app.request('/auth/mobile/otp/send', request(sendBody, '192.0.2.1, 198.51.100.4'));
    assert.equal(context?.ip, '198.51.100.4');
  });
  it('returns a server retry deadline for a locked challenge', async () => {
    const app = harness(async () => { throw new OtpError('otp_locked', 'Try again later.', 900); });
    const response = await app.request('/auth/mobile/otp/send', request(sendBody));
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('retry-after'), '900');
    assert.deepEqual(await response.json(), { error: { code: 'otp_locked', message: 'Try again later.', retryAfterSeconds: 900 } });
  });
  it('never logs or returns database/provider exception payloads', async () => {
    const logs: unknown[][] = [];
    mock.method(console, 'error', (...values) => { logs.push(values); });
    const app = harness(async () => { throw new Error('sensitive challenge hash, provider key or SMS body'); });
    const response = await app.request('/auth/mobile/otp/send', request(sendBody));
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: { code: 'otp_unavailable', message: 'Sign-in is temporarily unavailable. Please try again.' } });
    assert.equal(JSON.stringify(logs).includes('sensitive'), false);
  });
  it('rejects malformed and oversized requests before calling delivery', async () => {
    let calls = 0;
    const app = harness(async () => { calls += 1; return sent; });
    for (const body of ['{bad', JSON.stringify({ phone: '+441234567890' }), JSON.stringify({ phone: '+919000000001', deviceId: 'x'.repeat(3000) })]) {
      const response = await app.request('/auth/mobile/otp/send', request(body));
      assert.ok(response.status === 400 || response.status === 413);
    }
    assert.equal(calls, 0);
  });
  it('cannot mint a verified identity using a caller-selected device ID', async () => {
    const app = harness(async () => sent);
    const response = await app.request('/auth/mobile/token', request(JSON.stringify({ deviceId: 'chosen-victim-id' })));
    assert.equal(response.status, 410); assert.equal('token' in await response.json(), false);
  });
});
