import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import type {
  Notification,
  NotificationListResponse,
  Platform,
} from '@anticlock/contracts';
import { readStoredSession } from '@/shared/services/auth/authService';

export type { Notification };

export function useNotifications(options?: { unreadOnly?: boolean }) {
  const canFetch = isApiEnabled && Boolean(readStoredSession()?.token);
  return useInfiniteQuery({
    queryKey: ['notifications', options?.unreadOnly ? 'unread' : 'all'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('limit', '30');
      if (pageParam) params.set('cursor', pageParam);
      if (options?.unreadOnly) {
        params.set('unreadOnly', 'true');
      }

      const response = await apiRequest<NotificationListResponse>(
        `/v1/notifications?${params.toString()}`
      );
      return response;
    },
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: canFetch,
    staleTime: 30_000,
  });
}

export function useUnreadCount() {
  const canFetch = isApiEnabled && Boolean(readStoredSession()?.token);
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return { unreadCount: 0 };
      }

      const response = await apiRequest<{ unreadCount: number }>(
        '/v1/notifications/unread-count'
      );
      return response;
    },
    enabled: canFetch,
    staleTime: 30000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!isApiEnabled) {
        return { success: true };
      }

      await apiRequest(`/v1/notifications/${notificationId}/read`, {
        method: 'POST',
      });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!isApiEnabled) {
        return { count: 0 };
      }

      const response = await apiRequest<{ count: number }>(
        '/v1/notifications/read-all',
        {
          method: 'POST',
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!isApiEnabled) {
        return { success: true };
      }

      await apiRequest(`/v1/notifications/${notificationId}`, {
        method: 'DELETE',
      });
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: async (params: { token: string; platform: Platform }) => {
      if (!isApiEnabled) {
        console.log('[Notifications] Would register device token (API disabled):', params);
        return { success: true };
      }

      await apiRequest('/v1/devices', {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return { success: true };
    },
  });
}

export function useUnregisterDeviceToken() {
  return useMutation({
    mutationFn: async (token: string) => {
      if (!isApiEnabled) {
        console.log('[Notifications] Would unregister device token (API disabled):', token);
        return { success: true };
      }

      await apiRequest('/v1/devices', {
        method: 'DELETE',
        body: JSON.stringify({ token }),
      });
      return { success: true };
    },
  });
}
