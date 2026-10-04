import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { TestAccountWrapperProvider } from './testAccountWrapper.js';
import { OtpError, type OtpProvider, type OtpSendResult } from './types.js';

class MockOtpProvider implements OtpProvider {
  public sendOtpCalls: string[] = [];
  public verifyOtpCalls: Array<{ phone: string; code: string; requestId: string }> = [];

  async sendOtp(phone: string): Promise<OtpSendResult> {
    this.sendOtpCalls.push(phone);
    throw new OtpError('otp_not_configured', 'Mock provider not configured');
  }

  async verifyOtp(phone: string, code: string, requestId: string): Promise<boolean> {
    this.verifyOtpCalls.push({ phone, code, requestId });
    return false;
  }
}

describe('TestAccountWrapperProvider', () => {
  let mockProvider: MockOtpProvider;
  let wrapper: TestAccountWrapperProvider;
  const originalEnv = process.env.TEST_LOGIN_DISABLED;

  beforeEach(() => {
    delete process.env.TEST_LOGIN_DISABLED;
    mockProvider = new MockOtpProvider();
    wrapper = new TestAccountWrapperProvider(mockProvider);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEST_LOGIN_DISABLED;
    } else {
      process.env.TEST_LOGIN_DISABLED = originalEnv;
    }
  });

  describe('test accounts', () => {
    it('handles test account 9876543210 without delegating', async () => {
      const result = await wrapper.sendOtp('+919876543210');
      assert.ok(result.requestId);
      assert.equal(result.expiresInSeconds, 600);
      assert.equal(mockProvider.sendOtpCalls.length, 0, 'Should not delegate to underlying provider');
    });

    it('accepts correct OTP 123456 for test account', async () => {
      const { requestId } = await wrapper.sendOtp('+919876543210');
      const verified = await wrapper.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(verified, true);
      assert.equal(mockProvider.verifyOtpCalls.length, 0, 'Should not delegate verification');
    });

    it('rejects wrong OTP for test account without attempt limit', async () => {
      const { requestId } = await wrapper.sendOtp('+919876543211');
      
      // Try 10 times (no attempt limit for test accounts)
      for (let i = 0; i < 10; i++) {
        const verified = await wrapper.verifyOtp('+919876543211', '999999', requestId);
        assert.equal(verified, false);
      }
      
      // Still works on 11th try with correct OTP
      const verified = await wrapper.verifyOtp('+919876543211', '123456', requestId);
      assert.equal(verified, true);
    });

    it('all 5 test accounts work', async () => {
      const testNumbers = [
        '+919876543210',
        '+919876543211',
        '+919876543212',
        '+919876543213',
        '+919999999999',
      ];

      for (const phone of testNumbers) {
        const { requestId } = await wrapper.sendOtp(phone);
        const verified = await wrapper.verifyOtp(phone, '123456', requestId);
        assert.equal(verified, true, `Test account ${phone} should verify`);
      }

      assert.equal(mockProvider.sendOtpCalls.length, 0, 'Should not delegate any test accounts');
    });

    it('disables test accounts when TEST_LOGIN_DISABLED=true', async () => {
      process.env.TEST_LOGIN_DISABLED = 'true';

      await assert.rejects(
        async () => wrapper.sendOtp('+919876543210'),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          // Should delegate to mock provider which throws otp_not_configured
          assert.equal((err as OtpError).code, 'otp_not_configured');
          return true;
        },
      );

      assert.equal(mockProvider.sendOtpCalls.length, 1, 'Should delegate when test login disabled');
    });

    it('does not apply rate limiting to test accounts', async () => {
      const phone = '+919876543210';
      
      // Send OTP many times (no rate limiting for test accounts)
      for (let i = 0; i < 10; i++) {
        const result = await wrapper.sendOtp(phone);
        assert.ok(result.requestId);
      }

      assert.equal(mockProvider.sendOtpCalls.length, 0, 'Should not delegate test accounts');
    });
  });

  describe('non-test accounts', () => {
    it('delegates non-test account to underlying provider', async () => {
      await assert.rejects(
        async () => wrapper.sendOtp('+911234567890'),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          assert.equal((err as OtpError).code, 'otp_not_configured');
          return true;
        },
      );

      assert.equal(mockProvider.sendOtpCalls.length, 1);
      assert.equal(mockProvider.sendOtpCalls[0], '+911234567890');
    });

    it('delegates verification for non-test account', async () => {
      const result = await wrapper.verifyOtp('+911234567890', '123456', 'some-request-id');
      assert.equal(result, false);

      assert.equal(mockProvider.verifyOtpCalls.length, 1);
      assert.equal(mockProvider.verifyOtpCalls[0].phone, '+911234567890');
      assert.equal(mockProvider.verifyOtpCalls[0].code, '123456');
      assert.equal(mockProvider.verifyOtpCalls[0].requestId, 'some-request-id');
    });
  });

  describe('phone normalization', () => {
    it('normalizes 10-digit test account number', async () => {
      const { requestId } = await wrapper.sendOtp('9876543210');
      const verified = await wrapper.verifyOtp('9876543210', '123456', requestId);
      assert.equal(verified, true);
    });

    it('handles already normalized test account', async () => {
      const { requestId } = await wrapper.sendOtp('+919876543210');
      const verified = await wrapper.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(verified, true);
    });
  });

  describe('expiry', () => {
    it('rejects expired test account challenge', async () => {
      const phone = '+919876543210';
      const verified = await wrapper.verifyOtp(phone, '123456', 'non-existent-id');
      assert.equal(verified, false);
    });

    it('challenge consumed after successful verification', async () => {
      const { requestId } = await wrapper.sendOtp('+919876543210');
      
      const verified = await wrapper.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(verified, true);

      const secondAttempt = await wrapper.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(secondAttempt, false, 'Challenge should be consumed');
    });
  });
});
