import { ApiError } from '@/shared/api/client';
import { persistSession, validateSession, verifyOtp } from './authService';

let mockStored: any;
const mockApi = jest.fn();
const mockVerify = jest.fn();
const mockPersist = jest.fn((value: any) => { mockStored = value; });
jest.mock('@/shared/api/client', () => ({
  ...jest.requireActual('@/shared/api/client'),
  apiRequest: (...args: any[]) => mockApi(...args), setApiToken: jest.fn(),
}));
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockStored,
  setStoredSession: (value: any) => mockPersist(value),
  clearStoredSession: () => { mockStored = null; },
}));
jest.mock('./otpProvider', () => ({ createOtpProvider: () => ({ verifyOtp: (...args: any[]) => mockVerify(...args) }) }));

const user = { id: 'old-user', phone: '+919000000001', displayName: 'Old', avatarUrl: 'https://cdn.example/old.jpg' };
const session = (id = user.id, token = 'old-token') => ({ user: { ...user, id }, token, expiresAt: '2099-01-01T00:00:00Z' });
function deferred() { let resolve!: (value: any) => void; let reject!: (value: any) => void; const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
beforeEach(() => { mockStored = session(); mockApi.mockReset(); mockVerify.mockReset(); mockPersist.mockClear(); });
afterEach(() => jest.useRealTimers());

test.each(['cancelled', 'new-session', 'replaced-attempt'])('a %s OTP response cannot persist a login', async reason => {
  const pending = deferred(); mockVerify.mockReturnValue(pending.promise);
  const controller = new AbortController(); let active = true;
  const result = verifyOtp('+919000000002', '654321', 'request', { signal: controller.signal, isCurrentAttempt: () => active });
  if (reason === 'cancelled') controller.abort();
  if (reason === 'new-session') mockStored = session('newer-user', 'newer-token');
  if (reason === 'replaced-attempt') active = false;
  const current = mockStored;
  pending.resolve(session('late-user', 'late-token'));
  await expect(result).rejects.toMatchObject({ code: 'otp_cancelled' });
  expect(mockStored).toBe(current); expect(mockPersist).not.toHaveBeenCalled();
});

test('persists a confirmed OTP session and never borrows another account photo', async () => {
  mockVerify.mockResolvedValue({ ...session('new-user', 'new-token'), user: { id: 'new-user', phone: '+919000000002', displayName: 'New' } });
  const saved = await verifyOtp('+919000000002', '654321', 'request');
  expect(mockStored.token).toBe('new-token');
  expect(saved.user.avatarUrl).not.toBe(user.avatarUrl);
  expect(mockPersist).toHaveBeenCalledTimes(1);
});

test('same-account session refresh retains a stored photo if the response omits it', () => {
  persistSession({ ...session(), user: { ...user, avatarUrl: undefined } });
  expect(mockStored.user.avatarUrl).toBe(user.avatarUrl);
});

test('a temporary network error does not discard a valid stored login', async () => {
  mockApi.mockRejectedValue(new ApiError(0, 'network_error', 'Offline'));
  const saved = mockStored;
  expect(await validateSession(saved)).toMatchObject({ id: user.id });
  expect(mockStored).toBe(saved);
});

test('a stalled startup validation times out without trapping or discarding the saved login', async () => {
  jest.useFakeTimers(); mockApi.mockReturnValue(new Promise(() => {}));
  const saved = mockStored;
  const pending = validateSession(saved);
  const signal = mockApi.mock.calls[0][1].signal;
  jest.advanceTimersByTime(20_000);
  expect(await pending).toMatchObject({ id: user.id });
  expect(mockStored).toBe(saved); expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('a revoked current login is removed after server rejection', async () => {
  mockApi.mockRejectedValue(new ApiError(401, 'unauthorized', 'Revoked'));
  expect(await validateSession(mockStored)).toBeNull();
  expect(mockStored).toBeNull();
});

test('a late validation failure cannot clear a newly signed-in account', async () => {
  const pending = deferred(); mockApi.mockReturnValue(pending.promise);
  const result = validateSession(mockStored);
  const current = session('new-user', 'new-token'); mockStored = current;
  pending.reject(new ApiError(401, 'unauthorized', 'Old session'));
  expect(await result).toBeNull(); expect(mockStored).toBe(current);
});

test('a mismatched server identity is rejected instead of being persisted', async () => {
  mockApi.mockResolvedValue({ user: { ...user, id: 'other-user' } });
  expect(await validateSession(mockStored)).toBeNull(); expect(mockStored).toBeNull();
});
