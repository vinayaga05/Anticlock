import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useComplaintsQuery, useCreateComplaintMutation } from './complaintHooks';

let mockUser: any = { id: 'user-1' };
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser }) }));
const mockRequest = jest.fn();
jest.mock('./client', () => ({ apiRequest: (...args: any[]) => mockRequest(...args) }));
let current: any;
function ListProbe() { current = useComplaintsQuery(); return null; }
function CreateProbe() { current = useCreateComplaintMutation(); return null; }
const clients: QueryClient[] = [];
const renderers: ReactTestRenderer.ReactTestRenderer[] = [];
async function render(Probe = ListProbe) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    renderer = ReactTestRenderer.create(<QueryClientProvider client={client}><Probe /></QueryClientProvider>);
  });
  await ReactTestRenderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
  renderers.push(renderer);
  return { client, renderer };
}
beforeEach(() => { mockUser = { id: 'user-1' }; mockRequest.mockReset(); });
afterEach(() => { ReactTestRenderer.act(() => renderers.splice(0).forEach(renderer => renderer.unmount())); clients.splice(0).forEach(client => client.clear()); });

test('fetches shared API pages with encoded cursor and derives the next page from the server', async () => {
  mockRequest.mockResolvedValueOnce({ complaints: [{ id: 'first' }], nextCursor: 'cursor+one/=' }).mockResolvedValueOnce({ complaints: [{ id: 'second' }], nextCursor: null });
  const { client } = await render();
  expect(mockRequest).toHaveBeenCalledWith('/v1/complaints?limit=20');
  expect(current.hasNextPage).toBe(true);
  await ReactTestRenderer.act(async () => { await current.fetchNextPage(); await new Promise(resolve => setTimeout(resolve, 15)); });
  expect(mockRequest).toHaveBeenLastCalledWith('/v1/complaints?limit=20&cursor=cursor%2Bone%2F%3D');
  expect(current.data.pages.flatMap((page: any) => page.complaints.map((row: any) => row.id))).toEqual(['first', 'second']);
  expect(current.hasNextPage).toBe(false);
  expect(client.getQueryData(['complaints', 'user-1'])).toBeDefined();
});

test('does not request complaints for temporary guests', async () => {
  mockUser = { id: 'temporary-guest' };
  await render(); expect(mockRequest).not.toHaveBeenCalled(); expect(current.data).toBeUndefined();
});

test('changes the cache key when the account changes and never returns another account cached list', async () => {
  mockRequest.mockResolvedValueOnce({ complaints: [{ id: 'private-old-list' }], nextCursor: null }).mockResolvedValueOnce({ complaints: [], nextCursor: null });
  const { client, renderer } = await render();
  expect(current.data.pages[0].complaints[0].id).toBe('private-old-list');
  mockUser = { id: 'user-2' };
  await ReactTestRenderer.act(async () => {
    renderer.update(<QueryClientProvider client={client}><ListProbe /></QueryClientProvider>);
  });
  await ReactTestRenderer.act(async () => { await new Promise(resolve => setTimeout(resolve, 15)); });
  expect(current.data.pages[0].complaints).toEqual([]);
  expect(client.getQueryData(['complaints', 'user-1'])).toBeDefined();
  expect(client.getQueryData(['complaints', 'user-2'])).toBeDefined();
});

test('POST uses only caller text/request id and invalidates the shared complaint queries after acknowledgement', async () => {
  const complaint = { id: 'saved', title: 'Broken light' }; mockRequest.mockResolvedValue({ complaint });
  const { client } = await render(CreateProbe);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const request = { title: 'Broken light', description: 'The entrance light is broken.', clientRequestId: 'request-123456' };
  let saved;
  await ReactTestRenderer.act(async () => { saved = await current.mutateAsync(request); });
  expect(saved).toBe(complaint);
  expect(mockRequest).toHaveBeenCalledWith('/v1/complaints', { method: 'POST', body: JSON.stringify(request) });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['complaints'] });
});

test('guest POST is rejected locally without calling the server', async () => {
  mockUser = { id: 'temporary-guest' }; await render(CreateProbe);
  await ReactTestRenderer.act(async () => { await expect(current.mutateAsync({ title: 'Example title', description: 'A valid description here.' })).rejects.toThrow('Sign in'); });
  expect(mockRequest).not.toHaveBeenCalled();
});
