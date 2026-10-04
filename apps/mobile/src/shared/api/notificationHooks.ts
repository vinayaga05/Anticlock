import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, ApiError } from './client';
import { isApiEnabled } from './config';
import type {
  Notification,
  NotificationListResponse,
  Platform,
} from '@anticlock/contracts';

export type { Notification };

export function useNotifications(options?: { unreadOnly?: boolean }) {
  return useQuery({
    queryKey: ['notifications', options?.unreadOnly ? 'unread' : 'all'],
    queryFn: async () => {
      if (!isApiEnabled) {
        // Return mock data when API is disabled
        return {
          notifications: [],
          nextCursor: null,
          unreadCount: 0,
        };
      }

      const params = new URLSearchParams();
      params.set('limit', '50');
      if (options?.unreadOnly) {
        params.set('unreadOnly', 'true');
      }

      const response = await apiRequest<NotificationListResponse>(
        `/v1/notifications?${params.toString()}`
      );
      return response;
    },
    enabled: isApiEnabled(),
    staleTime: 30000, // 30 seconds
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      if (!isApiEnabled()) {
        return { unreadCount: 0 };
      }

      const response = await apiRequest<{ unreadCount: number }>(
        '/v1/notifications/unread-count'
      );
      return response;
    },
    enabled: isApiEnabled(),
    staleTime: 30000,
    refetchInterval: 60000, // Poll every minute for unread count
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: string) => {
      if (!isApiEnabled()) {
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
      if (!isApiEnabled()) {
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
      if (!isApiEnabled()) {
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
      if (!isApiEnabled()) {
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
      if (!isApiEnabled()) {
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
