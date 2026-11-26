import { claimUsername } from './authService';
let mockStored: any;
const mockRequest = jest.fn();
jest.mock('@/shared/api/client', () => ({ apiRequest: (...args: any[]) => mockRequest(...args), setApiToken: jest.fn(), ApiError: class extends Error { status: number; code: string; constructor(status: number, code: string, message: string) { super(message); this.status = status; this.code = code; } } }));
jest.mock('@/shared/services/storage', () => ({ getStoredSession: () => mockStored, setStoredSession: (value: any) => { mockStored = value; }, clearStoredSession: () => { mockStored = null; } }));
jest.mock('./otpProvider', () => ({ createOtpProvider: () => ({}) }));
beforeEach(() => { mockRequest.mockReset(); mockStored = { user: { id: 'owner', phone: '+919000000001', displayName: 'Arun', handle: null }, token: 'token', expiresAt: '2099-01-01T00:00:00Z' }; });

test('recovers the saved server username after a lost successful claim response', async () => {
  const user = { ...mockStored.user, handle: 'arun.fit', needsUsername: false };
  mockRequest.mockRejectedValueOnce(new Error('Response lost')).mockResolvedValueOnce({ user });
  await expect(claimUsername('arun.fit')).resolves.toMatchObject({ handle: 'arun.fit' });
  expect(mockRequest.mock.calls[1][0]).toBe('/auth/mobile/me');
  expect(mockStored.user.needsUsername).toBe(false);
});
test('late saves cannot complete setup for a different signed-in account', async () => {
  const user = { ...mockStored.user, handle: 'arun.fit' };
  mockRequest.mockImplementationOnce(async () => { mockStored = { ...mockStored, token: 'different' }; return { user }; });
  await expect(claimUsername('arun.fit')).rejects.toThrow('account changed');
  expect(mockStored.user.handle).toBeNull();
});
