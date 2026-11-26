import { apiRequest, apiStream } from './client';
jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('./config', () => ({
  isApiEnabled: true,
  getApiBaseUrl: () => 'https://api.example.test',
}));
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('Android never sends a health assessment or booking to the server', async () => {
  global.fetch = jest.fn();
  await expect(
    apiRequest('/v1/fitness/assessment', { method: 'POST', body: '{}' }),
  ).rejects.toMatchObject({ code: 'feature_unavailable' });
  await expect(
    apiRequest('/v1/bookings', {
      method: 'POST',
      body: JSON.stringify({ categoryId: 'health.doctors' }),
    }),
  ).rejects.toMatchObject({ code: 'feature_unavailable' });
  await expect(
    apiStream(
      '/v1/assistant/chat',
      { message: 'prescribe treatment' },
      () => {},
    ),
  ).rejects.toMatchObject({ code: 'feature_unavailable' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('Android filters server search results and denies a direct health provider URL', async () => {
  const medical = { id: 'provider-1', categoryIds: ['health.doctors'] };
  const plumber = { id: 'provider-2', categoryIds: ['home.plumber'] };
  global.fetch = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ data: [medical, plumber], nextCursor: 'next' }),
    });
  await expect(apiRequest('/v1/marketplace/providers')).resolves.toEqual({
    data: [plumber],
    nextCursor: 'next',
  });
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ profile: medical }) });
  await expect(apiRequest('/v1/businesses/provider-1')).rejects.toMatchObject({
    code: 'feature_unavailable',
  });
});
