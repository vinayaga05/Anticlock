import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType, type PublisherProfileType } from '@/shared/publishing/publisherSelection';

type CallMode = 'audio' | 'video';

type Props = {
  name: string;
  profileId?: string;
  profileType?: PublisherProfileType;
  avatarUrl?: string | null;
};

/** Audio and video calls are available for every other user. */
export function UserCallActions({ name, profileId, profileType, avatarUrl }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { active } = useActiveProfile();
  const disabled = !profileId || !profileType || !active;

  const start = (mode: CallMode) => {
    if (disabled) return;
    navigation.navigate('Call', {
      mode,
      name,
      avatarUrl: avatarUrl ?? null,
      targetProfile: { id: profileId, type: profileType },
      viewerProfile: { id: active.id, type: identityProfileType(active) },
    });
  };

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityLabel={`Audio call ${name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => start('audio')}
        hitSlop={6}
        style={[styles.hit, { backgroundColor: theme.colors.surfaceMuted, opacity: disabled ? 0.45 : 1 }]}
      >
        <AppIcon name="phone" size={16} color={theme.colors.textPrimary} strokeWidth={2} />
      </PressableScale>
      <PressableScale
        accessibilityLabel={`Video call ${name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => start('video')}
        hitSlop={6}
        style={[styles.hit, { backgroundColor: theme.colors.surfaceMuted, opacity: disabled ? 0.45 : 1 }]}
      >
        <AppIcon name="video" size={16} color={theme.colors.textPrimary} strokeWidth={2} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
