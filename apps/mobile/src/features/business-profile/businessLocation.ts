import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

/** Only requested when the viewer taps Show distance. Coordinates stay on-device. */
export async function locateBusinessViewer(): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (Platform.OS === 'android') {
    const permission = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
    if (
      !(await PermissionsAndroid.check(permission)) &&
      !(await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ))
    ) {
      const result = await PermissionsAndroid.request(permission, {
        title: 'Distance to this business',
        message: 'Use your location to show the distance to this business.',
        buttonPositive: 'Continue',
        buttonNegative: 'Not now',
      });
      if (result !== PermissionsAndroid.RESULTS.GRANTED)
        throw new Error(
          'Location permission is needed to show distance. You can still use directions.',
        );
    }
  } else if (Platform.OS === 'ios')
    await new Promise<void>((resolve, reject) =>
      Geolocation.requestAuthorization(resolve, () =>
        reject(
          new Error('Allow location access in Settings to show distance.'),
        ),
      ),
    );
  return new Promise((resolve, reject) =>
    Geolocation.getCurrentPosition(
      position =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () =>
        reject(
          new Error(
            'Your location is unavailable. Try again, or use directions.',
          ),
        ),
      { timeout: 12_000, maximumAge: 60_000, enableHighAccuracy: false },
    ),
  );
}
