import { uploadBusinessImage } from './businessMedia';
const mockUpload = jest.fn();
let mockToken: string | null;
let mockSession: any;
jest.mock('@/shared/api/publishingHooks', () => ({
  uploadContentMedia: (...args: any[]) => mockUpload(...args),
}));
jest.mock('@/shared/api/client', () => ({ getApiToken: () => mockToken }));
jest.mock('@/shared/services/storage', () => ({
  getStoredSession: () => mockSession,
}));
const identity = {
  id: 'user-1',
  type: 'user' as const,
  name: 'Mira',
  avatarUrl: null,
};
const photo = {
  uri: 'file:///review.jpg',
  filename: 'review.jpg',
  contentType: 'image/jpeg' as const,
  byteSize: 1024,
  width: 640,
  height: 480,
};
function deferred() {
  let resolve!: (id: string) => void;
  const promise = new Promise<string>(yes => {
    resolve = yes;
  });
  return { resolve, promise };
}
beforeEach(() => {
  mockToken = 'token-1';
  mockSession = {
    user: { id: 'user-1' },
    token: mockToken,
    expiresAt: '2099-01-01',
  };
  mockUpload.mockReset().mockResolvedValue('media-1');
});
afterEach(() => jest.useRealTimers());
test('uploads native image through public creator media preserving exact identity and metadata', async () => {
  await expect(uploadBusinessImage(identity, photo)).resolves.toBe('media-1');
  expect(mockUpload).toHaveBeenCalledWith(
    identity,
    {
      kind: 'image',
      localUri: photo.uri,
      filename: photo.filename,
      contentType: photo.contentType,
      byteSize: photo.byteSize,
      width: 640,
      height: 480,
    },
    'public',
    undefined,
    { signal: expect.any(Object) },
  );
});
test('already cancelled upload never creates an upload session', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    uploadBusinessImage(identity, photo, controller.signal),
  ).rejects.toThrow('cancelled');
  expect(mockUpload).not.toHaveBeenCalled();
});
test('cancellation aborts transport and promptly rejects even when upload/body ignores abort', async () => {
  mockUpload.mockReturnValue(new Promise(() => {}));
  const controller = new AbortController();
  const result = uploadBusinessImage(identity, photo, controller.signal).catch(
    problem => problem,
  );
  const signal = mockUpload.mock.calls[0][4].signal;
  controller.abort();
  expect(await result).toEqual(
    expect.objectContaining({ message: 'Image upload cancelled.' }),
  );
  expect(signal.aborted).toBe(true);
});
test('45 second deadline bounds all upload stages including a stalled response body', async () => {
  jest.useFakeTimers();
  mockUpload.mockReturnValue(new Promise(() => {}));
  const result = uploadBusinessImage(identity, photo).catch(problem => problem);
  const signal = mockUpload.mock.calls[0][4].signal;
  await jest.advanceTimersByTimeAsync(45_000);
  expect((await result).message).toContain('timed out');
  expect(signal.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
test.each(['token', 'account', 'expiry'])(
  'late upload result is rejected after session %s changes',
  async change => {
    const pending = deferred();
    mockUpload.mockReturnValue(pending.promise);
    const result = uploadBusinessImage(identity, photo).catch(
      problem => problem,
    );
    if (change === 'token') {
      mockToken = 'token-2';
      mockSession = { ...mockSession, token: mockToken };
    } else if (change === 'account')
      mockSession = { ...mockSession, user: { id: 'user-2' } };
    else mockSession = { ...mockSession, expiresAt: '2000-01-01' };
    pending.resolve('old-media');
    expect((await result).message).toContain('account changed');
  },
);
test('requires matching stored session and rejects another personal identity before transport', async () => {
  mockToken = 'different-token';
  await expect(uploadBusinessImage(identity, photo)).rejects.toThrow(
    'account changed',
  );
  mockToken = 'token-1';
  await expect(
    uploadBusinessImage({ ...identity, id: 'user-2' }, photo),
  ).rejects.toThrow('own profile');
  mockSession = null;
  await expect(uploadBusinessImage(identity, photo)).rejects.toThrow('Sign in');
  expect(mockUpload).not.toHaveBeenCalled();
});
test.each([
  { byteSize: 5 * 1024 * 1024 + 1 },
  { uri: 'https://example.test/photo.jpg' },
  { byteSize: 0 },
  { contentType: 'image/heic' },
])(
  'rejects invalid or oversized photos before public upload: %j',
  async patch => {
    await expect(
      uploadBusinessImage(identity, { ...photo, ...patch } as any),
    ).rejects.toThrow('5 MB');
    expect(mockUpload).not.toHaveBeenCalled();
  },
);
test('rejects an upload without a confirmed media identifier', async () => {
  mockUpload.mockResolvedValue('');
  await expect(uploadBusinessImage(identity, photo)).rejects.toThrow(
    'confirmed',
  );
});
