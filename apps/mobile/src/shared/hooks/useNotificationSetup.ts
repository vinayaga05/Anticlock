import { useEffect, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import {
  requestNotificationPermission,
  getDeviceToken,
  setForegroundNotificationHandler,
  setBackgroundNotificationHandler,
  setTokenRefreshHandler,
  deleteDeviceToken,
} from '../services/notificationService';
import {
  useRegisterDeviceToken,
  useUnregisterDeviceToken,
} from '../api/notificationHooks';
import { isApiEnabled } from '../api/config';

/**
 * Hook to set up push notifications for authenticated users.
 * Call this from your app root after user is logged in.
 */
export function useNotificationSetup(isAuthenticated: boolean) {
  const registerToken = useRegisterDeviceToken();
  const unregisterToken = useUnregisterDeviceToken();
  const currentTokenRef = useRef<string | null>(null);
  const hasRequestedPermissionRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up when user logs out
      if (currentTokenRef.current) {
        unregisterToken.mutate(currentTokenRef.current);
        deleteDeviceToken();
        currentTokenRef.current = null;
      }
      hasRequestedPermissionRef.current = false;
      return;
    }

    // User is authenticated, set up notifications
    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;

    const setupNotifications = async () => {
      // Request permission if not already requested
      if (!hasRequestedPermissionRef.current) {
        const granted = await requestNotificationPermission();
        hasRequestedPermissionRef.current = true;

        if (!granted) {
          console.log('[Notifications] Permission denied, skipping setup');
          return;
        }
      }

      // Get and register device token
      const token = await getDeviceToken();
      if (token) {
        currentTokenRef.current = token;
        registerToken.mutate({
          token,
          platform: Platform.OS as 'android' | 'ios',
        });
      }

      // Set up foreground handler
      unsubscribeForeground = setForegroundNotificationHandler((data, notification) => {
        console.log('[Notifications] Foreground:', notification?.title, data);
        // TODO: Show in-app notification banner or update badge
      });

      // Set up background/quit handler
      setBackgroundNotificationHandler((data, notification) => {
        console.log('[Notifications] Background/quit tap:', notification?.title, data);
        // TODO: Navigate to appropriate screen based on data.type and other fields
        // This could be handled by RootNavigator using a deep link approach
      });

      // Set up token refresh handler
      unsubscribeTokenRefresh = setTokenRefreshHandler((newToken) => {
        currentTokenRef.current = newToken;
        registerToken.mutate({
          token: newToken,
          platform: Platform.OS as 'android' | 'ios',
        });
      });
    };

    setupNotifications();

    return () => {
      unsubscribeForeground?.();
      unsubscribeTokenRefresh?.();
    };
  }, [isAuthenticated, registerToken, unregisterToken]);

  return null;
}
