import { normalizePhone } from '@/shared/services/auth/types';
import {
  otpDestination,
  otpLocalTiming,
  otpRetryAt,
  otpSecondsUntil,
} from './otpLoginModel';

test.each(['9876543210', '919876543210', '+91 98765 43210', '(987) 654-3210'])(
  'normalizes an Indian number without dropping digits: %s',
  input => {
    expect(normalizePhone(input)).toBe('+919876543210');
  },
);

test.each([
  '1234567890',
  '+1 9876543210',
  '+9198765432',
  '449876543210',
  '91919876543210',
  'abc9876543210',
  '++919876543210',
  '98765432101',
  '',
])('rejects unsupported or malformed phone input: %s', input => {
  expect(() => normalizePhone(input)).toThrow('mobile number');
});

test('expiry and resend countdowns use a passed clock with exact boundaries', () => {
  expect(otpSecondsUntil(60_000, 0)).toBe(60);
  expect(otpSecondsUntil(60_000, 59_001)).toBe(1);
  expect(otpSecondsUntil(60_000, 60_000)).toBe(0);
  expect(otpSecondsUntil('bad', 0)).toBe(0);
});

test('only finite positive server retry values set a retry deadline', () => {
  expect(otpRetryAt({ retryAfterSeconds: 30 }, 10_000)).toBe(40_000);
  expect(otpRetryAt({ retryAfterSeconds: Infinity }, 0)).toBeNull();
  expect(otpRetryAt({ retryAfterSeconds: -1 }, 0)).toBeNull();
});

test('confirmation masks the destination', () => {
  expect(otpDestination('+919876543210')).toBe('+91 98••••3210');
  expect(otpDestination('')).toBe('');
});

test('a device clock years ahead or behind cannot instantly expire a new code in the UI', () => {
  const server = {
    requestId: 'request',
    expiresInSeconds: 300,
    expiresAt: '2026-11-14T15:05:00Z',
    resendAvailableAt: '2026-11-14T15:01:00Z',
  };
  for (const receivedAt of [
    Date.parse('2020-01-01T00:00:00Z'),
    Date.parse('2030-01-01T00:00:00Z'),
  ]) {
    const timing = otpLocalTiming(server, receivedAt);
    expect(otpSecondsUntil(timing.expiresAt, receivedAt)).toBe(300);
    expect(otpSecondsUntil(timing.resendAvailableAt, receivedAt)).toBe(60);
  }
});
