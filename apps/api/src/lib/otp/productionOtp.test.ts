import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createOtpProvider, assertProductionOtpConfiguration } from './index.js';
import { DurableOtpProvider, type OtpEvent } from './durableOtpProvider.js';
import type { OtpStore, ReserveOtp, VerifyOtp } from './postgresOtpStore.js';
const keys = ['NODE_ENV', 'SMS_PROVIDER', 'BULKBLASTER_API_KEY', 'BULKBLASTER_BRAND_NAME', 'BULKBLASTER_SENDER_TYPE', 'OTP_HASH_SECRET', 'OTP_DEV_WHITELIST', 'OTP_TEST_LOGIN_ENABLED', 'TEST_LOGIN_DISABLED'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
afterEach(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
function goodConfig() { process.env.NODE_ENV = 'production'; process.env.SMS_PROVIDER = 'bulkblaster'; process.env.BULKBLASTER_API_KEY = 'fake-test-key'; process.env.BULKBLASTER_BRAND_NAME = 'Anticlock'; process.env.BULKBLASTER_SENDER_TYPE = 'DASSAM'; process.env.OTP_HASH_SECRET = 'a-test-only-pepper-that-is-over-thirty-two-characters'; process.env.OTP_DEV_WHITELIST = 'false'; process.env.OTP_TEST_LOGIN_ENABLED = 'false'; process.env.TEST_LOGIN_DISABLED = 'true'; }
class RecordingStore implements OtpStore {
  reserveInput?: ReserveOtp; verifyInput?: VerifyOtp; failed = false;
  async reserve(input: ReserveOtp) { this.reserveInput = input; return null; }
  async activate() { return true; }
  async fail() { this.failed = true; }
  async verify(input: VerifyOtp) { this.verifyInput = input; return { valid: false }; }
}
describe('production OTP configuration', () => {
  it('always constructs the real durable provider even if development flags are supplied', () => { goodConfig(); process.env.OTP_DEV_WHITELIST = 'true'; process.env.OTP_TEST_LOGIN_ENABLED = 'true'; process.env.TEST_LOGIN_DISABLED = 'false'; assert.ok(createOtpProvider() instanceof DurableOtpProvider); assert.throws(assertProductionOtpConfiguration, /forbidden/); });
  it('fails closed for missing provider credentials, sender or independent hash secret', () => { for (const key of ['SMS_PROVIDER', 'BULKBLASTER_API_KEY', 'OTP_HASH_SECRET']) { goodConfig(); delete process.env[key]; assert.throws(assertProductionOtpConfiguration); } goodConfig(); process.env.BULKBLASTER_SENDER_TYPE = 'unknown'; assert.throws(assertProductionOtpConfiguration); });
  it('accepts correctly configured real delivery while nonproduction import needs no credentials', () => { goodConfig(); assert.doesNotThrow(assertProductionOtpConfiguration); process.env.NODE_ENV = 'test'; for (const key of ['BULKBLASTER_API_KEY', 'OTP_HASH_SECRET']) delete process.env[key]; assert.doesNotThrow(() => createOtpProvider()); });
});
describe('durable OTP orchestration boundaries', () => {
  it('persists only protected hashes with exact five-minute expiry and sixty-second resend time', async () => {
    const store = new RecordingStore(); const events: OtpEvent[] = []; let delivered: any;
    const provider = new DurableOtpProvider({ store, pepper: 'a-test-only-secret-at-least-thirty-two-chars', clock: () => 1_700_000_000_000, randomCode: () => '042851', delivery: { send: async input => { delivered = input; } }, event: event => events.push(event) });
    const response = await provider.sendOtp('+919123456789', { ip: '192.0.2.1', deviceId: 'test-installation' });
    assert.equal(response.expiresInSeconds, 300); assert.equal(Date.parse(response.expiresAt) - 1_700_000_000_000, 300_000); assert.equal(Date.parse(response.resendAvailableAt) - 1_700_000_000_000, 60_000);
    assert.equal(delivered.code, '042851'); assert.match(store.reserveInput!.codeHash, /^[0-9a-f]{64}$/); assert.match(store.reserveInput!.phoneHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(store.reserveInput).includes('042851')); assert.ok(!JSON.stringify(store.reserveInput).includes('9123456789')); assert.ok(!JSON.stringify(events).includes('042851')); assert.ok(!JSON.stringify(events).includes('9123456789'));
    await provider.verifyOtp('+919123456789', '042851', response.requestId, { deviceId: 'test-installation' });
    assert.equal(store.verifyInput!.codeHash, store.reserveInput!.codeHash);
  });
  it('marks provider failures unusable and redacts exceptions/events', async () => {
    const store = new RecordingStore(); const events: OtpEvent[] = [];
    const provider = new DurableOtpProvider({ store, pepper: 'a-test-only-secret-at-least-thirty-two-chars', delivery: { send: async () => { throw new Error('secret SMS body/key'); } }, event: event => events.push(event) });
    await assert.rejects(provider.sendOtp('+919123456789'), (error: any) => error.code === 'sms_send_failed' && !error.message.includes('secret'));
    assert.equal(store.failed, true); assert.ok(!JSON.stringify(events).includes('secret'));
  });
  it('rejects weak hash configuration before storing or delivering any code', async () => {
    const store = new RecordingStore(); let sends = 0;
    const provider = new DurableOtpProvider({ store, pepper: 'weak', delivery: { send: async () => { sends++; } } });
    await assert.rejects(provider.sendOtp('+919123456789'), (error: any) => error.code === 'otp_not_configured'); assert.equal(sends, 0); assert.equal(store.reserveInput, undefined);
  });
});
