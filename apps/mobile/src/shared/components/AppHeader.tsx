import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { IconButton } from '@/shared/components/IconButton';
import { APP_NAME } from '@/shared/constants';

type AppHeaderProps = {
  showBrand?: boolean;
  showActions?: boolean;
  title?: string;
  greeting?: boolean;
  subtitle?: string;
  name?: string;
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AppHeader({
  showBrand = true,
  showActions = true,
  title,
  greeting,
  subtitle,
  name = 'there',
}: AppHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={[styles.wrap, { marginBottom: theme.spacing.sm }]}>
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}>
          {greeting ? (
            <>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                {getGreeting()}, {name}
              </Text>
              <Text style={[theme.typography.hero, { color: theme.colors.textPrimary }]}>
                {subtitle ?? 'Your health & lifestyle\nin one place.'}
              </Text>
            </>
          ) : showBrand ? (
            <View style={styles.brandRow}>
              <View
                style={[
                  styles.logo,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderRadius: theme.radius.md,
                  },
                ]}>
                <View style={[styles.logoDot, { backgroundColor: theme.colors.secondary }]} />
                <View
                  style={[
                    styles.logoDot,
                    { backgroundColor: theme.colors.primary, marginLeft: -6 },
                  ]}
                />
              </View>
              <Text style={[theme.typography.brand, { color: theme.colors.textPrimary }]}>
                {title ?? APP_NAME}
              </Text>
            </View>
          ) : (
            <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
              {title}
            </Text>
          )}
        </View>

        {showActions ? (
          <View style={styles.actions}>
            <IconButton
              name="bell"
              accessibilityLabel="Open notifications"
              glass={false}
            />
            <IconButton
              name="messages"
              accessibilityLabel="Open messages"
              onPress={() => navigation.navigate('Main', { screen: 'Knock' })}
              glass={false}
            />
            <IconButton
              name="profile"
              accessibilityLabel="Open profile"
              onPress={() => navigation.navigate('Profile')}
              color={theme.colors.primary}
              glass={false}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  logoDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
