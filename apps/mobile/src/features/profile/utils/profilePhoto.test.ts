import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary, type Asset } from 'react-native-image-picker';
import { getApiToken } from '@/shared/api/client';
import { getStoredSession } from '@/shared/services/storage';
import {
  MAX_PROFILE_PHOTO_BYTES,
  pickProfilePhoto,
  uploadProfilePhoto,
  type PickedProfilePhoto,
} from './profilePhoto';

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(), launchImageLibrary: jest.fn(),
}));
jest.mock('@/shared/api/client', () => ({ getApiToken: jest.fn() }));
jest.mock('@/shared/api/config', () => ({ getApiBaseUrl: () => 'https://api.example.test' }));
jest.mock('@/shared/services/storage', () => ({ getStoredSession: jest.fn() }));

const API = 'https://api.example.test';
const avatarUrl = `${API}/v1/media/file/public-media/public%2Favatars%2Fowner%2Fasset%2Foriginal.jpg`;
const asset: Asset = {
  uri: 'content://media/external/images/42', type: 'image/jpeg',
  fileName: 'original.jpeg', fileSize: 4096, width: 1024, height: 768,
};
const photo: PickedProfilePhoto = {
  uri: asset.uri!, filename: 'profile-photo.jpg', contentType: 'image/jpeg', byteSize: 4096,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
const flush = () => Promise.resolve().then(() => Promise.resolve());
const originalFetch = global.fetch;
const formDataGlobal = global as unknown as { FormData: typeof FormData };
const originalFormData = formDataGlobal.FormData;
const originalPlatform = Platform.OS;
const fetchMock = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  (getApiToken as jest.Mock).mockReturnValue('session-token');
  (getStoredSession as jest.Mock).mockReturnValue({ token: 'session-token', user: { id: 'owner' } });
  (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [{ ...asset }] });
  (launchCamera as jest.Mock).mockResolvedValue({ assets: [{ ...asset, uri: 'file:///tmp/profile.jpg' }] });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(true);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  fetchMock.mockReset().mockResolvedValue({ ok: true, status: 201, json: async () => ({ avatarUrl }) });
  global.fetch = fetchMock as typeof fetch;
  // Node's web FormData coerces native {uri,type,name} files to strings.
  formDataGlobal.FormData = require('react-native/Libraries/Network/FormData').default;
});

afterEach(() => {
  global.fetch = originalFetch;
  formDataGlobal.FormData = originalFormData;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('profile photo picker', () => {
  it('uses one compatible, resized native library photo without base64 or broad storage permissions', async () => {
    const selected = await pickProfilePhoto('library');
    expect(selected).toEqual({ ...photo, width: 1024, height: 768 });
    expect(launchImageLibrary).toHaveBeenCalledWith(expect.objectContaining({
      mediaType: 'photo', selectionLimit: 1, maxWidth: 1024, maxHeight: 1024,
      quality: 0.8, assetRepresentationMode: 'compatible', includeBase64: false, includeExtra: false,
      restrictMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    }));
    expect(PermissionsAndroid.request).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['camera', 'library'] as const)('%s cancellation is neutral', async source => {
    const picker = source === 'camera' ? launchCamera : launchImageLibrary;
    (picker as jest.Mock).mockResolvedValue({ didCancel: true });
    await expect(pickProfilePhoto(source)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requests Android camera permission and uses the front camera without saving a public copy', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    await pickProfilePhoto('camera');
    expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.CAMERA, expect.any(Object));
    expect(launchCamera).toHaveBeenCalledWith(expect.objectContaining({
      cameraType: 'front', saveToPhotos: false, maxWidth: 1024, maxHeight: 1024,
    }));
  });

  it.each(['denied', 'never_ask_again'])('denied Android permission (%s) offers Settings without opening the camera', async permission => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    (PermissionsAndroid.check as jest.Mock).mockResolvedValue(false);
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue(permission);
    await expect(pickProfilePhoto('camera')).rejects.toMatchObject({ code: 'permission_denied', message: expect.stringContaining('Settings') });
    expect(launchCamera).not.toHaveBeenCalled();
  });

  it('turns a native library permission denial into an actionable error', async () => {
    (launchImageLibrary as jest.Mock).mockResolvedValue({ errorCode: 'permission', errorMessage: 'native debug detail' });
    await expect(pickProfilePhoto('library')).rejects.toMatchObject({ code: 'permission_denied', message: expect.stringContaining('Settings') });
  });

  it('reports an unavailable camera and suggests gallery', async () => {
    (launchCamera as jest.Mock).mockResolvedValue({ errorCode: 'camera_unavailable' });
    await expect(pickProfilePhoto('camera')).rejects.toMatchObject({ code: 'camera_unavailable', message: expect.stringContaining('gallery') });
  });

  it.each([
    { ...asset, type: 'image/heic' },
    { ...asset, type: 'video/mp4' },
    { ...asset, uri: 'https://external.example.test/photo.jpg' },
    { ...asset, fileSize: MAX_PROFILE_PHOTO_BYTES + 1 },
    { ...asset, fileSize: 0 },
    { ...asset, fileSize: undefined },
    { ...asset, fileSize: NaN },
  ])('rejects an unusable or oversized photo %#', async invalid => {
    (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [invalid] });
    await expect(pickProfilePhoto('library')).rejects.toMatchObject({ code: 'invalid_photo' });
  });

  it.each([
    { type: 'image/png', fileName: 'anything.PNG', extension: 'png' },
    { type: 'image/webp', fileName: 'anything.webp', extension: 'webp' },
    { type: undefined, fileName: 'anything.jpeg', extension: 'jpg' },
  ])('accepts supported image metadata at the 5 MiB boundary (%s)', async input => {
    (launchImageLibrary as jest.Mock).mockResolvedValue({ assets: [{ ...asset, ...input, fileSize: MAX_PROFILE_PHOTO_BYTES }] });
    const selected = await pickProfilePhoto('library');
    expect(selected).toMatchObject({ byteSize: MAX_PROFILE_PHOTO_BYTES, filename: `profile-photo.${input.extension}` });
  });
});

describe('profile photo upload', () => {
  it('sends native multipart only to the API, lets native set the boundary, and returns a stable avatar URL', async () => {
    await expect(uploadProfilePhoto(photo, { expectedUserId: 'owner', expectedToken: 'session-token' })).resolves.toBe(avatarUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API}/auth/mobile/avatar`);
    expect(init).toMatchObject({ method: 'POST', redirect: 'error', headers: { Authorization: 'Bearer session-token', Accept: 'application/json' } });
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body.getParts()).toEqual([expect.objectContaining({
      uri: photo.uri, name: photo.filename, type: photo.contentType,
      headers: expect.objectContaining({ 'content-disposition': expect.stringContaining('name="file"') }),
    })]);
  });

  it('requires the same authenticated user/token before sending the local photo', async () => {
    (getApiToken as jest.Mock).mockReturnValue(null);
    await expect(uploadProfilePhoto(photo)).rejects.toMatchObject({ code: 'unauthorized' });
    (getApiToken as jest.Mock).mockReturnValue('another-session');
    await expect(uploadProfilePhoto(photo, { expectedToken: 'session-token' })).rejects.toMatchObject({ code: 'session_changed' });
    await expect(uploadProfilePhoto(photo, { expectedUserId: 'other-owner' })).rejects.toMatchObject({ code: 'session_changed' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a changed session before accepting a late upload response', async () => {
    const response = deferred<any>(); fetchMock.mockReturnValue(response.promise);
    const saving = uploadProfilePhoto(photo);
    (getApiToken as jest.Mock).mockReturnValue('new-session');
    response.resolve({ ok: true, status: 201, json: async () => ({ avatarUrl }) });
    await expect(saving).rejects.toMatchObject({ code: 'session_changed' });
  });

  it('honors the caller session guard before accepting response body data', async () => {
    const body = deferred<unknown>();
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: () => body.promise });
    let current = true;
    const saving = uploadProfilePhoto(photo, { isCurrentSession: () => current });
    await flush(); current = false; body.resolve({ avatarUrl });
    await expect(saving).rejects.toMatchObject({ code: 'session_changed' });
  });

  it('cancels immediately even if native fetch ignores abort, and rejects late response data', async () => {
    const pending = deferred<any>(); fetchMock.mockReturnValue(pending.promise);
    const controller = new AbortController();
    const saving = uploadProfilePhoto(photo, { signal: controller.signal });
    const result = expect(saving).rejects.toMatchObject({ code: 'cancelled' });
    controller.abort(); await result;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    pending.resolve({ ok: true, status: 201, json: async () => ({ avatarUrl }) });
    await flush();
  });

  it.each(['request', 'response body'])('bounds a stalled %s to 45 seconds and aborts the transfer', async stage => {
    jest.useFakeTimers();
    const never = new Promise(() => {});
    fetchMock.mockReturnValue(stage === 'request' ? never : Promise.resolve({ ok: true, json: () => never }));
    const saving = uploadProfilePhoto(photo);
    const result = expect(saving).rejects.toMatchObject({ code: 'timeout' });
    await flush(); jest.advanceTimersByTime(45_000); await result;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([
    'https://bucket.r2.cloudflarestorage.com/private/avatar?X-Amz-Signature=secret',
    `${avatarUrl}?expires=123`, `${avatarUrl}#fragment`, `${API}/unrelated`,
    'javascript:alert(1)', 'not a URL',
  ])('rejects external, temporary or invalid response URLs without forwarding a bearer token (%s)', async url => {
    fetchMock.mockResolvedValue({ ok: true, status: 201, json: async () => ({ avatarUrl: url }) });
    await expect(uploadProfilePhoto(photo)).rejects.toMatchObject({ code: 'upload_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API}/auth/mobile/avatar`);
  });

  it('retains safe server errors and rejects malformed success bodies', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 413, json: async () => ({ error: { message: 'Choose a photo up to 5 MB.' } }) });
    await expect(uploadProfilePhoto(photo)).rejects.toMatchObject({ message: 'Choose a photo up to 5 MB.' });
    fetchMock.mockResolvedValueOnce({ ok: true, status: 201, json: async () => { throw new Error('not JSON'); } });
    await expect(uploadProfilePhoto(photo)).rejects.toMatchObject({ code: 'upload_failed' });
  });
});
