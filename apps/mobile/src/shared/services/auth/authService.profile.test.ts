import { updateProfile } from './authService';

let mockStored: any;
const mockApi = jest.fn();
const mockPersist = jest.fn((session: any) => { mockStored = session; });
jest.mock('@/shared/api/client', () => ({ apiRequest: (...args: any[]) => mockApi(...args), setApiToken: jest.fn() }));
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockStored,
  setStoredSession: (session: any) => mockPersist(session),
  clearStoredSession: () => { mockStored = null; },
}));
jest.mock('./otpProvider', () => ({ createOtpProvider: () => ({}) }));

const user = { id: 'owner-1', phone: '+919000000000', displayName: 'Original name', avatarUrl: 'https://cdn.example/old.jpg' };
const input = { displayName: 'Updated name', avatarUrl: null, bio: null, location: null, website: null };
const session = () => ({ user: { ...user }, token: 'original-session', expiresAt: '2099-01-01T00:00:00Z' });
function deferred() { let resolve!: (value: any) => void; const promise = new Promise<any>(yes => { resolve = yes; }); return { resolve, promise }; }

beforeEach(() => { mockStored = session(); mockApi.mockReset(); mockPersist.mockClear(); });
afterEach(() => jest.useRealTimers());

test('persists confirmed profile details and keeps explicit photo removal as initials', async () => {
  mockApi.mockResolvedValue({ user: { ...user, displayName: input.displayName, avatarUrl: null } });
  const saved = await updateProfile(input);
  expect(mockApi).toHaveBeenCalledWith('/auth/mobile/profile', { method: 'PUT', body: JSON.stringify(input), signal: expect.any(AbortSignal) });
  expect(saved.displayName).toBe('Updated name');
  expect(saved.avatarUrl).toMatch(/^data:image\/svg/);
  expect(mockStored.user.avatarUrl).not.toBe(user.avatarUrl);
  expect(mockPersist).toHaveBeenCalledTimes(1);
});

test('does not persist before the server confirms the profile', async () => {
  const pending = deferred(); mockApi.mockReturnValue(pending.promise);
  const result = updateProfile(input);
  expect(mockPersist).not.toHaveBeenCalled();
  pending.resolve({ user: { ...user, displayName: 'Updated name' } }); await result;
  expect(mockPersist).toHaveBeenCalledTimes(1);
});

test.each(['logout', 'different-account', 'new-token', 'expired'])('a late profile response cannot replace a %s session', async change => {
  const pending = deferred(); mockApi.mockReturnValue(pending.promise);
  const result = updateProfile(input);
  if (change === 'logout') mockStored = null;
  if (change === 'different-account') mockStored = { ...session(), user: { ...user, id: 'new-owner' }, token: 'new-account-session' };
  if (change === 'new-token') mockStored = { ...session(), token: 'new-login-session' };
  if (change === 'expired') mockStored = { ...session(), expiresAt: '2000-01-01T00:00:00Z' };
  const current = mockStored;
  pending.resolve({ user: { ...user, displayName: 'Late response' } });
  await expect(result).rejects.toThrow('account changed');
  expect(mockStored).toBe(current); expect(mockPersist).not.toHaveBeenCalled();
});

test('rejects an incorrectly attributed server response and preserves the session', async () => {
  mockApi.mockResolvedValue({ user: { ...user, id: 'other-user' } });
  await expect(updateProfile(input)).rejects.toThrow('could not be confirmed');
  expect(mockStored.user.id).toBe(user.id); expect(mockPersist).not.toHaveBeenCalled();
});

test('a failed save keeps the original persisted profile', async () => {
  mockApi.mockRejectedValue(new Error('offline'));
  await expect(updateProfile(input)).rejects.toThrow('offline');
  expect(mockStored.user.displayName).toBe('Original name'); expect(mockPersist).not.toHaveBeenCalled();
});

test('times out a stalled profile request or body, aborts it, and ignores late confirmation', async () => {
  jest.useFakeTimers();
  const pending = deferred(); mockApi.mockReturnValue(pending.promise);
  const originalSession = mockStored;
  const result = updateProfile(input);
  const failed = expect(result).rejects.toThrow('Saving your profile timed out');
  const signal = mockApi.mock.calls[0][1].signal as AbortSignal;
  expect(signal.aborted).toBe(false);
  jest.advanceTimersByTime(20_000);
  await failed;
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  expect(mockStored).toBe(originalSession);
  expect(mockPersist).not.toHaveBeenCalled();
  // Native transports may finish after cancellation. No persistence follows.
  pending.resolve({ user: { ...user, displayName: 'Late server response' } });
  await Promise.resolve(); await Promise.resolve();
  expect(mockStored).toBe(originalSession);
  expect(mockPersist).not.toHaveBeenCalled();
});

test('clears the profile deadline after a prompt success or server rejection', async () => {
  jest.useFakeTimers();
  mockApi.mockResolvedValueOnce({ user: { ...user, displayName: input.displayName } });
  await updateProfile(input);
  expect(jest.getTimerCount()).toBe(0);
  mockApi.mockRejectedValueOnce(new Error('Save unavailable'));
  await expect(updateProfile(input)).rejects.toThrow('Save unavailable');
  expect(jest.getTimerCount()).toBe(0);
});
