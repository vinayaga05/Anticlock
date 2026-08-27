import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';
import { AppIcon } from '@/shared/components/AppIcon';
import { knockNotifications } from '@/shared/data/mocks';

export function KnockNotificationsList() {
  const theme = useTheme();

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

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
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
