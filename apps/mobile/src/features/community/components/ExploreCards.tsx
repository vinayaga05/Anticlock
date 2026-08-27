import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import {
  ExploreEventItem,
  ExploreProductItem,
  reviewStatusLabel,
  visibilityLabel,
} from '@/shared/data/explore';
import { useCommunityStore } from '@/shared/data/community';

function TypeBadge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

function StatusChips({
  item,
}: {
  item: ExploreEventItem | ExploreProductItem;
}) {
  const theme = useTheme();
  const { reviewStatus, visibility } = item.meta;
  if (reviewStatus === 'approved' && visibility === 'public') return null;

  const tone =
    reviewStatus === 'needs_changes' || reviewStatus === 'rejected_policy'
      ? theme.colors.warning
      : theme.colors.primary;

  return (
    <View style={styles.statusRow}>
      <View style={[styles.chip, { backgroundColor: `${tone}22` }]}>
        <Text style={[styles.chipText, { color: tone }]}>
          {reviewStatusLabel(reviewStatus)}
        </Text>
      </View>
      <View style={[styles.chip, { backgroundColor: theme.colors.surfaceMuted }]}>
        <Text style={[styles.chipText, { color: theme.colors.textSecondary }]}>
          {visibilityLabel(visibility)}
        </Text>
      </View>
    </View>
  );
}

export function ExploreEventCard({
  item,
  onPress,
  compact,
}: {
  item: ExploreEventItem;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const challenge = useCommunityStore(s => s.getChallengeForEvent(item.id));

  return (
    <Card
      onPress={onPress}
      padded={false}
      elevated
      style={compact ? styles.compact : undefined}>
      <View>
        <Image
          source={{ uri: item.imageUrl }}
          style={compact ? styles.compactImage : styles.image}
        />
        <TypeBadge label="EVENT" color="rgba(15,118,110,0.92)" />
      </View>
      <View style={styles.body}>
        <Text
          style={[theme.typography.section, { color: theme.colors.textPrimary }]}
          numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
          {item.dateLabel}
          {item.timeLabel ? ` · ${item.timeLabel}` : ''}
        </Text>
        <View style={styles.row}>
          <AppIcon name="map-pin" size={13} color={theme.colors.primary} />
          <Text
            style={[theme.typography.caption, { color: theme.colors.textSecondary, flex: 1 }]}
            numberOfLines={1}>
            {item.location}
            {item.distanceKm != null ? ` · ${item.distanceKm} km` : ''}
          </Text>
        </View>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.primary, fontWeight: '700' },
          ]}>
          {item.price === 0 ? 'Free' : `₹${item.price}`}
          {item.spotsLeft > 0 ? ` · ${item.spotsLeft} spots left` : ''}
        </Text>
        {challenge ? (
          <PressableScale
            onPress={() =>
              navigation.navigate('ChallengeDetail', { challengeId: challenge.id })
            }
            accessibilityLabel={`Part of ${challenge.title}`}>
            <View style={[styles.challengeBadge, { backgroundColor: theme.colors.primarySoft }]}>
              <AppIcon name="zap" size={12} color={theme.colors.primary} />
              <Text
                style={[styles.challengeBadgeText, { color: theme.colors.primary }]}
                numberOfLines={1}>
                Part of: {challenge.title}
              </Text>
            </View>
          </PressableScale>
        ) : null}
        <StatusChips item={item} />
      </View>
    </Card>
  );
}

export function ExploreProductCard({
  item,
  onPress,
  compact,
}: {
  item: ExploreProductItem;
  onPress?: () => void;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <Card
      onPress={onPress}
      padded={false}
      elevated
      style={compact ? styles.compact : undefined}>
      <View>
        <Image
          source={{ uri: item.imageUrl }}
          style={compact ? styles.compactImage : styles.image}
        />
        <TypeBadge label="PRODUCT" color="rgba(180,83,9,0.92)" />
      </View>
      <View style={styles.body}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {item.seller}
        </Text>
        <View style={styles.row}>
          <AppIcon name="star" size={12} color={theme.colors.warning} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {item.rating > 0 ? `${item.rating} · ${item.reviewCount} reviews` : 'New'}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.primary, fontWeight: '700', flex: 1 },
            ]}>
            ₹{item.price}
          </Text>
          <AppIcon name="heart" size={16} color={theme.colors.like} />
        </View>
        <StatusChips item={item} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 140, backgroundColor: '#EEE' },
  compactImage: { width: '100%', height: 120, backgroundColor: '#EEE' },
  compact: { width: 220 },
  body: { padding: 12, gap: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  chipText: { fontSize: 10, fontWeight: '700' },
  challengeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: '100%',
  },
  challengeBadgeText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
});
