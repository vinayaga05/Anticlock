import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type { MapPoint } from '@/features/provider-onboarding/utils/placeSearch';

async function ensureLocationPermission() {
  if (Platform.OS === 'ios') return new Promise<boolean>(resolve => Geolocation.requestAuthorization(() => resolve(true), () => resolve(false)));
  if (Platform.OS !== 'android') return true;
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
  if (await PermissionsAndroid.check(fine) || await PermissionsAndroid.check(coarse)) return true;
  // Android 12+ needs both in one request to offer precise or approximate access.
  const result = await PermissionsAndroid.requestMultiple([fine, coarse]);
  return result[fine] === PermissionsAndroid.RESULTS.GRANTED || result[coarse] === PermissionsAndroid.RESULTS.GRANTED;
}

export async function readCurrentPosition(): Promise<MapPoint> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    throw new Error('Location permission was denied. You can still search or place the pin manually.');
  }
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        reject(new Error('GPS is unavailable. You can still search or place the pin manually.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}
