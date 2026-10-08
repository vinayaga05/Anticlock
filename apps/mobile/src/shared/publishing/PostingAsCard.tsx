import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import type { PublishingIdentity } from '@/shared/api/publishingHooks';
import { identityProfileType, postingAsLabel } from './publisherSelection';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileTypeBadge } from './ProfileTypeBadge';
import { ProfileSwitcherSheet, identityAvatarUrl } from './ProfileSwitcherSheet';

export { postingAsLabel };

type PostingAsCardProps = {
  identities: PublishingIdentity[];
  identity: PublishingIdentity | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
  /** Draft's profile is no longer available; tell the creator. */
  fallbackApplied?: boolean;
  /** Locked while uploading/publishing (never switch mid-publish). */
  disabled?: boolean;
};

/**
 * Compact "posting as" row: avatar/logo + name + type badge, preselected
 * from the global active profile. With several owned profiles a Switch
 * button opens the visual profile sheet (choice applies to this draft).
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
  const [open, setOpen] = useState(false);
  const business = identity ? identityProfileType(identity) === 'business' : false;
  const canSwitch = identities.length > 1;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}>
      <View
        style={styles.row}
        accessible
        accessibilityLabel={identity ? postingAsLabel(identity) : 'Loading profile'}>
        {identity ? (
          <ProfileAvatar
            name={identity.name}
            uri={identityAvatarUrl(identity)}
            size={40}
            business={business}
            active={business}
            ringColor={theme.colors.primary}
          />
        ) : (
          <View style={[styles.skeleton, { backgroundColor: theme.colors.skeleton }]} />
        )}
        <View style={styles.copy}>
          <View style={styles.nameLine}>
            <Text
              testID="posting-as-name"
              numberOfLines={1}
              style={[styles.name, { color: theme.colors.textPrimary }]}>
              {identity?.name ?? (isLoading ? '' : 'Profile unavailable')}
            </Text>
            {identity?.publisher?.verified ? (
              <AppIcon name="verified" size={15} color={theme.colors.primary} strokeWidth={2.25} />
            ) : null}
          </View>
          {identity ? (
            <ProfileTypeBadge type={business ? 'business' : 'personal'} compact />
          ) : null}
        </View>
        {canSwitch ? (
          <PressableScale
            testID="posting-as-switch"
            accessibilityLabel="Change profile"
            disabled={disabled}
            onPress={() => setOpen(true)}
            style={[
              styles.switch,
              {
                backgroundColor: theme.colors.surfaceMuted,
                opacity: disabled ? 0.5 : 1,
              },
            ]}>
            <AppIcon name="switch" size={17} color={theme.colors.textPrimary} strokeWidth={2.25} />
          </PressableScale>
        ) : null}
      </View>
      {fallbackApplied ? (
        <Text style={[styles.warning, { color: theme.colors.warning }]}>
          Previous profile unavailable
        </Text>
      ) : null}
      {canSwitch ? (
        <ProfileSwitcherSheet
          visible={open && !disabled}
          onClose={() => setOpen(false)}
          title="Post as"
          identities={identities}
          activeId={identity?.id ?? null}
          onSelect={item => onSelect(item.id)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeleton: { width: 50, height: 50, borderRadius: 25 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  switch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: { fontSize: 12.5, fontWeight: '600', paddingLeft: 2 },
});
