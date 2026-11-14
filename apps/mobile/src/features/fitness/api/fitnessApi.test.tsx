import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fitnessRequest,
  newFitnessRequestId,
  useFitnessMutation,
  useFitnessQuery,
} from './fitnessApi';

let mockToken = 'token-a';
let mockSession: any;
let mockUser: any;
jest.mock('@/shared/api/config', () => ({
  isApiEnabled: true,
  getApiBaseUrl: () => 'https://fitness.test',
}));
jest.mock('@/shared/api/client', () => ({
  ApiError: jest.requireActual('@/shared/api/client').ApiError,
  getApiToken: () => mockToken,
}));
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockSession,
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
const originalFetch = global.fetch;
const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
const clients: QueryClient[] = [];
function deferred() {
  let resolve!: (v: any) => void;
  const promise = new Promise<any>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mockToken = 'token-a';
  mockUser = { id: 'user-a' };
  mockSession = {
    user: mockUser,
    token: mockToken,
    expiresAt: '2099-01-01T00:00:00Z',
  };
  global.fetch = jest.fn();
});
afterEach(() => {
  ReactTestRenderer.act(() => renderers.splice(0).forEach(r => r.unmount()));
  clients.splice(0).forEach(c => c.clear());
  global.fetch = originalFetch;
  jest.useRealTimers();
});
test('private reads bind Authorization to the captured account and read the real response', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ profile: null }),
  });
  expect(await fitnessRequest('/profile')).toEqual({ profile: null });
  expect(fetch).toHaveBeenCalledWith(
    'https://fitness.test/v1/fitness/profile',
    expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer token-a' }),
    }),
  );
});
test('an unavailable or non-JSON service returns a readable error without exposing its response', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error('Internal proxy page or configuration');
    },
  });
  await expect(fitnessRequest('/profile')).rejects.toMatchObject({
    code: 'invalid_response',
    message:
      'Fitness could not be loaded. Your entry is still here; please try again.',
  });
});
test('a late result from another account or rotated token is rejected', async () => {
  const body = deferred();
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => body.promise,
  });
  const result = fitnessRequest('/profile');
  await Promise.resolve();
  mockToken = 'token-b';
  mockSession = { ...mockSession, token: mockToken };
  body.resolve({ profile: { private: 'old account' } });
  await expect(result).rejects.toThrow(/account changed/);
});
test('the deadline includes a stalled JSON body and cancellation stops before transport', async () => {
  jest.useFakeTimers();
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => new Promise(() => {}),
  });
  const request = fitnessRequest('/profile');
  const handled = expect(request).rejects.toThrow(/timed out/);
  await jest.advanceTimersByTimeAsync(25000);
  await handled;
  (fetch as jest.Mock).mockClear();
  const controller = new AbortController();
  controller.abort();
  await expect(
    fitnessRequest('/profile', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetch).not.toHaveBeenCalled();
});
test('query keys separate accounts and tokens; duplicate concurrent writes are blocked', async () => {
  let current: any;
  function Probe() {
    current = {
      query: useFitnessQuery('/profile'),
      mutation: useFitnessMutation(),
    };
    return null;
  }
  const response = deferred();
  (fetch as jest.Mock).mockImplementation((url: string) =>
    url.endsWith('/profile')
      ? Promise.resolve({ ok: true, json: async () => ({ profile: null }) })
      : response.promise,
  );
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  await ReactTestRenderer.act(async () => {
    renderers.push(
      ReactTestRenderer.create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  expect(client.getQueryCache().getAll()[0].queryKey).toEqual([
    'fitness',
    'user-a',
    'token-a',
    '/profile',
  ]);
  let first!: Promise<any>;
  await ReactTestRenderer.act(async () => {
    first = current.mutation.mutateAsync({ path: '/logs/water', body: {} });
    await expect(
      current.mutation.mutateAsync({ path: '/logs/water', body: {} }),
    ).rejects.toThrow(/still saving/);
  });
  response.resolve({ ok: true, json: async () => ({ log: { id: 'saved' } }) });
  await ReactTestRenderer.act(async () => {
    await first;
  });
  expect(
    (fetch as jest.Mock).mock.calls.filter(([url]) =>
      url.endsWith('/logs/water'),
    ),
  ).toHaveLength(1);
});
test('retry identifiers are valid UUIDs', () => {
  expect(newFitnessRequestId()).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
});
