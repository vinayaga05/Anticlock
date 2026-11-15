import { PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { fitnessMediaAsset, pickFitnessMedia } from './fitnessMediaPicker';
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  launchImageLibrary: jest.fn(),
}));
const camera = launchCamera as jest.Mock;
const library = launchImageLibrary as jest.Mock;
const photo = {
  uri: 'file:///private/photo.jpg',
  type: 'image/jpeg',
  fileSize: 1200,
};
const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  camera.mockResolvedValue({ assets: [photo] });
  library.mockResolvedValue({ assets: [photo] });
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', {
    value: originalOS,
    configurable: true,
  });
});
test('gallery returns one local file without requesting base64, extra metadata or camera permission', async () => {
  const check = jest.spyOn(PermissionsAndroid, 'check');
  expect(await pickFitnessMedia('library')).toMatchObject({
    uri: photo.uri,
    type: 'image/jpeg',
    byteSize: 1200,
  });
  expect(library).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaType: 'photo',
      selectionLimit: 1,
      includeBase64: false,
      includeExtra: false,
      assetRepresentationMode: 'compatible',
    }),
  );
  expect(check).not.toHaveBeenCalled();
  expect(camera).not.toHaveBeenCalled();
});
test('camera never saves a private photo to the public camera roll', async () => {
  await pickFitnessMedia('camera');
  expect(camera).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaType: 'photo',
      cameraType: 'back',
      saveToPhotos: false,
      includeBase64: false,
      includeExtra: false,
    }),
  );
});
test('cancel and denied Android permission never produce a file', async () => {
  library.mockResolvedValueOnce({ didCancel: true });
  expect(await pickFitnessMedia('library')).toBeNull();
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
  await expect(pickFitnessMedia('camera')).rejects.toThrow('Settings');
  expect(camera).not.toHaveBeenCalled();
});
test('recording video requires explicit context and camera plus microphone permission', async () => {
  await expect(pickFitnessMedia('video')).rejects.toThrow('Choose a photo');
  expect(camera).not.toHaveBeenCalled();
  Object.defineProperty(Platform, 'OS', {
    value: 'android',
    configurable: true,
  });
  const check = jest
    .spyOn(PermissionsAndroid, 'check')
    .mockResolvedValue(false);
  const request = jest
    .spyOn(PermissionsAndroid, 'request')
    .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  camera.mockResolvedValue({
    assets: [
      { uri: 'file:///private/clip.mp4', type: 'video/mp4', fileSize: 2400 },
    ],
  });
  await expect(pickFitnessMedia('video', true)).resolves.toMatchObject({
    type: 'video/mp4',
  });
  expect(check.mock.calls.map(call => call[0])).toEqual([
    PermissionsAndroid.PERMISSIONS.CAMERA,
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
  ]);
  expect(request).toHaveBeenCalledTimes(2);
  expect(camera).toHaveBeenCalledWith(
    expect.objectContaining({
      mediaType: 'video',
      formatAsMp4: true,
      durationLimit: 60,
      saveToPhotos: false,
    }),
  );
});
test('rejects remote, oversized, unsupported or wrong-context media without manufacturing bytes', async () => {
  for (const value of [
    { ...photo, uri: 'https://public.invalid/image.jpg' },
    { ...photo, fileSize: 6 * 1024 * 1024 },
    { ...photo, type: 'image/heic' },
    { ...photo, fileSize: 0 },
  ])
    expect(() => fitnessMediaAsset(value)).toThrow();
  expect(
    fitnessMediaAsset({ ...photo, type: 'image/jpg', fileSize: undefined }),
  ).toMatchObject({ type: 'image/jpeg', byteSize: undefined });
  library.mockResolvedValueOnce({
    assets: [{ uri: 'content://private/video', type: 'video/mp4' }],
  });
  await expect(pickFitnessMedia('library')).rejects.toThrow('Choose a photo');
});
