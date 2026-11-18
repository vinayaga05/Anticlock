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
  // Mutation result objects change on every render; their mutate functions are stable.
  const { mutate: registerToken } = useRegisterDeviceToken();
  const { mutate: unregisterToken } = useUnregisterDeviceToken();
  const currentTokenRef = useRef<string | null>(null);
  const hasRequestedPermissionRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up when user logs out
      if (currentTokenRef.current) {
        unregisterToken(currentTokenRef.current);
        deleteDeviceToken();
        currentTokenRef.current = null;
      }
      hasRequestedPermissionRef.current = false;
      return;
    }

    // User is authenticated, set up notifications
    let cancelled = false;
    let unsubscribeForeground: (() => void) | undefined;
    let unsubscribeBackground: (() => void) | undefined;
    let unsubscribeTokenRefresh: (() => void) | undefined;
    let navigationRetry: ReturnType<typeof setTimeout> | undefined;
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (!cancelled && state === 'active') {
        void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    });

    const setupNotifications = async () => {
      // Request permission if not already requested
      if (!hasRequestedPermissionRef.current) {
        const granted = await requestNotificationPermission();
        if (cancelled) return;
        hasRequestedPermissionRef.current = true;

        if (!granted) {
          console.log('[Notifications] Permission denied, skipping setup');
          return;
        }
      }

      // Get and register device token
      const token = await getDeviceToken();
      if (cancelled) return;
      if (token) {
        currentTokenRef.current = token;
        registerToken({
          token,
          platform: Platform.OS as 'android' | 'ios',
        });
      }

      // Set up foreground handler
      unsubscribeForeground = setForegroundNotificationHandler(
        (data, notification) => {
          if (cancelled) return;
          console.log('[Notifications] Foreground:', notification?.title, data);
          // Keep the in-app list and any open application status fresh.
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          if (
            (data as Record<string, unknown>)?.kind === 'provider_application'
          ) {
            void queryClient.invalidateQueries({ queryKey: ['provider'] });
          }
          if ((data as Record<string, unknown>)?.kind === 'booking') {
            void queryClient.invalidateQueries({ queryKey: ['bookings'] });
            void queryClient.invalidateQueries({
              queryKey: ['provider', 'business'],
            });
          }
          // TODO: Show in-app notification banner or update badge
        },
      );

      // Set up background/quit handler
      unsubscribeBackground = setBackgroundNotificationHandler(
        (data, notification) => {
          if (cancelled) return;
          console.log(
            '[Notifications] Background/quit tap:',
            notification?.title,
            data,
          );
          // Cold start: the navigator may not be mounted yet, so retry briefly.
          let attempts = 0;
          const tryNavigate = () => {
            if (cancelled) return;
            if (
              navigateFromNotification(data as Record<string, unknown>) ||
              attempts >= 10
            )
              return;
            attempts += 1;
            navigationRetry = setTimeout(tryNavigate, 300);
          };
          tryNavigate();
        },
      );

      // Set up token refresh handler
      unsubscribeTokenRefresh = setTokenRefreshHandler(newToken => {
        if (cancelled) return;
        currentTokenRef.current = newToken;
        registerToken({
          token: newToken,
          platform: Platform.OS as 'android' | 'ios',
        });
      });
    };

    setupNotifications();

    return () => {
      cancelled = true;
      unsubscribeForeground?.();
      unsubscribeBackground?.();
      unsubscribeTokenRefresh?.();
      if (navigationRetry) clearTimeout(navigationRetry);
      appStateSubscription.remove();
    };
  }, [isAuthenticated, queryClient, registerToken, unregisterToken]);

  return null;
}
