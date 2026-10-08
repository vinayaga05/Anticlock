import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/shared/components/Card';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import type { PublishingIdentity } from '@/shared/api/publishingHooks';
import { identityProfileType, postingAsLabel } from './publisherSelection';

export { postingAsLabel };

export function profileKindLabel(identity: PublishingIdentity) {
  const type = identityProfileType(identity);
  if (type === 'personal') return 'Personal profile';
  const category = identity.publisher?.businessCategory;
  return category ? `Business profile · ${category}` : 'Business profile';
}

type PostingAsCardProps = {
  identities: PublishingIdentity[];
  identity: PublishingIdentity | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  /** Persisted profile is no longer available; tell the creator. */
  fallbackApplied?: boolean;
  disabled?: boolean;
};

/**
 * "Posting as [profile]" with avatar, plus a switcher when the owner
 * manages more than one profile. Shown in the Reel publish screen, the
 * Flash composer and the Story composer.
 */
export function PostingAsCard({
  identities,
  identity,
  onSelect,
  isLoading,
  fallbackApplied,
  disabled,
}: PostingAsCardProps) {
  const theme = useTheme();
  const avatarUrl = identity?.publisher?.avatarUrl ?? identity?.avatarUrl;
  return (
    <Card style={styles.card}>
      <View style={styles.row} accessibilityRole="summary">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View
            style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[theme.typography.section, { color: theme.colors.primary }]}>
              {identity?.name?.trim().charAt(0).toUpperCase() ?? ''}
            </Text>
          </View>
        )}
        <View style={styles.copy}>
          <Text
            testID="posting-as-label"
            numberOfLines={1}
            style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {postingAsLabel(identity)}
          </Text>
          {identity ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {profileKindLabel(identity)}
            </Text>
          ) : null}
        </View>
      </View>
      {fallbackApplied ? (
        <Text style={[theme.typography.caption, { color: theme.colors.warning }]}>
          Your previous profile is no longer available. Choose who to post as.
        </Text>
      ) : null}
      {identities.length > 1 ? (
        <View style={styles.switcher} pointerEvents={disabled ? 'none' : 'auto'}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Switch profile
          </Text>
          <FilterPills
            activeId={identity?.id ?? ''}
            onChange={onSelect}
            pills={identities.map(item => ({
              id: item.id,
              label:
                identityProfileType(item) === 'personal'
                  ? `${item.name} (Personal)`
                  : item.name,
            }))}
          />
        </View>
      ) : isLoading ? (
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          Loading publishing profiles…
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  switcher: { gap: 6 },
});
