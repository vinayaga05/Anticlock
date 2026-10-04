import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { OtpError } from './types.js';

describe('DevWhitelistOtpProvider', () => {
  let provider: DevWhitelistOtpProvider;

  beforeEach(() => {
    provider = new DevWhitelistOtpProvider();
  });

  describe('test accounts', () => {
    it('accepts test account and returns requestId', async () => {
      const result = await provider.sendOtp('+919876543210');
      assert.ok(result.requestId);
      assert.equal(result.expiresInSeconds, 600);
    });

    it('accepts test account OTP 123456 when enabled', async () => {
      delete process.env.TEST_LOGIN_DISABLED;
      const { requestId } = await provider.sendOtp('+919876543210');
      const verified = await provider.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(verified, true);
    });

    it('rejects wrong OTP for test account', async () => {
      delete process.env.TEST_LOGIN_DISABLED;
      const { requestId } = await provider.sendOtp('+919876543211');
      const verified = await provider.verifyOtp('+919876543211', '999999', requestId);
      assert.equal(verified, false);
    });

    it('rejects test account when TEST_LOGIN_DISABLED=true', async () => {
      process.env.TEST_LOGIN_DISABLED = 'true';
      await assert.rejects(
        async () => provider.sendOtp('+919876543210'),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          assert.equal((err as OtpError).code, 'phone_not_allowed');
          return true;
        },
      );
      delete process.env.TEST_LOGIN_DISABLED;
    });

    it('all 5 test accounts work', async () => {
      delete process.env.TEST_LOGIN_DISABLED;
      const testNumbers = [
        '+919876543210',
        '+919876543211',
        '+919876543212',
        '+919876543213',
        '+919999999999',
      ];

      for (const phone of testNumbers) {
        const { requestId } = await provider.sendOtp(phone);
        const verified = await provider.verifyOtp(phone, '123456', requestId);
        assert.equal(verified, true, `Test account ${phone} should verify`);
      }
    });
  });

  describe('dev whitelist', () => {
    it('accepts dev whitelist number in non-production', async () => {
      const { requestId } = await provider.sendOtp('+918888888888');
      const verified = await provider.verifyOtp('+918888888888', '123456', requestId);
      assert.equal(verified, true);
    });
  });

  describe('rate limiting', () => {
    it('allows up to 3 send requests per minute', async () => {
      const phone = '+919876543210';
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);
    });

    it('rejects 4th send request within a minute', async () => {
      const phone = '+919876543211';
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);

      await assert.rejects(
        async () => provider.sendOtp(phone),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          assert.equal((err as OtpError).code, 'rate_limit_exceeded');
          return true;
        },
      );
    });
  });

  describe('attempt limits', () => {
    it('allows up to 5 verification attempts', async () => {
      const phone = '+919876543212';
      const { requestId } = await provider.sendOtp(phone);

      for (let i = 0; i < 5; i++) {
        const verified = await provider.verifyOtp(phone, '999999', requestId);
        assert.equal(verified, false);
      }
    });

    it('throws error on 6th failed verification attempt', async () => {
      const phone = '+919876543213';
      const { requestId } = await provider.sendOtp(phone);

      for (let i = 0; i < 5; i++) {
        await provider.verifyOtp(phone, '999999', requestId);
      }

      await assert.rejects(
        async () => provider.verifyOtp(phone, '999999', requestId),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          assert.equal((err as OtpError).code, 'max_attempts_exceeded');
          return true;
        },
      );
    });

    it('successful verification consumes the challenge', async () => {
      const phone = '+919999999999';
      const { requestId } = await provider.sendOtp(phone);
      
      const verified = await provider.verifyOtp(phone, '123456', requestId);
      assert.equal(verified, true);

      const secondAttempt = await provider.verifyOtp(phone, '123456', requestId);
      assert.equal(secondAttempt, false, 'Challenge should be consumed');
    });
  });

  describe('phone normalization', () => {
    it('normalizes 10-digit number to +91 format', async () => {
      const { requestId } = await provider.sendOtp('9876543210');
      const verified = await provider.verifyOtp('9876543210', '123456', requestId);
      assert.equal(verified, true);
    });

    it('accepts already normalized +91 format', async () => {
      const { requestId } = await provider.sendOtp('+919876543210');
      const verified = await provider.verifyOtp('+919876543210', '123456', requestId);
      assert.equal(verified, true);
    });
  });

  describe('expiry', () => {
    it('rejects expired requestId', async () => {
      const phone = '+919876543210';
      const { requestId } = await provider.sendOtp(phone);
      
      // This test would need to mock time or wait 10 minutes
      // For now, just verify the behavior with a non-existent requestId
      const verified = await provider.verifyOtp(phone, '123456', 'non-existent-id');
      assert.equal(verified, false);
    });
  });
});
