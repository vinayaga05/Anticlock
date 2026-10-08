import { createNavigationContainerRef } from '@react-navigation/native';

/** Navigation ref for code that runs outside screens (push taps). */
export const rootNavigationRef = createNavigationContainerRef<any>();

export type NotificationRoute = {
  screen: string;
  params?: Record<string, unknown>;
};

/**
 * Maps a notification `data` payload (in-app record or FCM data, where every
 * value is a string) to a screen. Unknown payloads return null.
 */
export function routeForNotification(
  data: Record<string, unknown> | null | undefined,
): NotificationRoute | null {
  if (!data) return null;
  const applicationId =
    typeof data.applicationId === 'string' ? data.applicationId : null;
  if (data.kind === 'provider_application' && applicationId) {
    return { screen: 'ProviderApplicationStatus', params: { applicationId } };
  }
  return null;
}

export function navigateFromNotification(
  data: Record<string, unknown> | null | undefined,
) {
  const route = routeForNotification(data);
  if (!route || !rootNavigationRef.isReady()) return false;
  rootNavigationRef.navigate(route.screen, route.params);
  return true;
}
