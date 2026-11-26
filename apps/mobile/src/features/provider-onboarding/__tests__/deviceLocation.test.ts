import { PermissionsAndroid, Platform } from 'react-native';
import { readCurrentPosition } from '../utils/deviceLocation';
const mockPosition = jest.fn(), mockAuthorization = jest.fn();
jest.mock('@react-native-community/geolocation', () => ({ __esModule: true, default: { getCurrentPosition: (...args: any[]) => mockPosition(...args), requestAuthorization: (...args: any[]) => mockAuthorization(...args) } }));
const descriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
type PermissionResults = Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { jest.restoreAllMocks(); Object.defineProperty(Platform, 'OS', descriptor); });
test('Android permission denial does not attempt a GPS read', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({} as PermissionResults);
  await expect(readCurrentPosition()).rejects.toThrow('search or place the pin manually');
  expect(mockPosition).not.toHaveBeenCalled();
});
test('Android approximate access can locate the business before manual adjustment', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  const request = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
    [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.DENIED,
    [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
  } as PermissionResults);
  mockPosition.mockImplementation(yes => yes({ coords: { latitude: 13, longitude: 80 } }));
  await expect(readCurrentPosition()).resolves.toEqual({ latitude: 13, longitude: 80 });
  expect(request).toHaveBeenCalledWith([PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]);
});
test('iOS permission denial leaves manual placement available', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  mockAuthorization.mockImplementation((_yes, no) => no());
  await expect(readCurrentPosition()).rejects.toThrow('search or place the pin manually');
  expect(mockPosition).not.toHaveBeenCalled();
});
