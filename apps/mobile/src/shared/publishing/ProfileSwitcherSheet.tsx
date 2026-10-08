import React from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import type { PublishingIdentity } from '@/shared/api/publishingHooks';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfileTypeBadge, StatusChip, type StatusTone } from './ProfileTypeBadge';
import { identityProfileType } from './publisherSelection';

export type PendingProfileRow = {
  id: string;
  name: string;
  status: { label: string; tone: StatusTone };
};

type Props = {
  visible: boolean;
  onClose: () => void;
  identities: readonly PublishingIdentity[];
  activeId: string | null;
  onSelect: (identity: PublishingIdentity) => void;
  title?: string;
  /** Submitted businesses that are not selectable yet. */
  pending?: readonly PendingProfileRow[];
  onOpenPending?: (id: string) => void;
  /** "+ Add business" card (existing application flow). */
  onAddBusiness?: () => void;
  /** Shown only when the account has no personal profile. */
  onAddPersonal?: () => void;
};

export function identityAvatarUrl(identity: PublishingIdentity) {
  return identity.publisher?.avatarUrl ?? identity.avatarUrl ?? null;
}

/**
 * Android edge-to-edge: a transparent modal's root can measure shorter than
 * the display, leaving the system-bar strip at the bottom uncovered. Sheets
 * size their backdrop to the full screen instead.
 */
export function useModalFillHeight(): number {
  const windowSize = useWindowDimensions();
  return Platform.OS === 'android'
    ? Math.max(Dimensions.get('screen').height, windowSize.height)
    : windowSize.height;
}

/**
 * Compact visual switcher: every owned profile as a large avatar/logo row
 * (active = ring + check), pending businesses with their state, then the
 * add cards. Selecting closes the sheet immediately.
 */
export function ProfileSwitcherSheet({
  visible,
  onClose,
  identities,
  activeId,
  onSelect,
  title = 'Switch profile',
  pending = [],
  onOpenPending,
  onAddBusiness,
  onAddPersonal,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const fullHeight = useModalFillHeight();
  const hasPersonal = identities.some(
    identity => identityProfileType(identity) === 'personal',
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={[styles.fill, { height: fullHeight }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close profile switcher"
        />
        <Animated.View
          entering={SlideInDown.duration(280)}
          testID="profile-switcher-sheet"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.backgroundElevated,
              paddingBottom: Math.max(insets.bottom, 16) + 20,
              borderColor: theme.colors.border,
            },
          ]}>
          <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{title}</Text>
            <PressableScale
              onPress={onClose}
              accessibilityLabel="Close"
              hitSlop={8}
              style={[styles.close, { backgroundColor: theme.colors.surfaceMuted }]}>
              <AppIcon name="close" size={18} color={theme.colors.textPrimary} strokeWidth={2.25} />
            </PressableScale>
          </View>
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}>
            {identities.map(identity => {
              const business = identityProfileType(identity) === 'business';
              const active = identity.id === activeId;
              return (
                <PressableScale
                  key={identity.id}
                  testID={`switcher-row-${identity.id}`}
                  accessibilityLabel={`${identity.name}, ${business ? 'business' : 'personal'} profile${active ? ', active' : ''}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelect(identity);
                    onClose();
                  }}
                  style={[
                    styles.row,
                    {
                      backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                    },
                  ]}>
                  <ProfileAvatar
                    name={identity.name}
                    uri={identityAvatarUrl(identity)}
                    size={52}
                    business={business}
                    active={active}
                    showCheck={active}
                    badgeBorderColor={theme.colors.backgroundElevated}
                  />
                  <View style={styles.rowBody}>
                    <View style={styles.nameLine}>
                      <Text
                        numberOfLines={1}
                        style={[styles.name, { color: theme.colors.textPrimary }]}>
                        {identity.name}
                      </Text>
                      {identity.publisher?.verified ? (
                        <AppIcon name="verified" size={16} color={theme.colors.primary} strokeWidth={2.25} />
                      ) : null}
                    </View>
                    <ProfileTypeBadge type={business ? 'business' : 'personal'} compact />
                  </View>
                  {active ? (
                    <AppIcon name="circle-check" size={24} color={theme.colors.primary} strokeWidth={2.25} />
                  ) : (
                    <View style={[styles.radio, { borderColor: theme.colors.borderStrong }]} />
                  )}
                </PressableScale>
              );
            })}

            {pending.map(row => (
              <PressableScale
                key={row.id}
                testID={`switcher-pending-${row.id}`}
                accessibilityLabel={`${row.name}, ${row.status.label}`}
                disabled={!onOpenPending}
                onPress={() => {
                  onClose();
                  onOpenPending?.(row.id);
                }}
                style={[
                  styles.row,
                  { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
                ]}>
                <ProfileAvatar name={row.name} size={52} business dimmed />
                <View style={styles.rowBody}>
                  <Text
                    numberOfLines={1}
                    style={[styles.name, { color: theme.colors.textSecondary }]}>
                    {row.name}
                  </Text>
                  <StatusChip label={row.status.label} tone={row.status.tone} />
                </View>
                {onOpenPending ? (
                  <AppIcon name="chevron-right" size={20} color={theme.colors.textTertiary} strokeWidth={2} />
                ) : null}
              </PressableScale>
            ))}

            {(onAddPersonal && !hasPersonal) || onAddBusiness ? (
              <View style={styles.addRow}>
                {onAddPersonal && !hasPersonal ? (
                  <PressableScale
                    testID="switcher-add-personal"
                    accessibilityLabel="Add personal profile"
                    onPress={() => {
                      onClose();
                      onAddPersonal();
                    }}
                    style={[styles.addCard, { borderColor: theme.colors.borderStrong }]}>
                    <View style={[styles.addIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                      <AppIcon name="user-plus" size={20} color={theme.colors.textPrimary} strokeWidth={2} />
                    </View>
                    <Text style={[styles.addLabel, { color: theme.colors.textPrimary }]}>Personal</Text>
                  </PressableScale>
                ) : null}
                {onAddBusiness ? (
                  <PressableScale
                    testID="switcher-add-business"
                    accessibilityLabel="Add business"
                    onPress={() => {
                      onClose();
                      onAddBusiness();
                    }}
                    style={[styles.addCard, { borderColor: theme.colors.borderStrong }]}>
                    <View style={[styles.addIcon, { backgroundColor: theme.colors.primary }]}>
                      <AppIcon name="plus" size={20} color="#FFFFFF" strokeWidth={2.5} />
                    </View>
                    <Text style={[styles.addLabel, { color: theme.colors.textPrimary }]}>Add business</Text>
                  </PressableScale>
                ) : null}
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 8,
    maxHeight: '82%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.2 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 4, gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 6 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 16.5, fontWeight: '700', flexShrink: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  addRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  addCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  addIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addLabel: { fontSize: 15.5, fontWeight: '700' },
});
