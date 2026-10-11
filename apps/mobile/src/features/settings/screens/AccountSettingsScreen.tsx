import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { useThemeStore } from '@/shared/store/themeStore';
import { useAuth } from '@/shared/context/AuthProvider';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { palette } from '@/shared/theme/colors';
import { useProviderApplicationsQuery } from '@/shared/api/providerHooks';
import { useContentProfileQuery } from '@/shared/api/storyHooks';
import {
  useFollowRequestAction,
  useFollowRequestsQuery,
  useProfilePrivacyMutation,
} from '@/shared/api/profileFollows';
import type { PublishingIdentity } from '@/shared/api/publishingHooks';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import {
  ProfileSwitcherSheet,
  useModalFillHeight,
  identityAvatarUrl,
} from '@/shared/publishing/ProfileSwitcherSheet';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { AssistantPrivacySection } from '@/features/assistant/components/AssistantPrivacySection';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import { ActiveProfileCard, type ActiveProfileCardData } from '../components/ActiveProfileCard';
import { BecomeProviderCard } from '../components/BecomeProviderCard';
import {
  SettingsRow,
  SettingsSection,
  TileGrid,
  type Tile,
} from '../components/SettingsPrimitives';
import {
  applicationForProfile,
  applicationStatusChip,
  pendingBusinessApplications,
  profileShareMessage,
} from '../profileHubModel';

const tint = (fg: string, bg: string) => ({ fg, bg });

/**
 * Settings / profile hub (route `AccountSettings`).
 *
 * 1. Active profile card (switcher)   2. Profile actions
 * 3. Business actions (business active) or the provider CTA (personal)
 * 4. Activity shortcuts                5. Account settings
 *
 * Rows only exist for destinations that exist in the app; business rows
 * without a screen yet (services, availability, provider bookings,
 * products, earnings) are intentionally not shown.
 */
export function AccountSettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const modalHeight = useModalFillHeight();
  const { user, logout } = useAuth();
  const themeMode = useThemeStore(s => s.mode);
  const setThemeMode = useThemeStore(s => s.setMode);
  const { identities, active, setActive } = useActiveProfile();
  const { data: applications = [] } = useProviderApplicationsQuery();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const isGuest = !user || user.id === 'temporary-guest';
  const activeType = active ? identityProfileType(active) : 'personal';
  const activeRef = active ? { id: active.id, type: activeType } : null;
  const activeProfileQuery = useContentProfileQuery(activeRef?.type, activeRef?.id);
  const privacyMutation = useProfilePrivacyMutation(activeRef);
  const followRequestsQuery = useFollowRequestsQuery(activeRef);
  const followRequestAction = useFollowRequestAction(activeRef);
  const followRequests = followRequestsQuery.data ?? [];
  const profileIsPrivate = activeProfileQuery.data?.isPrivate === true;
  const isBusiness = activeType === 'business';

  const card: ActiveProfileCardData = active
    ? {
        id: active.id,
        name: active.name,
        avatarUrl: identityAvatarUrl(active),
        type: activeType,
        verified: Boolean(active.publisher?.verified),
        handle: active.publisher?.handle ?? null,
      }
    : {
        id: user?.id ?? 'me',
        name: user?.displayName ?? '',
        avatarUrl: user?.avatarUrl ?? null,
        type: 'personal',
        verified: false,
      };

  const ownedIds = useMemo(() => new Set(identities.map(item => item.id)), [identities]);
  const pending = useMemo(
    () =>
      pendingBusinessApplications(applications, ownedIds).map(application => ({
        id: application.id,
        name: application.businessName,
        status: applicationStatusChip(application.status)!,
      })),
    [applications, ownedIds],
  );
  const activeApplication = isBusiness
    ? applicationForProfile(applications, active?.id)
    : undefined;
  const activeApplicationChip = activeApplication
    ? applicationStatusChip(activeApplication.status)
    : null;
  const pendingChip =
    pending.find(item => item.status.tone === 'warning')?.status ??
    pending[0]?.status ??
    null;

  const addBusiness = () =>
    applications.length > 0
      ? navigation.navigate('ProviderApplicationKind')
      : navigation.navigate('ProviderApplicationIntro');

  const selectProfile = (identity: PublishingIdentity) => setActive(identity);

  const openPreview = () =>
    navigation.navigate('Profile', { profileType: card.type, profileId: card.id });

  const shareProfile = () => {
    Share.share({ message: profileShareMessage(card) }).catch(() => undefined);
  };

  const chooseProfilePrivacy = () =>
    Alert.alert('Profile privacy', `Applies to ${card.name}`, [
      {
        text: 'Public',
        onPress: () => privacyMutation.mutate({
          isPrivate: false,
          allowFollowRequests: true,
          showFollowerLists: true,
        }),
      },
      {
        text: 'Private',
        onPress: () => privacyMutation.mutate({
          isPrivate: true,
          allowFollowRequests: true,
          showFollowerLists: true,
        }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  const confirmLogout = () =>
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          logout();
        },
      },
    ]);

  const createTiles: Tile[] = [
    { id: 'post', label: 'Post', icon: 'image', tint: tint(palette.skyDeep, palette.skySoft), onPress: () => navigation.navigate('FlashComposer') },
    { id: 'clip', label: 'Clip', icon: 'clapperboard', tint: tint(palette.coralDeep, palette.coralSoft), onPress: () => navigation.navigate('ClipComposer') },
    { id: 'story', label: 'Story', icon: 'circle-plus', tint: tint(palette.lavenderDeep, palette.lavenderSoft), onPress: () => navigation.navigate('StoryCreator') },
    { id: 'businesses', label: 'Businesses', icon: 'store', tint: tint(palette.indigoDeep, palette.indigoSoft), onPress: () => navigation.navigate('ProviderBusinesses') },
  ];

  const activityTiles: Tile[] = [
    { id: 'saved', label: 'Saved', icon: 'bookmark', tint: tint(palette.amberDeep, palette.amberSoft), onPress: () => navigation.navigate('SavedHub') },
    { id: 'bookings', label: 'Bookings', icon: 'calendar', tint: tint(palette.aquaDeep, palette.aquaSoft), onPress: () => navigation.navigate('MyBookings') },
    { id: 'orders', label: 'Orders', icon: 'package', tint: tint(palette.coralDeep, palette.coralSoft), onPress: () => navigation.navigate('MyOrders') },
    { id: 'trips', label: 'Trips', icon: 'globe', tint: tint(palette.skyDeep, palette.skySoft), onPress: () => navigation.navigate('MyTrips') },
    { id: 'courses', label: 'Courses', icon: 'graduation-cap', tint: tint(palette.indigoDeep, palette.indigoSoft), onPress: () => navigation.navigate('MyLearning') },
    { id: 'requests', label: 'Requests', icon: 'clipboard-list', tint: tint(palette.limeDeep, palette.limeSoft), onPress: () => navigation.navigate('MyServiceRequests') },
    { id: 'messages', label: 'Messages', icon: 'messages', tint: tint(palette.pinkDeep, palette.pinkSoft), onPress: () => navigation.navigate('Main', { screen: 'Knock', params: { initialTab: 'chat' } }) },
    { id: 'genie', label: 'Genie', icon: 'sparkles', tint: tint(palette.lavenderDeep, palette.lavenderSoft), onPress: () => useAssistantStore.getState().openAssistant() },
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <PressableScale
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          style={[styles.topButton, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name="back" size={22} color={theme.colors.textPrimary} strokeWidth={2.25} />
        </PressableScale>
        <Text style={[styles.topTitle, { color: theme.colors.textPrimary }]}>Settings</Text>
        <View style={styles.topButton} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <ActiveProfileCard profile={card} onPress={() => setSwitcherOpen(true)} />

        <SettingsSection label="Profile" testID="section-profile">
          {!isBusiness && !isGuest ? (
            <SettingsRow
              testID="row-edit-profile"
              icon="edit"
              label="Edit profile"
              iconTint={tint(palette.aquaDeep, palette.aquaSoft)}
              onPress={() => navigation.navigate('EditProfile')}
            />
          ) : null}
          <SettingsRow
            testID="row-profile-preview"
            icon="eye"
            label="Profile preview"
            iconTint={tint(palette.skyDeep, palette.skySoft)}
            onPress={openPreview}
          />
          <SettingsRow
            testID="row-share-profile"
            icon="share"
            label="Share profile"
            navigates={false}
            iconTint={tint(palette.lavenderDeep, palette.lavenderSoft)}
            onPress={shareProfile}
            divider={!isBusiness && applications.length > 0}
          />
          {!isBusiness && applications.length > 0 ? (
            <SettingsRow
              testID="row-my-businesses"
              icon="store"
              label="My businesses"
              chip={pendingChip}
              iconTint={tint(palette.indigoDeep, palette.indigoSoft)}
              onPress={() => navigation.navigate('ProviderBusinesses')}
              divider={false}
            />
          ) : null}
        </SettingsSection>

        {isBusiness ? (
          <SettingsSection label="Business" testID="section-business">
            {activeApplication ? (
              <SettingsRow
                testID="row-business-details"
                icon="briefcase"
                label="Business details"
                chip={activeApplicationChip}
                iconTint={tint(palette.indigoDeep, palette.indigoSoft)}
                onPress={() =>
                  navigation.navigate('ProviderApplicationStatus', {
                    applicationId: activeApplication.id,
                  })
                }
              />
            ) : null}
            <TileGrid tiles={createTiles} />
          </SettingsSection>
        ) : !isGuest ? (
          <BecomeProviderCard
            actionLabel={applications.length > 0 ? 'Add business' : 'Get started'}
            onPress={addBusiness}
          />
        ) : null}

        {followRequests.length > 0 ? (
          <SettingsSection label="Follow requests" testID="section-follow-requests">
            {followRequests.map(request => {
              const follower = { id: request.follower.id, type: request.follower.type };
              return (
                <View key={request.id} style={[styles.requestCard, { borderColor: theme.colors.borderSoft }]}>
                  {request.follower.avatarUrl ? (
                    <Image source={{ uri: request.follower.avatarUrl }} style={styles.requestAvatar} />
                  ) : (
                    <View style={[styles.requestAvatar, styles.requestAvatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
                      <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>
                        {request.follower.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.requestIdentity}>
                    <View style={styles.requestNameRow}>
                      <Text numberOfLines={1} style={[styles.requestName, { color: theme.colors.textPrimary }]}>
                        {request.follower.displayName}
                      </Text>
                      {request.follower.verified ? <AppIcon name="verified" size={13} color={theme.colors.primary} /> : null}
                    </View>
                    <Text style={[styles.requestType, { color: theme.colors.textSecondary }]}>
                      {request.follower.type === 'business' ? 'Business' : 'Personal'}
                    </Text>
                  </View>
                  <PressableScale
                    accessibilityLabel="Accept follow request"
                    style={[styles.requestAction, { backgroundColor: theme.colors.primary }]}
                    onPress={() => followRequestAction.mutate({ action: 'accept', follower })}>
                    <AppIcon name="check" size={15} color="#fff" />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="Delete follow request"
                    style={[styles.requestAction, { backgroundColor: theme.colors.surfaceMuted }]}
                    onPress={() => followRequestAction.mutate({ action: 'reject', follower })}>
                    <AppIcon name="close" size={15} color={theme.colors.textPrimary} />
                  </PressableScale>
                  <PressableScale
                    accessibilityLabel="Block follow requester"
                    style={[styles.requestAction, { backgroundColor: theme.colors.surfaceMuted }]}
                    onPress={() => followRequestAction.mutate({ action: 'block', follower })}>
                    <AppIcon name="alert" size={15} color={theme.colors.error} />
                  </PressableScale>
                </View>
              );
            })}
          </SettingsSection>
        ) : null}

        <SettingsSection label="Activity" testID="section-activity">
          <TileGrid tiles={activityTiles} />
        </SettingsSection>

        <SettingsSection label="Account" testID="section-account">
          <SettingsRow
            testID="row-notifications"
            icon="bell"
            label="Notifications"
            onPress={() =>
              navigation.navigate('Main', {
                screen: 'Knock',
                params: { initialTab: 'notifications' },
              })
            }
          />
          <SettingsRow
            testID="row-privacy"
            icon="lock"
            label="Privacy"
            value={privacyMutation.isPending ? 'Saving…' : profileIsPrivate ? 'Private' : 'Public'}
            onPress={chooseProfilePrivacy}
          />
          <SettingsRow
            testID="row-assistant-privacy"
            icon="shield-check"
            label="Genie data privacy"
            onPress={() => setPrivacyOpen(true)}
          />
          <SettingsRow
            testID="row-appearance"
            icon="sun-moon"
            label="Appearance"
            value={themeMode === 'dark' ? 'Dark' : themeMode === 'system' ? 'System' : 'Light'}
            navigates={false}
            onPress={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          />
          {!isGuest ? (
            <SettingsRow
              testID="row-interests"
              icon="heart"
              label="Interests"
              onPress={() => navigation.navigate('InterestPreferences')}
            />
          ) : null}
          <SettingsRow
            testID="row-help"
            icon="support"
            label="Help"
            onPress={() => navigation.navigate('ComingSoon', { title: 'Help Center' })}
          />
          <SettingsRow
            testID="row-logout"
            icon="log-out"
            label="Log out"
            tone="danger"
            navigates={false}
            divider={false}
            onPress={confirmLogout}
          />
        </SettingsSection>
      </ScrollView>

      <ProfileSwitcherSheet
        visible={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        identities={identities}
        activeId={active?.id ?? null}
        onSelect={selectProfile}
        pending={pending}
        onOpenPending={id =>
          navigation.navigate('ProviderApplicationStatus', { applicationId: id })
        }
        onAddBusiness={isGuest ? undefined : addBusiness}
        onAddPersonal={isGuest ? undefined : () => navigation.navigate('EditProfile')}
      />

      <Modal
        visible={privacyOpen}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setPrivacyOpen(false)}>
        <View style={[styles.modalFill, { height: modalHeight }]}>
          <Pressable
            style={[StyleSheet.absoluteFill, { backgroundColor: theme.colors.overlay }]}
            onPress={() => setPrivacyOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close privacy"
          />
          <View
            style={[
              styles.privacySheet,
              {
                backgroundColor: theme.colors.backgroundElevated,
                paddingBottom: insets.bottom + 20,
              },
            ]}>
            <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
            <AssistantPrivacySection />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
  },
  requestAvatar: { width: 40, height: 40, borderRadius: 20 },
  requestAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  requestIdentity: { flex: 1, minWidth: 0 },
  requestNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  requestName: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  requestType: { fontSize: 12, marginTop: 2 },
  requestAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFill: { position: 'absolute', top: 0, left: 0, right: 0, justifyContent: 'flex-end' },
  privacySheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, marginBottom: 12 },
});
