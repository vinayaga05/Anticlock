import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { getStoryAuthorName } from '@/shared/data/flash/storyStore';
import type { StoryTrayEntry } from '@/shared/data/flash/storyTypes';

const RING = 72;
const AVATAR = 64;

type Props = {
  entry: StoryTrayEntry;
  onPress: () => void;
  onAddPress?: () => void;
};

export function StoryRing({ entry, onPress, onAddPress }: Props) {
  const theme = useTheme();
  const gradientId = `storyRing-${entry.authorId}`;
  const label = entry.isOwn ? 'Your Story' : getStoryAuthorName(entry.author);
  const showGradient = entry.hasActiveStory && (entry.isOwn || entry.hasUnread);
  const ringColor = entry.hasActiveStory && !entry.hasUnread && !entry.isOwn
    ? theme.colors.border
    : undefined;

  return (
    <PressableScale
      onPress={onPress}
      accessibilityLabel={entry.isOwn ? 'Your story' : `${label} story`}
      style={styles.wrap}>
      <View style={styles.ringOuter}>
        {showGradient ? (
          <Svg width={RING} height={RING} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#14B8A6" />
                <Stop offset="0.45" stopColor="#2DD4BF" />
                <Stop offset="1" stopColor="#5EEAD4" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width={RING} height={RING} rx={RING / 2} fill={`url(#${gradientId})`} />
          </Svg>
        ) : (
          <View
            style={[
              styles.mutedRing,
              {
                borderColor: entry.isOwn && !entry.hasActiveStory
                  ? theme.colors.border
                  : ringColor ?? theme.colors.borderSoft,
              },
            ]}
          />
        )}
        <View style={[styles.avatarWrap, { backgroundColor: theme.colors.background }]}>
          <Image source={{ uri: entry.author.avatarUrl }} style={styles.avatar} />
        </View>
        {entry.isOwn ? (
          <PressableScale
            onPress={onAddPress ?? onPress}
            accessibilityLabel="Add story"
            style={[styles.addBadge, { backgroundColor: theme.colors.primary }]}>
            <AppIcon name="plus" size={14} color="#042F2E" strokeWidth={2.5} />
          </PressableScale>
        ) : null}
      </View>
      <Text
        style={[styles.label, { color: theme.colors.textSecondary }]}
        numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING + 4,
    alignItems: 'center',
    gap: 6,
  },
  ringOuter: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedRing: {
    ...StyleSheet.absoluteFill,
    borderRadius: RING / 2,
    borderWidth: 2.5,
  },
  avatarWrap: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    overflow: 'hidden',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  addBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: RING + 8,
    textAlign: 'center',
  },
});
