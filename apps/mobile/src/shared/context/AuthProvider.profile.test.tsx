import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AuthProvider, useAuth } from './AuthProvider';

let mockStored: any;
const mockSave = jest.fn();
const first = { id: 'first-user', phone: '+919000000001', displayName: 'First user' };
const second = { id: 'second-user', phone: '+919000000002', displayName: 'Second user' };
const session = (user = first, token = 'first-token') => ({ user, token, expiresAt: '2099-01-01T00:00:00Z' });
jest.mock('@/shared/services/auth/authService', () => ({
  readStoredSession: () => mockStored,
  validateSession: async () => mockStored?.user ?? null,
  persistSession: (value: any) => { mockStored = value; },
  clearSession: () => { mockStored = null; },
  logoutRemote: async () => {}, sendOtp: jest.fn(),
  verifyOtp: async () => { mockStored = session(second, 'second-token'); return mockStored; },
  updateProfile: (...args: any[]) => mockSave(...args),
}));
jest.mock('@/shared/api/client', () => ({ setUnauthorizedHandler: jest.fn() }));
let current: ReturnType<typeof useAuth>;
function Probe() { current = useAuth(); return null; }
let renderer: ReactTestRenderer.ReactTestRenderer;
beforeEach(async () => {
  mockStored = session(); mockSave.mockReset();
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<AuthProvider><Probe /></AuthProvider>); });
});
afterEach(() => { ReactTestRenderer.act(() => renderer.unmount()); });

test.each(['logout', 'different-account'])('the auth context ignores a late save after %s', async change => {
  let resolve!: (value: any) => void;
  mockSave.mockReturnValue(new Promise(yes => { resolve = yes; }));
  let result!: Promise<void>;
  ReactTestRenderer.act(() => { result = current.updateProfile({ displayName: 'Updated first', avatarUrl: null, bio: null, location: null, website: null }); });
  await ReactTestRenderer.act(async () => {
    if (change === 'logout') await current.logout();
    else await current.loginWithOtp('+919000000002', '123456', 'request');
  });
  const expected = current.user;
  await ReactTestRenderer.act(async () => {
    resolve({ ...first, displayName: 'Late first response' });
    await expect(result).rejects.toThrow('account changed');
  });
  expect(current.user).toBe(expected);
  expect(current.user?.id ?? null).toBe(change === 'logout' ? null : second.id);
});
