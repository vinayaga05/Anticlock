import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import {
  isTestAccount,
  isTestLoginEnabled,
  TEST_LOGIN_ACCOUNTS,
  TEST_LOGIN_OTP,
} from './testLogin.js';

describe('testLogin', () => {
  const originalEnv = process.env.TEST_LOGIN_DISABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TEST_LOGIN_DISABLED;
    } else {
      process.env.TEST_LOGIN_DISABLED = originalEnv;
    }
  });

  describe('isTestLoginEnabled', () => {
    it('returns true by default', () => {
      delete process.env.TEST_LOGIN_DISABLED;
      assert.equal(isTestLoginEnabled(), true);
    });

    it('returns false when TEST_LOGIN_DISABLED=true', () => {
      process.env.TEST_LOGIN_DISABLED = 'true';
      assert.equal(isTestLoginEnabled(), false);
    });

    it('returns true when TEST_LOGIN_DISABLED=false', () => {
      process.env.TEST_LOGIN_DISABLED = 'false';
      assert.equal(isTestLoginEnabled(), true);
    });
  });

  describe('isTestAccount', () => {
    it('returns true for test accounts when enabled', () => {
      delete process.env.TEST_LOGIN_DISABLED;
      assert.equal(isTestAccount('+919876543210'), true);
      assert.equal(isTestAccount('+919876543211'), true);
      assert.equal(isTestAccount('+919876543212'), true);
      for (let i = 0; i <= 9; i++) {
        assert.equal(isTestAccount(`+91987654321${i}`), true);
      }
    });

    it('does not include numbers outside 9876543210..9876543219', () => {
      delete process.env.TEST_LOGIN_DISABLED;
      assert.equal(isTestAccount('+919999999999'), false);
      assert.equal(isTestAccount('+919876543220'), false);
      assert.equal(isTestAccount('+919876543209'), false);
    });

    it('returns false for test accounts when disabled', () => {
      process.env.TEST_LOGIN_DISABLED = 'true';
      assert.equal(isTestAccount('+919876543210'), false);
      assert.equal(isTestAccount('+919876543219'), false);
    });

    it('returns false for non-test accounts', () => {
      delete process.env.TEST_LOGIN_DISABLED;
      assert.equal(isTestAccount('+918888888888'), false);
      assert.equal(isTestAccount('+911234567890'), false);
    });
  });

  describe('TEST_LOGIN_ACCOUNTS', () => {
    it('contains exactly 10 accounts 9876543210..9876543219', () => {
      assert.equal(TEST_LOGIN_ACCOUNTS.length, 10);
      assert.deepEqual(
        [...TEST_LOGIN_ACCOUNTS],
        Array.from({ length: 10 }, (_, i) => `+91987654321${i}`),
      );
    });

    it('all accounts are in normalized +91 format', () => {
      for (const account of TEST_LOGIN_ACCOUNTS) {
        assert.match(account, /^\+91\d{10}$/);
      }
    });
  });

  describe('TEST_LOGIN_OTP', () => {
    it('is a 6-digit string', () => {
      assert.equal(TEST_LOGIN_OTP, '123456');
      assert.match(TEST_LOGIN_OTP, /^\d{6}$/);
    });
  });
});
