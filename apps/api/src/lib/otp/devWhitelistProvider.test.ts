import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import { DevWhitelistOtpProvider } from './devWhitelistProvider.js';
import { OtpError } from './types.js';

describe('DevWhitelistOtpProvider', () => {
  let provider: DevWhitelistOtpProvider;

  beforeEach(() => {
    provider = new DevWhitelistOtpProvider();
  });

  describe('dev whitelist', () => {
    it('accepts dev whitelist number +918888888888', async () => {
      const { requestId } = await provider.sendOtp('+918888888888');
      const verified = await provider.verifyOtp('+918888888888', '123456', requestId);
      assert.equal(verified, true);
    });

    it('accepts dev whitelist number +919999999999', async () => {
      const { requestId } = await provider.sendOtp('+919999999999');
      const verified = await provider.verifyOtp('+919999999999', '123456', requestId);
      assert.equal(verified, true);
    });

    it('rejects non-whitelisted number', async () => {
      await assert.rejects(
        async () => provider.sendOtp('+911234567890'),
        (err: Error) => {
          assert.ok(err instanceof OtpError);
          assert.equal((err as OtpError).code, 'phone_not_allowed');
          return true;
        },
      );
    });

    it('rejects wrong OTP for whitelisted number', async () => {
      const { requestId } = await provider.sendOtp('+918888888888');
      const verified = await provider.verifyOtp('+918888888888', '999999', requestId);
      assert.equal(verified, false);
    });
  });

  describe('rate limiting', () => {
    it('allows up to 3 send requests per minute', async () => {
      const phone = '+918888888888';
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);
      await provider.sendOtp(phone);
    });

    it('rejects 4th send request within a minute', async () => {
      const phone = '+919999999999';
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
      const phone = '+918888888888';
      const { requestId } = await provider.sendOtp(phone);

      for (let i = 0; i < 5; i++) {
        const verified = await provider.verifyOtp(phone, '999999', requestId);
        assert.equal(verified, false);
      }
    });

    it('throws error on 6th failed verification attempt', async () => {
      const phone = '+919999999999';
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
      const phone = '+918888888888';
      const { requestId } = await provider.sendOtp(phone);
      
      const verified = await provider.verifyOtp(phone, '123456', requestId);
      assert.equal(verified, true);

      const secondAttempt = await provider.verifyOtp(phone, '123456', requestId);
      assert.equal(secondAttempt, false, 'Challenge should be consumed');
    });
  });

  describe('phone normalization', () => {
    it('normalizes 10-digit number to +91 format', async () => {
      const { requestId } = await provider.sendOtp('8888888888');
      const verified = await provider.verifyOtp('8888888888', '123456', requestId);
      assert.equal(verified, true);
    });

    it('accepts already normalized +91 format', async () => {
      const { requestId } = await provider.sendOtp('+918888888888');
      const verified = await provider.verifyOtp('+918888888888', '123456', requestId);
      assert.equal(verified, true);
    });
  });

  describe('expiry', () => {
    it('rejects expired or non-existent requestId', async () => {
      const phone = '+918888888888';
      const verified = await provider.verifyOtp(phone, '123456', 'non-existent-id');
      assert.equal(verified, false);
    });
  });
});
