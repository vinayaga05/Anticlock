import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { TestAccountWrapperProvider } from './testAccountWrapper.js';
import { OtpError, type OtpProvider } from './types.js';
const keys = ['NODE_ENV', 'OTP_TEST_LOGIN_ENABLED', 'TEST_LOGIN_DISABLED'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
describe('local test-account wrapper', () => {
  let calls: string[]; let wrapper: TestAccountWrapperProvider;
  beforeEach(() => { process.env.NODE_ENV = 'test'; process.env.OTP_TEST_LOGIN_ENABLED = 'true'; delete process.env.TEST_LOGIN_DISABLED; calls = []; const delegate: OtpProvider = { sendOtp: async phone => { calls.push(phone); throw new OtpError('otp_not_configured', 'Not configured'); }, verifyOtp: async phone => { calls.push(phone); return false; } }; wrapper = new TestAccountWrapperProvider(delegate); });
  afterEach(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  it('uses only explicitly enabled local test numbers', async () => { const challenge = await wrapper.sendOtp('9876543210'); assert.equal(challenge.expiresInSeconds, 300); assert.equal(await wrapper.verifyOtp('9876543210', '123456', challenge.requestId), true); assert.equal(await wrapper.verifyOtp('9876543210', '123456', challenge.requestId), false); assert.deepEqual(calls, []); });
  it('does not intercept production test numbers even with opt-in flags', async () => { process.env.NODE_ENV = 'production'; await assert.rejects(wrapper.sendOtp('9876543210'), (e: any) => e.code === 'otp_not_configured'); assert.equal(await wrapper.verifyOtp('9876543210', '123456', 'old'), false); assert.equal(calls.length, 2); });
  it('delegates when opt-in is absent or explicitly disabled', async () => { delete process.env.OTP_TEST_LOGIN_ENABLED; await assert.rejects(wrapper.sendOtp('9876543210')); process.env.OTP_TEST_LOGIN_ENABLED = 'true'; process.env.TEST_LOGIN_DISABLED = 'true'; await assert.rejects(wrapper.sendOtp('9876543210')); assert.equal(calls.length, 2); });
  it('delegates non-test phones rather than issuing fake codes', async () => { await assert.rejects(wrapper.sendOtp('+919000000001')); assert.equal(await wrapper.verifyOtp('+919000000001', '123456', 'request'), false); assert.deepEqual(calls, ['+919000000001', '+919000000001']); });
  it('limits repeated attempts and sends even for local test numbers', async () => { const challenge = await wrapper.sendOtp('9876543210'); await assert.rejects(wrapper.sendOtp('9876543210'), (e: any) => e.code === 'resend_cooldown'); for (let i = 0; i < 5; i++) assert.equal(await wrapper.verifyOtp('9876543210', '000000', challenge.requestId), false); await assert.rejects(wrapper.verifyOtp('9876543210', '123456', challenge.requestId), (e: any) => e.code === 'max_attempts_exceeded'); });
});
