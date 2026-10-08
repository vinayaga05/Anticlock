import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { navigateFromNotification } from '@/shared/navigation/rootNavigation';
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

/**
 * Hook to set up push notifications for authenticated users.
 * Call this from your app root after user is logged in.
 */
export function useNotificationSetup(isAuthenticated: boolean) {
  const queryClient = useQueryClient();
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
        // Keep the in-app list and any open application status fresh.
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
        if ((data as Record<string, unknown>)?.kind === 'provider_application') {
          void queryClient.invalidateQueries({ queryKey: ['provider'] });
        }
        // TODO: Show in-app notification banner or update badge
      });

      // Set up background/quit handler
      setBackgroundNotificationHandler((data, notification) => {
        console.log('[Notifications] Background/quit tap:', notification?.title, data);
        // Cold start: the navigator may not be mounted yet, so retry briefly.
        let attempts = 0;
        const tryNavigate = () => {
          if (navigateFromNotification(data as Record<string, unknown>) || attempts >= 10) return;
          attempts += 1;
          setTimeout(tryNavigate, 300);
        };
        tryNavigate();
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
  }, [isAuthenticated, queryClient, registerToken, unregisterToken]);

  return null;
}
