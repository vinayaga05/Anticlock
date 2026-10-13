import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import type { MapPoint } from '@/features/provider-onboarding/utils/placeSearch';

async function ensureLocationPermission() {
  if (Platform.OS !== 'android') return true;
  const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  if (await PermissionsAndroid.check(fine)) return true;
  const result = await PermissionsAndroid.request(fine, {
    title: 'Location access',
    message: 'Anticlock uses your location to drop the map pin at your business.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function readCurrentPosition(): Promise<MapPoint> {
  const allowed = await ensureLocationPermission();
  if (!allowed) {
    throw new Error('Allow location access to start from where you are.');
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
        reject(new Error('Could not read your current location.'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  });
}
