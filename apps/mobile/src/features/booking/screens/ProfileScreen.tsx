import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { IconBadge } from '@/shared/components/IconBadge';
import { useTheme } from '@/shared/hooks/useTheme';
import { useThemeStore } from '@/shared/store/themeStore';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { softFill } from '@/shared/theme/colors';

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const setMode = useThemeStore(s => s.setMode);
  const mode = useThemeStore(s => s.mode);

  const rows: { label: string; icon: IconName; color: string; onPress: () => void }[] = [
    {
      label: 'My Bookings',
      icon: 'calendar',
      color: theme.colors.health,
      onPress: () => navigation.navigate('MyBookings'),
    },
    {
      label: 'My Orders',
      icon: 'package',
      color: theme.colors.ecommerce,
      onPress: () => navigation.navigate('MyOrders'),
    },
    {
      label: 'My Trips',
      icon: 'globe',
      color: theme.colors.travel,
      onPress: () => navigation.navigate('MyTrips'),
    },
    {
      label: 'My Courses',
      icon: 'graduation-cap',
      color: theme.colors.courses,
      onPress: () => navigation.navigate('MyLearning'),
    },
    {
      label: 'My Service Requests',
      icon: 'home',
      color: theme.colors.homeServices,
      onPress: () => navigation.navigate('MyServiceRequests'),
    },
    {
      label: 'Saved',
      icon: 'save',
      color: theme.colors.primary,
      onPress: () => navigation.navigate('SavedHub'),
    },
    {
      label: 'Messages (Knock)',
      icon: 'messages',
      color: theme.colors.sports,
      onPress: () => navigation.navigate('Main', { screen: 'Knock' }),
    },
    {
      label: 'Communities',
      icon: 'community',
      color: theme.colors.wellness,
      onPress: () => navigation.navigate('Main', { screen: 'Community' }),
    },
    {
      label: `Theme: ${mode}`,
      icon: 'settings',
      color: theme.colors.primary,
      onPress: () => setMode(mode === 'dark' ? 'light' : 'dark'),
    },
  ];

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Card tint={theme.colors.primarySoft} style={styles.hero}>
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.pill,
            },
          ]}>
          <Text style={[theme.typography.title, { color: theme.colors.textInverse }]}>G</Text>
        </View>
        <View style={styles.heroText}>
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
            Guest User
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Chennai · Anticlock member
          </Text>
        </View>
      </Card>

      <View style={styles.list}>
        {rows.map(item => (
          <Card
            key={item.label}
            onPress={item.onPress}
            tint={softFill(item.color, 0.1)}
            style={styles.row}>
            <IconBadge name={item.icon} color={item.color} size="sm" />
            <Text
              style={[
                theme.typography.body,
                {
                  color: theme.colors.textPrimary,
                  flex: 1,
                  fontWeight: '600',
                },
              ]}
              numberOfLines={1}>
              {item.label}
            </Text>
            <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
          </Card>
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 4,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
});
