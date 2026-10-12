import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';

type CallMode = 'audio' | 'video';

type Props = {
  name: string;
  userId?: string;
  avatarUrl?: string | null;
};

/** Audio and video calls are available for every other user. */
export function UserCallActions({ name, userId, avatarUrl }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const start = (mode: CallMode) => {
    navigation.navigate('Call', {
      mode,
      name,
      userId,
      avatarUrl: avatarUrl ?? null,
    });
  };

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityLabel={`Audio call ${name}`}
        onPress={() => start('audio')}
        hitSlop={6}
        style={[styles.hit, { backgroundColor: theme.colors.surfaceMuted }]}
      >
        <AppIcon name="phone" size={16} color={theme.colors.textPrimary} strokeWidth={2} />
      </PressableScale>
      <PressableScale
        accessibilityLabel={`Video call ${name}`}
        onPress={() => start('video')}
        hitSlop={6}
        style={[styles.hit, { backgroundColor: theme.colors.surfaceMuted }]}
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
