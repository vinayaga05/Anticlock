import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BulkBlasterDelivery, BULKBLASTER_OTP_URL } from './bulkBlasterDelivery.js';
import { OtpError } from './types.js';
const config = { apiKey: 'fake-server-test-key', brandName: 'Anticlock', senderType: 'DASSAM' };
const input = { phone: '+919123456789', code: '042851', requestId: 'test-request', expiresInSeconds: 300 };
describe('BulkBlaster OTP delivery contract', () => {
  it('uses the OTP endpoint, body-key authentication, India phone, approved sender fields and backend code', async () => {
    let seen: any;
    const delivery = new BulkBlasterDelivery({ config, fetch: (async (url, options) => { seen = { url, options }; return new Response(JSON.stringify({ success: true, message: 'queued' }), { status: 200 }); }) as typeof fetch });
    await delivery.send(input);
    assert.equal(seen.url, BULKBLASTER_OTP_URL); assert.equal(seen.options.method, 'POST');
    assert.deepEqual(seen.options.headers, { 'Content-Type': 'application/json', Accept: 'application/json' });
    assert.deepEqual(JSON.parse(seen.options.body), { apiKey: config.apiKey, phone: '9123456789', otp: input.code, brandName: 'Anticlock', senderType: 'DASSAM' });
  });
  it('requires HTTP success AND boolean success true', async () => {
    for (const [status, body] of [[200, { success: false }], [200, { success: 'true' }], [500, { success: true }]] as const) {
      const delivery = new BulkBlasterDelivery({ config, fetch: (async () => new Response(JSON.stringify(body), { status })) as typeof fetch });
      await assert.rejects(delivery.send(input), OtpError);
    }
  });
  it('maps configuration, balance, rejection, rate and outage failures without leaking provider payloads', async () => {
    for (const [status, code] of [[400, 'sms_delivery_rejected'], [401, 'sms_unavailable'], [403, 'sms_unavailable'], [429, 'sms_rate_limited'], [500, 'sms_send_failed']] as const) {
      const delivery = new BulkBlasterDelivery({ config, fetch: (async () => new Response(JSON.stringify({ success: false, error: 'secret-account-details' }), { status })) as typeof fetch });
      await assert.rejects(delivery.send(input), (error: any) => { assert.equal(error.code, code); assert.ok(!error.message.includes('secret-account')); return true; });
    }
  });
  it('does not send when credentials, sender type, phone or generated code are invalid', async () => {
    let calls = 0; const fetch = (async () => { calls++; return new Response('{}'); }) as typeof globalThis.fetch;
    for (const invalid of [{ ...config, apiKey: '' }, { ...config, senderType: 'UNKNOWN' }]) await assert.rejects(new BulkBlasterDelivery({ config: invalid, fetch }).send(input));
    await assert.rejects(new BulkBlasterDelivery({ config, fetch }).send({ ...input, phone: '+14155552671' }));
    await assert.rejects(new BulkBlasterDelivery({ config, fetch }).send({ ...input, code: 'abcdef' }));
    assert.equal(calls, 0);
  });
  it('times out the full response body, aborts and does not retry', async () => {
    let calls = 0; let signal: AbortSignal | undefined;
    const fetch = (async (_url, options) => { calls++; signal = options?.signal as AbortSignal; return { ok: true, json: () => new Promise(() => {}) } as unknown as Response; }) as typeof globalThis.fetch;
    await assert.rejects(new BulkBlasterDelivery({ config, fetch, timeoutMs: 10 }).send(input), (error: any) => error.code === 'sms_timeout');
    assert.equal(signal?.aborted, true); assert.equal(calls, 1);
  });
  it('redacts invalid JSON and network exceptions', async () => {
    for (const fetch of [(async () => new Response('secret raw body', { status: 200 })) as typeof globalThis.fetch, (async () => { throw new Error('secret network URL/token'); }) as typeof globalThis.fetch]) {
      await assert.rejects(new BulkBlasterDelivery({ config, fetch }).send(input), (error: any) => !error.message.includes('secret'));
    }
  });
});
