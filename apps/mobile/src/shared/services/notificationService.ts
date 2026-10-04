import { Platform, PermissionsAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

export type NotificationData = {
  notificationId?: string;
  type?: string;
  [key: string]: any;
};

export type NotificationHandler = (
  data: NotificationData,
  notification?: FirebaseMessagingTypes.Notification
) => void;

let foregroundHandler: NotificationHandler | null = null;
let backgroundHandler: NotificationHandler | null = null;

/**
 * Request notification permission. On Android 13+, requires POST_NOTIFICATIONS runtime permission.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[Notifications] iOS permission denied');
      }

      return enabled;
    } else {
      // Android
      if (Platform.Version >= 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      // Android 12 and below don't require runtime permission
      return true;
    }
  } catch (error) {
    console.error('[Notifications] Permission request failed:', error);
    return false;
  }
}

/**
 * Check if notification permission is granted
 */
export async function checkNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') {
      const authStatus = await messaging().hasPermission();
      return (
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL
      );
    } else {
      if (Platform.Version >= 33) {
        const result = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return result;
      }
      return true;
    }
  } catch (error) {
    console.error('[Notifications] Permission check failed:', error);
    return false;
  }
}

/**
 * Get FCM token for this device
 */
export async function getDeviceToken(): Promise<string | null> {
  try {
    const hasPermission = await checkNotificationPermission();
    if (!hasPermission) {
      console.log('[Notifications] No permission, cannot get token');
      return null;
    }

    const token = await messaging().getToken();
    console.log('[Notifications] FCM token obtained');
    return token;
  } catch (error) {
    console.error('[Notifications] Failed to get FCM token:', error);
    return null;
  }
}

/**
 * Set up foreground notification handler
 */
export function setForegroundNotificationHandler(handler: NotificationHandler) {
  foregroundHandler = handler;

  // Register Firebase foreground listener
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    console.log('[Notifications] Foreground notification received:', remoteMessage);

    const data = (remoteMessage.data as NotificationData) || {};
    const notification = remoteMessage.notification;

    if (foregroundHandler) {
      foregroundHandler(data, notification);
    } else {
      // Default: show an alert
      if (notification) {
        Alert.alert(
          notification.title || 'Notification',
          notification.body || '',
          [{ text: 'OK' }]
        );
      }
    }
  });

  return unsubscribe;
}

/**
 * Set up background/quit notification handler
 */
export function setBackgroundNotificationHandler(handler: NotificationHandler) {
  backgroundHandler = handler;

  // Background handler (app in background)
  messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('[Notifications] Background notification opened:', remoteMessage);

    const data = (remoteMessage.data as NotificationData) || {};
    const notification = remoteMessage.notification;

    if (backgroundHandler) {
      backgroundHandler(data, notification);
    }
  });

  // Quit handler (app was completely closed)
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[Notifications] Quit notification opened:', remoteMessage);

        const data = (remoteMessage.data as NotificationData) || {};
        const notification = remoteMessage.notification;

        if (backgroundHandler) {
          backgroundHandler(data, notification);
        }
      }
    });
}

/**
 * Set up token refresh handler
 */
export function setTokenRefreshHandler(handler: (token: string) => void) {
  return messaging().onTokenRefresh((token) => {
    console.log('[Notifications] FCM token refreshed');
    handler(token);
  });
}

/**
 * Delete the current FCM token
 */
export async function deleteDeviceToken(): Promise<void> {
  try {
    await messaging().deleteToken();
    console.log('[Notifications] FCM token deleted');
  } catch (error) {
    console.error('[Notifications] Failed to delete FCM token:', error);
  }
}
