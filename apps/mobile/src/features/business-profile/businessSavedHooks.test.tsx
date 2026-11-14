import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSavedBusinessesQuery,
  useUnsaveBusinessMutation,
} from './businessSavedHooks';

let mockUser: any, mockToken: string | null, mockSession: any;
const mockRequest = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/api/client', () => ({
  ApiError: jest.requireActual('@/shared/api/client').ApiError,
  getApiToken: () => mockToken,
}));
jest.mock('@/shared/services/auth/authService', () => ({
  readStoredSession: () => mockSession,
}));
jest.mock('./businessProfileHooks', () => ({
  businessRequest: (...args: any[]) => mockRequest(...args),
}));

let current: any;
const viewer = { id: 'viewer+business', type: 'business' as const };
function List() {
  current = useSavedBusinessesQuery(viewer);
  return null;
}
function Remove() {
  current = useUnsaveBusinessMutation(viewer);
  return null;
}
const clients: QueryClient[] = [],
  renderers: ReactTestRenderer.ReactTestRenderer[] = [];
async function flush() {
  await ReactTestRenderer.act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
}
async function render(Probe = List) {
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
  await flush();
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
  jest.useFakeTimers();
  mockUser = { id: 'user-1' };
  mockToken = 'token-1';
  mockSession = { user: mockUser, token: mockToken };
  mockRequest.mockReset();
});
afterEach(() => {
  ReactTestRenderer.act(() =>
    renderers.splice(0).forEach(renderer => renderer.unmount()),
  );
  clients.splice(0).forEach(client => client.clear());
  jest.useRealTimers();
});

test('requests viewer-filtered saved business pages with an encoded stable cursor', async () => {
  mockRequest
    .mockResolvedValueOnce({
      businesses: [{ id: 'first' }],
      nextCursor: 'cursor+one/=',
    })
    .mockResolvedValueOnce({
      businesses: [{ id: 'second' }],
      nextCursor: null,
    });
  const { client } = await render();
  expect(mockRequest).toHaveBeenCalledWith(
    '/v1/business-profiles/saved?viewerProfileId=viewer%2Bbusiness&viewerProfileType=business&limit=20',
    { signal: expect.any(Object) },
  );
  expect(current.hasNextPage).toBe(true);
  await ReactTestRenderer.act(async () => {
    await current.fetchNextPage();
  });
  await flush();
  expect(mockRequest).toHaveBeenLastCalledWith(
    '/v1/business-profiles/saved?viewerProfileId=viewer%2Bbusiness&viewerProfileType=business&limit=20&cursor=cursor%2Bone%2F%3D',
    { signal: expect.any(Object) },
  );
  expect(
    current.data.pages.flatMap((page: any) =>
      page.businesses.map((business: any) => business.id),
    ),
  ).toEqual(['first', 'second']);
  expect(current.hasNextPage).toBe(false);
  expect(
    client.getQueryData(['saved-businesses', 'user-1', 'business', viewer.id]),
  ).toBeDefined();
});
test('guests and missing tokens never request saved business data', async () => {
  mockUser = { id: 'temporary-guest' };
  await render();
  expect(mockRequest).not.toHaveBeenCalled();
  mockUser = { id: 'user-1' };
  mockToken = null;
  await render();
  expect(mockRequest).not.toHaveBeenCalled();
});
test('changing accounts removes previous saved rows and rejects late previous-account responses', async () => {
  const old = deferred();
  mockRequest
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce({
      businesses: [{ id: 'new-account-business' }],
      nextCursor: null,
    });
  const { client, renderer } = await render();
  mockUser = { id: 'user-2' };
  mockToken = 'token-2';
  mockSession = { user: mockUser, token: mockToken };
  await ReactTestRenderer.act(async () => {
    renderer.update(
      <QueryClientProvider client={client}>
        <List />
      </QueryClientProvider>,
    );
  });
  await flush();
  await ReactTestRenderer.act(async () => {
    old.resolve({
      businesses: [{ id: 'old-account-business' }],
      nextCursor: null,
    });
  });
  await flush();
  expect(current.data.pages[0].businesses).toEqual([
    { id: 'new-account-business' },
  ]);
  expect(
    client.getQueryData(['saved-businesses', 'user-1', 'business', viewer.id]),
  ).toBeUndefined();
});
test('unsave invalidates only the authenticated account after server acknowledgement', async () => {
  const pending = deferred();
  mockRequest.mockReturnValue(pending.promise);
  const { client } = await render(Remove);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  let promise!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    promise = current.mutateAsync('provider/id');
  });
  expect(invalidate).not.toHaveBeenCalled();
  expect(mockRequest).toHaveBeenCalledWith(
    '/v1/business-profiles/provider%2Fid/save?viewerProfileId=viewer%2Bbusiness&viewerProfileType=business',
    { method: 'PUT', body: '{"saved":false}' },
  );
  await ReactTestRenderer.act(async () => {
    pending.resolve({ saved: false });
    await promise;
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['saved-businesses', 'user-1'],
  });
  expect(invalidate).toHaveBeenCalledWith({
    queryKey: ['business-profile', 'provider/id', 'user-1'],
  });
});
test('late unsave acknowledgements cannot invalidate a new account cache', async () => {
  const pending = deferred();
  mockRequest.mockReturnValue(pending.promise);
  const { client } = await render(Remove);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  let outcome!: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    outcome = current
      .mutateAsync('provider-1')
      .catch((error: unknown) => error);
  });
  mockToken = 'token-2';
  mockSession = { ...mockSession, token: mockToken };
  await ReactTestRenderer.act(async () => {
    pending.resolve({ saved: false });
    await outcome;
  });
  expect(await outcome).toMatchObject({ code: 'session_changed' });
  expect(invalidate).not.toHaveBeenCalled();
});
test('failed removals remain failures without cache invalidation', async () => {
  mockRequest.mockRejectedValue(new Error('Offline'));
  const { client } = await render(Remove);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await ReactTestRenderer.act(async () => {
    await expect(current.mutateAsync('provider-1')).rejects.toThrow('Offline');
  });
  expect(invalidate).not.toHaveBeenCalled();
});
