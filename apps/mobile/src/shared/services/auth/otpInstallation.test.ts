import { getOtpInstallationId } from './otpInstallation';

let mockValue: string | undefined;
const mockSet = jest.fn((_: string, value: string) => {
  mockValue = value;
});
jest.mock('@/shared/services/storage', () => ({
  storage: {
    getString: () => mockValue,
    set: (...args: [string, string]) => mockSet(...args),
  },
}));
beforeEach(() => {
  mockValue = undefined;
  mockSet.mockClear();
});

test('creates and reuses a non-secret installation label across login attempts', () => {
  const first = getOtpInstallationId();
  expect(first).toMatch(/^otp-[a-z0-9-]+$/);
  expect(getOtpInstallationId()).toBe(first);
  expect(mockSet).toHaveBeenCalledTimes(1);
});

test('replaces invalid stored identifiers', () => {
  mockValue = 'broken value';
  expect(getOtpInstallationId()).not.toBe('broken value');
  expect(mockSet).toHaveBeenCalledTimes(1);
});
