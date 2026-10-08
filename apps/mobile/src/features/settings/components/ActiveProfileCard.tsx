import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { palette } from '@/shared/theme/colors';
import { ProfileAvatar } from '@/shared/publishing/ProfileAvatar';
import { ProfileTypeBadge } from '@/shared/publishing/ProfileTypeBadge';
import type { PublisherProfileType } from '@/shared/publishing/publisherSelection';

export type ActiveProfileCardData = {
  id: string;
  name: string;
  avatarUrl: string | null;
  type: PublisherProfileType;
  verified: boolean;
  handle?: string | null;
};

/**
 * Large visual card for the active profile: the photo/logo is also used as
 * blurred cover imagery behind it. Tapping anywhere opens the switcher.
 */
export function ActiveProfileCard({
  profile,
  onPress,
}: {
  profile: ActiveProfileCardData;
  onPress: () => void;
}) {
  const theme = useTheme();
  const business = profile.type === 'business';
  return (
    <PressableScale
      testID="active-profile-card"
      accessibilityLabel={`Active profile ${profile.name}, ${business ? 'business' : 'personal'}. Switch profile`}
      onPress={onPress}
      scaleTo={0.985}
      style={[styles.card, { backgroundColor: business ? palette.indigoDeep : palette.gray[900] }]}>
      {profile.avatarUrl ? (
        <Image
          source={{ uri: profile.avatarUrl }}
          blurRadius={28}
          resizeMode="cover"
          style={styles.cover}
          accessibilityIgnoresInvertColors
        />
      ) : null}
      <View style={styles.scrim} />

      <View style={styles.topRow}>
        <ProfileTypeBadge type={profile.type} onMedia />
        <View style={styles.switchPill}>
          <AppIcon name="switch" size={15} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={styles.switchLabel}>Switch</Text>
        </View>
      </View>

      <View style={styles.identity}>
        <ProfileAvatar
          name={profile.name}
          uri={profile.avatarUrl}
          size={76}
          business={business}
          active
          showCheck
          ringColor="#FFFFFF"
          checkColor={theme.colors.primary}
          badgeBorderColor="#FFFFFF"
          style={styles.avatar}
        />
        <View style={styles.copy}>
          <View style={styles.nameLine}>
            <Text testID="active-profile-name" numberOfLines={2} style={styles.name}>
              {profile.name}
            </Text>
            {profile.verified ? (
              <AppIcon name="verified" size={20} color="#FFFFFF" fill={theme.colors.primary} strokeWidth={2} />
            ) : null}
          </View>
          {profile.handle ? (
            <Text numberOfLines={1} style={styles.handle}>{`@${profile.handle}`}</Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    overflow: 'hidden',
    padding: 16,
    minHeight: 186,
    justifyContent: 'space-between',
  },
  cover: { ...FILL, transform: [{ scale: 1.15 }] },
  scrim: { ...FILL, backgroundColor: 'rgba(10, 12, 18, 0.36)' },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  switchLabel: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  avatar: {},
  copy: { flex: 1, minWidth: 0, gap: 3 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.3,
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowRadius: 6,
  },
  handle: { color: 'rgba(255,255,255,0.82)', fontSize: 14, fontWeight: '600' },
});
