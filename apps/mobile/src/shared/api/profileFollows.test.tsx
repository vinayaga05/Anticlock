import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { reconcileSocialState, useProfileConnections } from './profileFollows';

const mockRequest = jest.fn();
jest.mock('./client', () => ({
  apiRequest: (...args: any[]) => mockRequest(...args),
}));
const owner = {
  id: '11111111-1111-4111-8111-111111111111',
  type: 'personal' as const,
};
const viewer = {
  id: '22222222-2222-4222-8222-222222222222',
  type: 'personal' as const,
};
let current: any;
function Probe() {
  current = useProfileConnections(owner, viewer, 'followers');
  return null;
}
const page = (nextCursor: string | null) => ({
  data: {
    items: [],
    nextCursor,
    isOwner: false,
    counts: { followers: 0, following: 0, pendingRequests: 0 },
  },
});
const clients: QueryClient[] = [];
let tree: Renderer.ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  for (const client of clients.splice(0)) client.clear();
  jest.useRealTimers();
});
beforeEach(() => {
  jest.useFakeTimers();
  mockRequest.mockReset();
});
async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  await act(async () => {
    tree = Renderer.create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
  return client;
}
test('uses viewer-specific API pages and the server cursor for pagination', async () => {
  mockRequest
    .mockResolvedValueOnce(page(owner.id))
    .mockResolvedValueOnce(page(null));
  await render();
  expect(mockRequest.mock.calls[0][0]).toContain(
    `/connections/personal/${owner.id}/followers?limit=30`,
  );
  expect(mockRequest.mock.calls[0][0]).toContain(
    `viewerProfileId=${viewer.id}`,
  );
  let next: any;
  await act(async () => { next = await current.fetchNextPage(); });
  expect(mockRequest.mock.calls[1][0]).toContain(`cursor=${owner.id}`);
  expect(next.data.pages).toHaveLength(2);
});
test('an older or malformed server response becomes a recoverable error instead of crashing the list', async () => {
  mockRequest.mockResolvedValue({ data: [] });
  await render();
  expect(current.isError).toBe(true);
  expect(current.error.message).toContain('temporarily unavailable');
});
test('social changes purge cached private content, lists and counts before refetch', async () => {
  const client = new QueryClient();
  clients.push(client);
  const keys = [
    ['content', 'profile', 'personal', owner.id, 'posts', 'flash'],
    ['reels', 'feed'],
    ['profile-follows', 'connections', owner.id],
    ['business-profile', owner.id],
  ];
  for (const key of keys) client.setQueryData(key, ['private old result']);
  await reconcileSocialState(client);
  for (const key of keys) expect(client.getQueryData(key)).toBeUndefined();
});
