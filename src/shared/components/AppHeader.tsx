import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { APP_NAME } from '@/shared/constants';
import {
  HeartIcon,
  ProfileIcon,
  SettingsIcon,
  ShareIcon,
} from '@/shared/components/Icons';

type AppHeaderProps = {
  showBrand?: boolean;
  showActions?: boolean;
  title?: string;
};

function formatNow() {
  const d = new Date();
  const time = d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const day = d.toLocaleDateString('en-IN', { weekday: 'long' });
  const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
  return `${time}  ${day}  ${date}`;
}

export function AppHeader({
  showBrand = true,
  showActions = true,
  title,
}: AppHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {showBrand ? (
          <View style={styles.brandRow}>
            <View style={styles.logoPair}>
              <View style={[styles.logoDot, { backgroundColor: '#E91E8C' }]} />
              <View style={[styles.logoDot, { backgroundColor: theme.colors.primary, marginLeft: -6 }]} />
            </View>
            <Text style={[styles.brand, { color: theme.colors.textPrimary }]}>
              {title ?? APP_NAME}
            </Text>
          </View>
        ) : (
          <Text style={[styles.brand, { color: theme.colors.textPrimary }]}>
            {title}
          </Text>
        )}
        <Text style={[styles.clock, { color: theme.colors.yellow }]} numberOfLines={1}>
          {formatNow()}
        </Text>
      </View>

      {showActions ? (
        <View style={styles.actions}>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('Profile')}
            style={styles.iconBtn}>
            <SettingsIcon color={theme.colors.textPrimary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.iconBtn}>
            <HeartIcon color={theme.colors.textPrimary} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('Inbox')}
            style={styles.iconBtn}>
            <ShareIcon color={theme.colors.textPrimary} size={22} />
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => navigation.navigate('Profile')}
            style={[styles.profileBtn, { backgroundColor: theme.colors.yellow }]}>
            <ProfileIcon size={18} color="#111" filled />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  logoPair: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    fontStyle: 'italic',
  },
  clock: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 14,
  },
  iconBtn: {
    padding: 2,
  },
  profileBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
