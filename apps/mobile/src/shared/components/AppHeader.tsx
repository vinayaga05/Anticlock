import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { BrandLogo } from '@/shared/components/BrandLogo';
import { IconButton } from '@/shared/components/IconButton';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { APP_NAME } from '@/shared/constants';
import { useAuth } from '@/shared/context/AuthProvider';

type AppHeaderProps = {
  showBrand?: boolean;
  showActions?: boolean;
  showNotificationsAction?: boolean;
  showMessagesAction?: boolean;
  showSettingsAction?: boolean;
  title?: string;
  greeting?: boolean;
  subtitle?: string;
  name?: string;
  onNotificationsPress?: () => void;
  onMessagesPress?: () => void;
  onSettingsPress?: () => void;
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
  showNotificationsAction = true,
  showMessagesAction = true,
  showSettingsAction = true,
  title,
  greeting,
  subtitle,
  name = 'there',
  onNotificationsPress,
  onMessagesPress,
  onSettingsPress,
}: AppHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const openNotifications =
    onNotificationsPress ??
    (() =>
      navigation.navigate('Main', {
        screen: 'Knock',
        params: { initialTab: 'notifications' },
      }));

  const openMessages =
    onMessagesPress ??
    (() =>
      navigation.navigate('Main', {
        screen: 'Knock',
        params: { initialTab: 'chat' },
      }));

  const openSettings =
    onSettingsPress ?? (() => navigation.navigate('AccountSettings'));

  return (
    <View style={[styles.wrap, { marginBottom: theme.spacing.sm }]}>
      <View style={styles.row}>
        <View style={styles.lead}>
          {greeting ? (
            <>
              <BrandLogo height={36} />
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                {getGreeting()}, {name}
              </Text>
              <Text style={[theme.typography.hero, { color: theme.colors.textPrimary }]}>
                {subtitle ?? 'Your health & lifestyle\nin one place.'}
              </Text>
            </>
          ) : showBrand ? (
            <BrandLogo height={40} showName name={title ?? APP_NAME} />
          ) : (
            <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
              {title}
            </Text>
          )}
        </View>

        {showActions ? (
          <View style={styles.actions}>
            <PressableScale
              onPress={() => navigation.navigate('Profile')}
              accessibilityLabel="Open profile"
              style={[styles.profileButton, { borderColor: theme.colors.primary }]}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileFallback, { backgroundColor: theme.colors.surfaceMuted }]}>
                  <AppIcon name="profile" size={19} color={theme.colors.primary} />
                </View>
              )}
            </PressableScale>
            {showNotificationsAction ? (
              <IconButton
                name="bell"
                accessibilityLabel="Open notifications"
                onPress={openNotifications}
                glass={false}
              />
            ) : null}
            {showMessagesAction ? (
              <IconButton
                name="messages"
                accessibilityLabel="Open messages"
                onPress={openMessages}
                glass={false}
              />
            ) : null}
            {showSettingsAction ? (
              <IconButton
                name="settings"
                accessibilityLabel="Open app settings"
                onPress={openSettings}
                glass={false}
              />
            ) : null}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  lead: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 40,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    padding: 2,
    borderWidth: 2,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
  },
  profileFallback: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
