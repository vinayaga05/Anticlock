import { getFitnessMedia, uploadFitnessMedia } from './fitnessMedia';
let mockToken = 'token-a';
let mockSession: any;
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
  useAuth: () => ({ user: mockSession?.user }),
}));
const originalFetch = global.fetch;
const input = {
  uri: 'file:///selected.jpg',
  name: 'selected.jpg',
  type: 'image/jpeg',
  purpose: 'progress' as const,
  clientRequestId: '8a65ff67-091d-4c6f-b7db-85d0c7cb3946',
};
beforeEach(() => {
  mockToken = 'token-a';
  mockSession = {
    user: { id: 'user-a' },
    token: mockToken,
    expiresAt: '2099-01-01T00:00:00Z',
  };
  global.fetch = jest.fn();
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});
test('uploads native local media using private API authentication and no public storage URL', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({ media: { id: 'private-media' } }),
  });
  expect(await uploadFitnessMedia(input)).toMatchObject({
    id: 'private-media',
  });
  expect(fetch).toHaveBeenCalledWith(
    'https://fitness.test/v1/fitness/media/upload',
    expect.objectContaining({
      method: 'POST',
      headers: { Authorization: 'Bearer token-a' },
      body: expect.any(FormData),
    }),
  );
});
test('rejects remote URIs, wrong formats, excessive size and pre-cancelled uploads before transport', async () => {
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(
    uploadFitnessMedia({ ...input, uri: 'https://other.test/private' }),
  ).rejects.toThrow(/device/);
  await expect(
    uploadFitnessMedia({ ...input, type: 'text/html' }),
  ).rejects.toThrow(/device/);
  await expect(
    uploadFitnessMedia({ ...input, byteSize: 6 * 1024 * 1024 }),
  ).rejects.toThrow(/5MB/);
  await expect(
    uploadFitnessMedia(input, { signal: cancelled.signal }),
  ).rejects.toThrow(/cancelled/);
  expect(fetch).not.toHaveBeenCalled();
});
test('does not accept upload results after an account change', async () => {
  let finish!: (value: any) => void;
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  });
  const request = uploadFitnessMedia(input);
  await Promise.resolve();
  await Promise.resolve();
  mockToken = 'token-b';
  mockSession = { ...mockSession, token: mockToken };
  finish({ media: { id: 'old-private-result' } });
  await expect(request).rejects.toThrow(/account changed/);
});
test('deadline includes a stalled response body and cancellation remains effective', async () => {
  jest.useFakeTimers();
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: () => new Promise(() => {}),
  });
  const request = uploadFitnessMedia(input);
  const handled = expect(request).rejects.toThrow(/timed out/);
  await jest.advanceTimersByTimeAsync(50_000);
  await handled;
  const controller = new AbortController();
  const next = uploadFitnessMedia(input, { signal: controller.signal });
  const cancelled = expect(next).rejects.toThrow(/cancelled/);
  controller.abort();
  await cancelled;
});
test('content uses the authenticated API, ignoring a remote URL in metadata', async () => {
  (fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      media: { id: 'private-id', url: 'https://untrusted.test/steal-token' },
    }),
  });
  const actual = await getFitnessMedia('private-id', 'provider-id');
  expect(actual.source).toEqual({
    uri: 'https://fitness.test/v1/fitness/media/private-id/content?providerId=provider-id',
    headers: { Authorization: 'Bearer token-a' },
  });
});
