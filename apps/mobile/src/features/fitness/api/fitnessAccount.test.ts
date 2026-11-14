import { closeFitnessAccount } from './fitnessAccount';
import { clearSession } from '@/shared/services/auth/authService';

let mockToken: string | null;
let mockSession: any;
jest.mock('@/shared/api/config', () => ({
  isApiEnabled: true,
  getApiBaseUrl: () => 'https://fitness.test',
}));
jest.mock('@/shared/api/client', () => ({
  ApiError: jest.requireActual('@/shared/api/client').ApiError,
  getApiToken: () => mockToken,
  setApiToken: (token: string | null) => {
    mockToken = token;
  },
}));
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockSession,
  clearStoredSession: () => {
    mockSession = null;
  },
}));
jest.mock('@/shared/services/auth/otpProvider', () => ({
  createOtpProvider: () => ({}),
}));
const originalFetch = global.fetch;
beforeEach(() => {
  mockToken = 'session-a';
  mockSession = {
    user: { id: 'customer-a' },
    token: mockToken,
    expiresAt: '2099-01-01T00:00:00Z',
  };
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
});
test('closure uses the mounted auth route and clears stored session, token and private state only after full acknowledgement', async () => {
  let confirm!: (body: unknown) => void;
  const body = new Promise(resolve => {
    confirm = resolve;
  });
  (fetch as jest.Mock).mockResolvedValue({ ok: true, json: () => body });
  const logout = jest.fn(async () => clearSession());
  const clearPrivateState = jest.fn();
  const closure = closeFitnessAccount('customer-a', {
    logout,
    clearPrivateState,
  });
  await Promise.resolve();
  expect(logout).not.toHaveBeenCalled();
  expect(clearPrivateState).not.toHaveBeenCalled();
  expect(mockSession.user.id).toBe('customer-a');
  expect(fetch).toHaveBeenCalledWith(
    'https://fitness.test/auth/mobile/account',
    expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ confirmAccountClosure: true }),
      headers: expect.objectContaining({ Authorization: 'Bearer session-a' }),
    }),
  );
  confirm({ accountClosed: true, fitnessDataDeleted: true });
  await closure;
  expect(logout).toHaveBeenCalledTimes(1);
  expect(mockSession).toBeNull();
  expect(mockToken).toBeNull();
  expect(clearPrivateState).toHaveBeenCalledTimes(1);
});
test.each([
  {
    ok: false,
    body: { error: { code: 'closure_failed', message: 'Try again' } },
  },
  { ok: true, body: { accountClosed: true, fitnessDataDeleted: false } },
])(
  'an error or incomplete acknowledgement retains the active session and private state',
  async response => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: response.ok,
      status: 503,
      json: async () => response.body,
    });
    const logout = jest.fn(async () => clearSession());
    const clearPrivateState = jest.fn();
    await expect(
      closeFitnessAccount('customer-a', { logout, clearPrivateState }),
    ).rejects.toThrow();
    expect(mockSession.user.id).toBe('customer-a');
    expect(mockToken).toBe('session-a');
    expect(logout).not.toHaveBeenCalled();
    expect(clearPrivateState).not.toHaveBeenCalled();
  },
);
test('a delayed account closure acknowledgement cannot clear a newly signed in account', async () => {
  let confirm!: (body: unknown) => void;
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () =>
      new Promise(resolve => {
        confirm = resolve;
      }),
  });
  const logout = jest.fn(async () => clearSession());
  const clearPrivateState = jest.fn();
  const closure = closeFitnessAccount('customer-a', {
    logout,
    clearPrivateState,
  });
  await Promise.resolve();
  mockToken = 'session-b';
  mockSession = {
    ...mockSession,
    user: { id: 'customer-b' },
    token: mockToken,
  };
  confirm({ accountClosed: true, fitnessDataDeleted: true });
  await expect(closure).rejects.toThrow();
  expect(mockSession.user.id).toBe('customer-b');
  expect(logout).not.toHaveBeenCalled();
  expect(clearPrivateState).not.toHaveBeenCalled();
});
