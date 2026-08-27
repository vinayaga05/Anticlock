import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { ReactionType } from '@/shared/data/flash/types';
import { REACTION_META } from '@/features/flash/components/ReactionPicker';

const CONTENT_PAD = 12;

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

type Props = {
  viewerReaction?: ReactionType | null;
  saved?: boolean;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  onLikePress: () => void;
  onLikeLongPress: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
};

export function FlashActionRow({
  viewerReaction,
  saved,
  likeCount,
  commentCount,
  shareCount,
  onLikePress,
  onLikeLongPress,
  onComment,
  onShare,
  onSave,
}: Props) {
  const theme = useTheme();
  const reaction = REACTION_META.find(r => r.id === viewerReaction);
  const likeLabel = reaction?.label ?? 'Like';
  const likeActive = !!viewerReaction;
  const likeColor = likeActive
    ? reaction?.color ?? theme.colors.like
    : theme.colors.textSecondary;
  const muted = theme.colors.textSecondary;

  return (
    <View style={[styles.wrap, { paddingHorizontal: CONTENT_PAD }]}>
      <View style={styles.row}>
        <View style={styles.leftGroup}>
          <PressableScale
            onPress={onLikePress}
            onLongPress={onLikeLongPress}
            delayLongPress={280}
            accessibilityLabel={`${likeLabel}, ${formatCount(likeCount)} reactions`}
            scaleTo={0.96}
            style={styles.item}>
            <AppIcon
              name={reaction?.icon ?? 'heart'}
              size={20}
              color={likeColor}
              strokeWidth={1.75}
              fill={likeActive ? likeColor : 'none'}
            />
            <Text style={[styles.count, { color: likeColor }]} numberOfLines={1}>
              {formatCount(likeCount)}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={onComment}
            accessibilityLabel={`Comment, ${formatCount(commentCount)} comments`}
            scaleTo={0.96}
            style={styles.item}>
            <AppIcon name="comment" size={20} color={muted} strokeWidth={1.75} />
            <Text style={[styles.count, { color: muted }]} numberOfLines={1}>
              {formatCount(commentCount)}
            </Text>
          </PressableScale>

          <PressableScale
            onPress={onShare}
            accessibilityLabel={`Share, ${formatCount(shareCount)} shares`}
            scaleTo={0.96}
            style={styles.item}>
            <AppIcon name="share" size={20} color={muted} strokeWidth={1.75} />
            <Text style={[styles.count, { color: muted }]} numberOfLines={1}>
              {formatCount(shareCount)}
            </Text>
          </PressableScale>
        </View>

        <PressableScale
          onPress={onSave}
          accessibilityLabel="Save"
          scaleTo={0.96}
          style={styles.saveHit}>
          <AppIcon
            name="save"
            size={20}
            color={saved ? theme.colors.primary : muted}
            strokeWidth={1.75}
            fill={saved ? theme.colors.primary : 'none'}
          />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    flexShrink: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingVertical: 4,
  },
  saveHit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
    minWidth: 36,
    padding: 4,
  },
  count: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
