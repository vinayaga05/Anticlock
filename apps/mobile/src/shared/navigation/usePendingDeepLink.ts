import { useEffect } from 'react';
import { Linking } from 'react-native';
import { rootNavigationRef } from './rootNavigation';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'deep-link-storage' });
const PENDING_LINK_KEY = 'pending_deep_link';

/**
 * Store a deep link URL when the user is not authenticated.
 * This link will be navigated to after successful login.
 */
export function storePendingDeepLink(url: string): void {
  storage.set(PENDING_LINK_KEY, url);
}

/**
 * Retrieve and clear the pending deep link.
 */
export function consumePendingDeepLink(): string | undefined {
  const url = storage.getString(PENDING_LINK_KEY);
  if (url) {
    storage.remove(PENDING_LINK_KEY);
  }
  return url;
}

/**
 * Clear any pending deep link without consuming it.
 */
export function clearPendingDeepLink(): void {
  storage.remove(PENDING_LINK_KEY);
}

/**
 * Hook to handle pending deep links after authentication.
 * Call this in your authenticated app root to process any
 * stored deep links after login.
 */
export function usePendingDeepLink(isAuthenticated: boolean): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    const openPending = () => {
      if (!rootNavigationRef.isReady()) return;
      const url = consumePendingDeepLink();
      if (url) void Linking.openURL(url).catch(() => storePendingDeepLink(url));
    };
    openPending();
    const unsubscribe = rootNavigationRef.addListener('state', openPending);
    return unsubscribe;
  }, [isAuthenticated]);
}
