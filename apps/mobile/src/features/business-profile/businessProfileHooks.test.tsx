import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  businessRequest,
  useBusinessAvailabilityQuery,
  useBusinessProfileQuery,
  useSaveBusinessMutation,
} from './businessProfileHooks';
import { businessFixture } from './businessTestFixture';
let mockUser: any;
let mockToken: string | null;
let mockSession: any;
const mockRequest = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/api/client', () => {
  const actual = jest.requireActual('@/shared/api/client');
  return {
    ApiError: actual.ApiError,
    apiRequest: (...args: any[]) => mockRequest(...args),
    getApiToken: () => mockToken,
  };
});
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockSession,
}));
let current: any;
function Profile() {
  current = useBusinessProfileQuery('provider-1', {
    type: 'business',
    id: 'viewer+id',
  });
  return null;
}
function Save() {
  current = useSaveBusinessMutation('provider-1', {
    type: 'business',
    id: 'viewer+id',
  });
  return null;
}
function Availability() {
  current = useBusinessAvailabilityQuery('provider-1', {
    date: '2026-11-18',
    categoryId: 'service+id',
    durationMinutes: 60,
    serviceMode: 'home',
  });
  return null;
}
const clients: QueryClient[] = [];
const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
async function render(Probe = Profile) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  renderers.push(renderer);
  await ReactTestRenderer.act(async () => {
    await new Promise(resolve => setTimeout(resolve, 5));
  });
  return { client, renderer };
}
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
beforeEach(() => {
  mockUser = { id: 'user-1' };
  mockToken = 'token-1';
  mockSession = {
    user: mockUser,
    token: mockToken,
    expiresAt: '2099-01-01T00:00:00Z',
  };
  mockRequest.mockReset();
});
afterEach(() => {
  ReactTestRenderer.act(() =>
    renderers.splice(0).forEach(renderer => renderer.unmount()),
  );
  clients.splice(0).forEach(client => client.clear());
  jest.useRealTimers();
});

test('profile GET scopes viewer and cache to the authenticated account', async () => {
  mockRequest.mockResolvedValue({ business: businessFixture() });
  const { client } = await render();
  expect(mockRequest).toHaveBeenCalledWith(
    '/v1/business-profiles/provider-1?viewerProfileId=viewer%2Bid&viewerProfileType=business',
    { signal: expect.any(Object) },
  );
  expect(current.data.name).toBe('Mira Studio');
  expect(
    client.getQueryData([
      'business-profile',
      'provider-1',
      'user-1',
      'business',
      'viewer+id',
    ]),
  ).toBeDefined();
});
test('guests and missing API tokens do not request private workspace data', async () => {
  mockUser = { id: 'temporary-guest' };
  await render();
  expect(mockRequest).not.toHaveBeenCalled();
  mockUser = { id: 'user-1' };
  mockToken = null;
  await render();
  expect(mockRequest).not.toHaveBeenCalled();
});
test('availability sends exact real service/date/mode and duration to the API', async () => {
  mockRequest.mockResolvedValue({ availability: { slots: [] } });
  await render(Availability);
  expect(mockRequest).toHaveBeenCalledWith(
    '/v1/business-profiles/provider-1/availability?date=2026-11-18&categoryId=service%2Bid&serviceMode=home&durationMinutes=60',
    { signal: expect.any(Object) },
  );
});
test('save changes cache only after server ACK and uses explicit viewer identity', async () => {
  const saved = deferred();
  mockRequest.mockReturnValue(saved.promise);
  const { client } = await render(Save);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const key = [
    'business-profile',
    'provider-1',
    'user-1',
    'business',
    'viewer+id',
  ];
  client.setQueryData(key, businessFixture());
  let promise!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    promise = current.mutateAsync(true);
  });
  expect((client.getQueryData(key) as any).viewer.isSaved).toBe(false);
  expect(mockRequest).toHaveBeenCalledWith(
    '/v1/business-profiles/provider-1/save?viewerProfileId=viewer%2Bid&viewerProfileType=business',
    expect.objectContaining({ method: 'PUT', body: '{"saved":true}' }),
  );
  await ReactTestRenderer.act(async () => {
    saved.resolve({ saved: true });
    await promise;
  });
  expect((client.getQueryData(key) as any).viewer.isSaved).toBe(true);
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['saved-businesses', 'user-1'],
  });
});
test('a late mutation from a former token is rejected and cannot write cache', async () => {
  const saved = deferred();
  mockRequest.mockReturnValue(saved.promise);
  const { client } = await render(Save);
  const key = [
    'business-profile',
    'provider-1',
    'user-1',
    'business',
    'viewer+id',
  ];
  client.setQueryData(key, businessFixture());
  let outcome!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    outcome = current.mutateAsync(true).catch((problem: unknown) => problem);
  });
  mockToken = 'token-2';
  mockSession = { ...mockSession, token: mockToken };
  await ReactTestRenderer.act(async () => {
    saved.resolve({ saved: true });
  });
  expect(await outcome).toMatchObject({ code: 'session_changed' });
  expect((client.getQueryData(key) as any).viewer.isSaved).toBe(false);
});
test('whole-response deadline aborts an unresolved request/body and restores control', async () => {
  jest.useFakeTimers();
  mockRequest.mockReturnValue(new Promise(() => {}));
  const outcome = businessRequest('/hung-body').catch(problem => problem);
  const signal = mockRequest.mock.calls[0][1].signal;
  await jest.advanceTimersByTimeAsync(25_000);
  expect(await outcome).toMatchObject({ code: 'request_timeout', status: 0 });
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
test('TanStack cancellation rejects immediately even when the transport ignores abort', async () => {
  mockRequest.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const outcome = businessRequest('/cancelled', {
    signal: controller.signal,
  }).catch(problem => problem);
  const signal = mockRequest.mock.calls[0][1].signal;
  controller.abort();
  expect(await outcome).toMatchObject({ name: 'AbortError' });
  expect(signal.aborted).toBe(true);
});
test('already-cancelled request never starts transport', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    businessRequest('/cancelled', { signal: controller.signal }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(mockRequest).not.toHaveBeenCalled();
});
