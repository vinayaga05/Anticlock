import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { ReactionType } from '@/shared/data/flash/types';
import { REACTION_META } from '@/features/flash/components/ReactionPicker';

type Props = {
  viewerReaction?: ReactionType | null;
  saved?: boolean;
  onLikePress: () => void;
  onLikeLongPress: () => void;
  onComment: () => void;
  onShare: () => void;
  onSave: () => void;
};

export function FlashActionRow({
  viewerReaction,
  saved,
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
    <View style={styles.wrap}>
      <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
      <View style={styles.row}>
        <PressableScale
          onPress={onLikePress}
          onLongPress={onLikeLongPress}
          delayLongPress={280}
          accessibilityLabel={likeLabel}
          scaleTo={0.96}
          style={styles.item}>
          <AppIcon
            name={reaction?.icon ?? 'heart'}
            size={22}
            color={likeColor}
            strokeWidth={1.75}
            fill={likeActive ? likeColor : 'none'}
          />
          <Text style={[styles.label, { color: likeColor }]} numberOfLines={1}>
            {likeLabel}
          </Text>
        </PressableScale>

        <PressableScale
          onPress={onComment}
          accessibilityLabel="Comment"
          scaleTo={0.96}
          style={styles.item}>
          <AppIcon name="comment" size={22} color={muted} strokeWidth={1.75} />
          <Text style={[styles.label, { color: muted }]} numberOfLines={1}>
            Comment
          </Text>
        </PressableScale>

        <PressableScale
          onPress={onShare}
          accessibilityLabel="Share"
          scaleTo={0.96}
          style={styles.item}>
          <AppIcon name="share" size={22} color={muted} strokeWidth={1.75} />
          <Text style={[styles.label, { color: muted }]} numberOfLines={1}>
            Share
          </Text>
        </PressableScale>

        <PressableScale
          onPress={onSave}
          accessibilityLabel="Save"
          scaleTo={0.96}
          style={styles.item}>
          <AppIcon
            name="save"
            size={22}
            color={saved ? theme.colors.primary : muted}
            strokeWidth={1.75}
            fill={saved ? theme.colors.primary : 'none'}
          />
          <Text
            style={[styles.label, { color: saved ? theme.colors.primary : muted }]}
            numberOfLines={1}>
            Save
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
  },
  item: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 48,
    paddingVertical: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
