import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  generateThumbnails,
  getVideoInfo,
  isClipEditorAvailable,
} from '@anticlock/react-native-clip-editor';
import {
  captureStoryMedia,
  pickStoryMedia,
  storyUploadFile,
  STORY_MAX_SELECTION,
} from './storyMediaPicker';

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
jest.mock('@anticlock/react-native-clip-editor', () => ({
  generateThumbnails: jest.fn(),
  getVideoInfo: jest.fn(),
  isClipEditorAvailable: jest.fn(),
}));
const library = launchImageLibrary as jest.Mock;
const camera = launchCamera as jest.Mock;
const photo = {
  uri: 'file:///private/photo.jpg',
  type: 'image/jpeg',
  fileName: 'photo.jpg',
  fileSize: 1200,
};
const video = {
  uri: 'content://private/video',
  type: 'video/mp4',
  fileName: 'video.mp4',
  fileSize: 2400,
  duration: 60,
};
const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  library.mockResolvedValue({ assets: [photo] });
  camera.mockResolvedValue({ assets: [photo] });
  (isClipEditorAvailable as jest.Mock).mockReturnValue(false);
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', {
    value: originalOS,
    configurable: true,
  });
});

test('mixed selection keeps picker order and native URIs without requesting broad gallery access', async () => {
  library.mockResolvedValue({ assets: [photo, video] });
  const permission = jest.spyOn(PermissionsAndroid, 'check');
  const media = await pickStoryMedia('all');
  expect(media.map(item => item.type)).toEqual(['photo', 'video']);
  expect(media[1]).toMatchObject({
    uri: video.uri,
    durationMs: 60_000,
    byteSize: 2400,
  });
  expect(library).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaType: 'mixed',
      selectionLimit: STORY_MAX_SELECTION,
      includeBase64: false,
      includeExtra: false,
      assetRepresentationMode: 'compatible',
    }),
  );
  expect(permission).not.toHaveBeenCalled();
  const load = jest.fn();
  expect(await storyUploadFile({ ...media[1], loadBytes: load })).toMatchObject(
    { kind: 'video', localUri: video.uri, byteSize: 2400 },
  );
  expect(load).not.toHaveBeenCalled();
});

test('filters map to native picker filters and selection cannot exceed ten', async () => {
  await pickStoryMedia('photos', 99);
  expect(library).toHaveBeenLastCalledWith(
    expect.objectContaining({ mediaType: 'photo', selectionLimit: 10 }),
  );
  library.mockResolvedValue({ assets: [video] });
  await pickStoryMedia('videos', 0);
  expect(library).toHaveBeenLastCalledWith(
    expect.objectContaining({ mediaType: 'video', selectionLimit: 1 }),
  );
  library.mockResolvedValue({ assets: [photo, video] });
  await expect(pickStoryMedia('all', 1)).rejects.toThrow('up to 1');
});

test('rejects unsupported, unreadable, empty or overlong media instead of creating a fake story', async () => {
  for (const asset of [
    { ...photo, uri: 'https://remote.invalid/a.jpg' },
    { ...photo, type: 'image/heic' },
    { ...photo, fileSize: 0 },
    { ...photo, fileSize: NaN },
    { ...video, duration: 60.001 },
    { ...video, duration: undefined },
  ]) {
    library.mockResolvedValueOnce({ assets: [asset] });
    await expect(pickStoryMedia('all')).rejects.toThrow();
  }
  library.mockResolvedValueOnce({ assets: [video] });
  await expect(pickStoryMedia('photos')).rejects.toThrow('Choose a photo');
});

test('cancellation is empty and native errors do not expose picker diagnostic data', async () => {
  library.mockResolvedValueOnce({ didCancel: true });
  expect(await pickStoryMedia('all')).toEqual([]);
  camera.mockResolvedValueOnce({ didCancel: true });
  expect(await captureStoryMedia('photo')).toBeNull();
  library.mockResolvedValueOnce({
    errorCode: 'permission',
    errorMessage: 'private debug details',
  });
  await expect(pickStoryMedia('all')).rejects.toThrow('Settings');
  camera.mockResolvedValueOnce({ errorCode: 'camera_unavailable' });
  await expect(captureStoryMedia('photo')).rejects.toThrow(
    'Camera unavailable',
  );
});

test('Android video capture requires camera and microphone and sets a sixty second recording limit', async () => {
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const request = jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  camera.mockResolvedValue({ assets: [video] });
  await captureStoryMedia('video');
  expect(request.mock.calls.map(call => call[0])).toEqual([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  expect(camera).toHaveBeenCalledWith(
    expect.objectContaining({
      durationLimit: 60,
      saveToPhotos: false,
      formatAsMp4: true,
    }),
  );
  request.mockResolvedValueOnce(PermissionsAndroid.RESULTS.DENIED);
  camera.mockClear();
  await expect(captureStoryMedia('photo')).rejects.toThrow('Settings');
  expect(camera).not.toHaveBeenCalled();
});

test('video info repairs missing duration and optional thumbnails never block valid selection', async () => {
  (isClipEditorAvailable as jest.Mock).mockReturnValue(true);
  (getVideoInfo as jest.Mock).mockResolvedValue({
    durationMs: 12_000,
    width: 720,
    height: 1280,
  });
  (generateThumbnails as jest.Mock).mockResolvedValue([
    'file:///private/thumb.jpg',
  ]);
  library.mockResolvedValue({ assets: [{ ...video, duration: undefined }] });
  expect((await pickStoryMedia('videos'))[0]).toMatchObject({
    durationMs: 12_000,
    thumbnailUri: 'file:///private/thumb.jpg',
    width: 720,
  });
  (generateThumbnails as jest.Mock).mockRejectedValueOnce(
    new Error('unavailable'),
  );
  expect((await pickStoryMedia('videos'))[0].uri).toBe(video.uri);
});

test('upload reads bytes only when picker omits size and rejects an empty fallback', async () => {
  library.mockResolvedValue({ assets: [{ ...photo, fileSize: undefined }] });
  const item = (await pickStoryMedia('photos'))[0];
  const loadBytes = jest.fn().mockResolvedValue(new ArrayBuffer(20));
  expect(await storyUploadFile({ ...item, loadBytes })).toMatchObject({
    byteSize: 20,
    bytes: expect.any(ArrayBuffer),
  });
  expect(loadBytes).toHaveBeenCalledTimes(1);
  loadBytes.mockResolvedValueOnce(new ArrayBuffer(0));
  await expect(storyUploadFile({ ...item, loadBytes })).rejects.toThrow(
    'empty',
  );
});
