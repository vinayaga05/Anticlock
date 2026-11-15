import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { isTestAccount, isTestLoginEnabled, TEST_LOGIN_ACCOUNTS } from './testLogin.js';
const keys = ['NODE_ENV', 'OTP_TEST_LOGIN_ENABLED', 'TEST_LOGIN_DISABLED'];
const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
describe('test-account configuration', () => {
  beforeEach(() => { process.env.NODE_ENV = 'test'; delete process.env.OTP_TEST_LOGIN_ENABLED; delete process.env.TEST_LOGIN_DISABLED; });
  afterEach(() => { for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  it('is disabled by default', () => { assert.equal(isTestLoginEnabled(), false); assert.equal(isTestAccount(TEST_LOGIN_ACCOUNTS[0]), false); });
  it('requires explicit opt-in and still supports opt-out', () => { process.env.OTP_TEST_LOGIN_ENABLED = 'true'; assert.equal(isTestLoginEnabled(), true); process.env.TEST_LOGIN_DISABLED = 'true'; assert.equal(isTestLoginEnabled(), false); });
  it('never enables test accounts in production', () => { process.env.NODE_ENV = 'production'; process.env.OTP_TEST_LOGIN_ENABLED = 'true'; process.env.TEST_LOGIN_DISABLED = 'false'; for (const phone of TEST_LOGIN_ACCOUNTS) assert.equal(isTestAccount(phone), false); });
  it('only accepts the declared test numbers after opt-in', () => { process.env.OTP_TEST_LOGIN_ENABLED = 'true'; assert.equal(TEST_LOGIN_ACCOUNTS.length, 10); for (const phone of TEST_LOGIN_ACCOUNTS) assert.equal(isTestAccount(phone), true); assert.equal(isTestAccount('+919000000001'), false); });
});
