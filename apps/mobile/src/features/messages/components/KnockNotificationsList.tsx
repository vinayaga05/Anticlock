import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';
import { knockNotifications } from '@/shared/data/mocks';
import {
  useNotifications,
  useMarkNotificationRead,
} from '@/shared/api/notificationHooks';
import { isApiEnabled } from '@/shared/api/config';
import type { Notification } from '@/shared/api/notificationHooks';

function getIconForType(type: string): string {
  switch (type) {
    case 'booking_confirmed':
    case 'booking_reminder':
      return 'calendar';
    case 'booking_cancelled':
      return 'calendar-x';
    case 'provider_assigned':
      return 'home';
    case 'status_update':
      return 'bell';
    case 'new_message':
      return 'message-circle';
    case 'community_post_comment':
    case 'community_post_like':
      return 'heart';
    case 'order_confirmed':
    case 'order_shipped':
    case 'order_delivered':
      return 'shopping-bag';
    case 'system':
      return 'info';
    default:
      return 'bell';
  }
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function KnockNotificationsList() {
  const theme = useTheme();
  const apiEnabled = isApiEnabled();
  const { data, isLoading, error } = useNotifications();
  const markRead = useMarkNotificationRead();

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.readAt) {
      markRead.mutate(notification.id);
    }
    // TODO: Navigate based on notification.data
  };

  // Use mock data when API is disabled
  if (!apiEnabled) {
    return (
      <View style={styles.wrap}>
        {knockNotifications.map(item => (
          <PressableScale key={item.id} style={styles.row}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}>
              <AppIcon name={item.icon} size={20} color={theme.colors.textPrimary} strokeWidth={1.75} />
            </View>
            <View style={styles.body}>
              <View style={styles.top}>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.textPrimary,
                      fontWeight: item.read ? '500' : '700',
                    },
                  ]}
                  numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={[styles.time, { color: theme.colors.textTertiary }]}>
                  {item.time}
                </Text>
              </View>
              <Text
                style={[styles.bodyText, { color: theme.colors.textSecondary }]}
                numberOfLines={2}>
                {item.body}
              </Text>
            </View>
            {!item.read ? (
              <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
            ) : null}
          </PressableScale>
        ))}
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.wrap, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.wrap, styles.centerContent]}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          Failed to load notifications
        </Text>
      </View>
    );
  }

  if (!data || data.notifications.length === 0) {
    return (
      <View style={[styles.wrap, styles.centerContent]}>
        <AppIcon
          name="bell-off"
          size={48}
          color={theme.colors.textTertiary}
          strokeWidth={1.5}
        />
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          No notifications yet
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {data.notifications.map(notification => (
        <PressableScale
          key={notification.id}
          style={styles.row}
          onPress={() => handleNotificationPress(notification)}>
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}>
            <AppIcon
              name={getIconForType(notification.type)}
              size={20}
              color={theme.colors.textPrimary}
              strokeWidth={1.75}
            />
          </View>
          <View style={styles.body}>
            <View style={styles.top}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.colors.textPrimary,
                    fontWeight: notification.readAt ? '500' : '700',
                  },
                ]}
                numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={[styles.time, { color: theme.colors.textTertiary }]}>
                {formatTimestamp(notification.createdAt)}
              </Text>
            </View>
            <Text
              style={[styles.bodyText, { color: theme.colors.textSecondary }]}
              numberOfLines={2}>
              {notification.body}
            </Text>
          </View>
          {!notification.readAt ? (
            <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
          ) : null}
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 15,
  },
  time: {
    fontSize: 12,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
});
