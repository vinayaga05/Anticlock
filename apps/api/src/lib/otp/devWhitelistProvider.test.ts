import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { OtpError, normalizePhone } from './types.js';

const previous = { NODE_ENV: process.env.NODE_ENV, OTP_DEV_WHITELIST: process.env.OTP_DEV_WHITELIST };
describe('explicit local OTP whitelist', () => {
  let now: number; let provider: DevWhitelistOtpProvider;
  beforeEach(() => { process.env.NODE_ENV = 'test'; process.env.OTP_DEV_WHITELIST = 'true'; now = Date.now(); provider = new DevWhitelistOtpProvider(undefined, undefined, () => now); });
  afterEach(() => { for (const [name, value] of Object.entries(previous)) if (value === undefined) delete process.env[name]; else process.env[name] = value; });
  it('requires an explicit development flag', async () => { process.env.OTP_DEV_WHITELIST = 'false'; await assert.rejects(provider.sendOtp('8888888888'), (e: any) => e.code === 'phone_not_allowed'); });
  it('refuses static codes in production even with the flag', async () => { process.env.NODE_ENV = 'production'; await assert.rejects(provider.sendOtp('8888888888')); await assert.rejects(provider.verifyOtp('8888888888', '123456', 'old')); });
  it('accepts only designated development numbers', async () => { await assert.rejects(provider.sendOtp('9000000001'), (e: any) => e.code === 'phone_not_allowed'); const result = await provider.sendOtp('8888888888'); assert.equal(result.expiresInSeconds, 300); assert.equal(await provider.verifyOtp('+918888888888', '123456', result.requestId), true); });
  it('rejects wrong codes and consumes a successful code', async () => { const result = await provider.sendOtp('8888888888'); assert.equal(await provider.verifyOtp('8888888888', '000000', result.requestId), false); assert.equal(await provider.verifyOtp('8888888888', '123456', result.requestId), true); assert.equal(await provider.verifyOtp('8888888888', '123456', result.requestId), false); });
  it('enforces actual five-minute expiry using an injected clock', async () => { const result = await provider.sendOtp('8888888888'); now += 300_000; assert.equal(await provider.verifyOtp('8888888888', '123456', result.requestId), false); });
  it('enforces cooldown and invalidates the old request on resend', async () => { const first = await provider.sendOtp('8888888888'); await assert.rejects(provider.sendOtp('8888888888'), (e: any) => e instanceof OtpError && e.retryAfterSeconds === 60); now += 60_000; const next = await provider.sendOtp('8888888888'); assert.equal(await provider.verifyOtp('8888888888', '123456', first.requestId), false); assert.equal(await provider.verifyOtp('8888888888', '123456', next.requestId), true); });
  it('caps wrong attempts', async () => { const result = await provider.sendOtp('8888888888'); for (let i = 0; i < 5; i++) assert.equal(await provider.verifyOtp('8888888888', '000000', result.requestId), false); await assert.rejects(provider.verifyOtp('8888888888', '123456', result.requestId), (e: any) => e.code === 'max_attempts_exceeded'); });
});

describe('Indian E.164 normalization', () => {
  it('preserves canonical, local and country-prefixed Indian mobile input', () => { for (const value of ['9123456789', '+919123456789', '919123456789', '+91 (91234) 56789']) assert.equal(normalizePhone(value), '+919123456789'); });
  it('does not truncate or strip a local number beginning 91', () => { assert.equal(normalizePhone('9191234567'), '+919191234567'); });
  it('rejects unsupported countries, invalid mobile prefixes, letters and surplus digits', () => { for (const value of ['+14155552671', '+911234567890', '00919123456789', '9123456789123', 'abc9123456789', '++919123456789']) assert.throws(() => normalizePhone(value), OtpError); });
});
