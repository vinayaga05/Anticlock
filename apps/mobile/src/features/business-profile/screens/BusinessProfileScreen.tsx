import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import Clipboard from '@react-native-clipboard/clipboard';
import { Share } from 'react-native';
import type {
  BusinessProfile,
  BusinessReview,
  BusinessService,
} from '@anticlock/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { Skeleton } from '@/shared/components/Skeleton';
import { useTheme } from '@/shared/hooks/useTheme';
import { useAuth } from '@/shared/context/AuthProvider';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import {
  useProfileFollowMutation,
  blockProfile,
  type ProfileRef,
} from '@/shared/api/profileFollows';
import { createOrGetChannel } from '@/shared/api/messagesClient';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { useProfileClipReelsQuery } from '@/shared/api/hooks';
import { ApiError, getApiToken } from '@/shared/api/client';
import type { RootStackParamList } from '@/shared/navigation/types';
import { BusinessProfileHeader } from '../components/BusinessProfileHeader';
import {
  BusinessMediaViewer,
  type BusinessGalleryItem,
} from '../components/BusinessMediaViewer';
import { BusinessReviewComposer } from '../components/BusinessReviewComposer';
import {
  businessBrand,
  businessDistance,
  businessDistanceKm,
  businessPrice,
  businessProfileLink,
  directionsUrl,
  type BusinessBrand,
} from '../businessProfileModel';
import { locateBusinessViewer } from '../businessLocation';
import {
  useBusinessProfileQuery,
  useBusinessReviewsQuery,
  useSaveBusinessMutation,
  useReportBusinessMutation,
  useCreateBusinessReviewMutation,
} from '../businessProfileHooks';

const DAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];
const REPORT_REASONS = [
  { id: 'misleading', label: 'Misleading business information' },
  { id: 'spam', label: 'Spam or scam' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'safety', label: 'Safety concern' },
  { id: 'other', label: 'Something else' },
];
type Colors = {
  background: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  soft: string;
  error: string;
};
function colorsFor(dark: boolean): Colors {
  return dark
    ? {
        background: '#101713',
        surface: '#19211C',
        ink: '#F8F2E7',
        muted: '#B3BEB6',
        line: '#344139',
        soft: '#222D25',
        error: '#FFB8BA',
      }
    : {
        background: '#F4F2EB',
        surface: '#FFFDF9',
        ink: '#253029',
        muted: '#68746C',
        line: '#E2E5DD',
        soft: '#EBEEE7',
        error: '#AE3445',
      };
}
function hoursLabel(value: string | null) {
  if (!value) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${
    hour < 12 ? 'AM' : 'PM'
  }`;
}
function operatingLabel(
  value: BusinessProfile['availability']['operatingStatus'],
) {
  return {
    open: 'Open now',
    closed: 'Closed now',
    temporarily_unavailable: 'Temporarily unavailable',
    fully_booked: 'Fully booked today',
    unknown: 'Hours not listed',
  }[value];
}

function Action({
  label,
  icon,
  onPress,
  brand,
  colors,
  primary = false,
  disabled = false,
  pending = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  brand: BusinessBrand;
  colors: Colors;
  primary?: boolean;
  disabled?: boolean;
  pending?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={[
        styles.action,
        {
          backgroundColor: primary ? brand.button : colors.surface,
          borderColor: primary ? brand.button : colors.line,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      {pending ? (
        <ActivityIndicator
          size="small"
          color={primary ? '#FFFFFF' : brand.accent}
        />
      ) : (
        <AppIcon
          name={icon}
          size={17}
          color={primary ? '#FFFFFF' : brand.accent}
        />
      )}
      <Text
        style={[
          styles.actionLabel,
          { color: primary ? '#FFFFFF' : colors.ink },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
function Section({
  number,
  title,
  copy,
  children,
  colors,
  action,
  onAction,
  onLayout,
}: React.PropsWithChildren<{
  number: string;
  title: string;
  copy?: string;
  colors: Colors;
  action?: string;
  onAction?: () => void;
  onLayout?: (y: number) => void;
}>) {
  return (
    <View
      onLayout={event => onLayout?.(event.nativeEvent.layout.y)}
      style={[
        styles.section,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <View style={styles.sectionHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionIndex, { color: colors.muted }]}>
            {number} / THE DETAILS
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.sectionTitle, { color: colors.ink }]}
          >
            {title}
          </Text>
          {copy ? (
            <Text style={[styles.sectionCopy, { color: colors.muted }]}>
              {copy}
            </Text>
          ) : null}
        </View>
        {action && onAction ? (
          <PressableScale
            accessibilityLabel={action}
            onPress={onAction}
            style={styles.sectionLink}
          >
            <Text style={[styles.linkText, { color: colors.ink }]}>
              {action}
            </Text>
            <AppIcon name="chevron-right" size={15} color={colors.ink} />
          </PressableScale>
        ) : null}
      </View>
      {children}
    </View>
  );
}
function Empty({
  icon,
  title,
  copy,
  colors,
}: {
  icon: IconName;
  title: string;
  copy: string;
  colors: Colors;
}) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.background }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surface }]}>
        <AppIcon name={icon} size={22} color={colors.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.emptyCopy, { color: colors.muted }]}>{copy}</Text>
    </View>
  );
}
function Loading({ colors, top }: { colors: Colors; top: number }) {
  return (
    <View
      testID="business-profile-loading"
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <Skeleton height={top + 278} radius={0} />
      <View style={{ padding: 24, gap: 16 }}>
        <Skeleton
          width={88}
          height={88}
          radius={24}
          style={{ marginTop: -58 }}
        />
        <Skeleton width="80%" height={34} />
        <Skeleton width="65%" height={18} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Skeleton width="45%" height={46} />
          <Skeleton width="45%" height={46} />
        </View>
        <Skeleton height={170} radius={24} />
        <Skeleton height={200} radius={24} />
      </View>
    </View>
  );
}

export function BusinessProfileScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'BusinessProfile'>>();
  const navigation = useNavigation<any>();
  const providerId = route.params.providerId;
  const theme = useTheme();
  const colors = colorsFor(theme.mode === 'dark');
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { active, identities, isLoading: identityLoading } = useActiveProfile();
  const { isReady: chatReady } = useStreamChat();
  const queryClient = useQueryClient();
  const viewer: ProfileRef | undefined = active
    ? { id: active.id, type: identityProfileType(active) }
    : user && user.id !== 'temporary-guest'
    ? { id: user.id, type: 'personal' }
    : undefined;
  const interactionScope = useRef('');
  interactionScope.current = `${user?.id}:${providerId}:${viewer?.type}:${
    viewer?.id
  }:${getApiToken()}`;
  const reportOperation = useRef<object | null>(null);
  const query = useBusinessProfileQuery(providerId, viewer);
  const reviewsQuery = useBusinessReviewsQuery(providerId, viewer);
  const business = query.data;
  const target = useMemo(
    () => ({ id: providerId, type: 'business' as const }),
    [providerId],
  );
  const follow = useProfileFollowMutation(viewer ?? null, target);
  const save = useSaveBusinessMutation(providerId, viewer);
  const report = useReportBusinessMutation(providerId, viewer);
  const createReview = useCreateBusinessReviewMutation(providerId, viewer);
  const clips = useProfileClipReelsQuery(
    business ? 'business' : undefined,
    business ? providerId : undefined,
  );
  const [messageBusy, setMessageBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState('misleading');
  const [reportDetails, setReportDetails] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [gallery, setGallery] = useState<{
    items: BusinessGalleryItem[];
    index: number;
  } | null>(null);
  const [expandedAbout, setExpandedAbout] = useState(false);
  const [viewerLocation, setViewerLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [compactHeader, setCompactHeader] = useState(false);
  const [footerHeight, setFooterHeight] = useState(100);
  const scroll = useRef<ScrollView>(null);
  const anchors = useRef<Record<string, number>>({});
  const alive = useRef(true);
  const userRef = useRef(user?.id);
  userRef.current = user?.id;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setGallery(null);
    setMore(false);
    setReporting(false);
    setReportDetails('');
    setReportReason('misleading');
    setReviewing(false);
    setNotice(null);
    setExpandedAbout(false);
    setViewerLocation(null);
    setLocating(false);
    setCompactHeader(false);
    setMessageBusy(false);
    reportOperation.current = null;
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [providerId, user?.id, viewer?.type, viewer?.id]);
  useFocusEffect(
    React.useCallback(() => {
      void query.refetch();
    }, [providerId, viewer?.type, viewer?.id]),
  );
  const brand = businessBrand(
    providerId,
    business?.brandAccentColor,
    theme.mode === 'dark',
  );
  const showError = (error: unknown) => {
    if (alive.current)
      setNotice(error instanceof Error ? error.message : 'Please try again.');
  };
  const goBack = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('Main', { screen: 'Needs' });
  const openBooking = (service?: BusinessService) =>
    navigation.navigate('BusinessBooking', {
      providerId,
      categoryId:
        service?.categoryId ??
        route.params.categoryId ??
        business?.services.find(item => item.available)?.categoryId,
    });
  const openClips = (reelId?: string, exploreSimilar = false) => {
    if (!business) return;
    const categoryId = route.params.categoryId ?? business.categories[0]?.id;
    if (categoryId)
      navigation.navigate('ProviderClips', {
        providerId,
        serviceCategoryId: categoryId,
        providerName: business.name,
        ...(reelId ? { reelId } : {}),
        ...(exploreSimilar ? { exploreSimilar: true } : {}),
      });
    else
      navigation.navigate('Main', {
        screen: 'PlayFeed',
        params: {
          profileType: 'business',
          profileId: providerId,
          ...(reelId ? { reelId } : {}),
        },
      });
  };
  const doShare = () => {
    if (business)
      void Share.share({
        title: business.name,
        message: `${business.name} on Knock\n${businessProfileLink(
          providerId,
        )}`,
      }).catch(showError);
  };
  const doFollow = async () => {
    const scope = interactionScope.current;
    try {
      await follow.mutateAsync(
        business?.viewer.relationship?.isFollowing ||
          business?.viewer.relationship?.isRequested
          ? 'unfollow'
          : 'follow',
      );
      if (alive.current && interactionScope.current === scope)
        await query.refetch();
    } catch (error) {
      if (interactionScope.current === scope) showError(error);
    }
  };
  const doSave = async () => {
    const scope = interactionScope.current;
    try {
      await save.mutateAsync(!business?.viewer.isSaved);
    } catch (error) {
      if (interactionScope.current === scope) showError(error);
    }
  };
  const doMessage = async () => {
    if (!viewer || !business || messageBusy || !chatReady) return;
    const scope = interactionScope.current;
    setMessageBusy(true);
    setNotice(null);
    try {
      const result = await createOrGetChannel(target, viewer);
      if (alive.current && interactionScope.current === scope) {
        if (
          result.profile.id !== providerId ||
          result.profile.type !== 'business'
        )
          throw new Error('The business conversation could not be confirmed.');
        navigation.navigate('Thread', {
          conversationId: result.channelId,
          channelId: result.channelId,
          profile: result.profile,
        });
      }
    } catch (error) {
      if (interactionScope.current === scope) showError(error);
    } finally {
      if (alive.current && interactionScope.current === scope)
        setMessageBusy(false);
    }
  };
  const block = () => {
    if (!viewer || !business) return;
    const scope = interactionScope.current;
    Alert.alert(
      `Block ${business.name}?`,
      'This business will no longer be available to this profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block business',
          style: 'destructive',
          onPress: () => {
            if (interactionScope.current !== scope) return;
            void blockProfile(viewer, target)
              .then(() => {
                if (alive.current && interactionScope.current === scope) {
                  for (const key of [
                    ['business-profile'],
                    ['saved-businesses'],
                    ['marketplace'],
                    contentQueryKeys.clipsFeed,
                    contentQueryKeys.flashFeed,
                  ])
                    void queryClient.invalidateQueries({ queryKey: key });
                  setMore(false);
                  goBack();
                }
              })
              .catch(error => {
                if (interactionScope.current === scope) showError(error);
              });
          },
        },
      ],
    );
  };
  const submitReport = async () => {
    if (reportOperation.current) return;
    const request = {};
    reportOperation.current = request;
    const scope = interactionScope.current;
    try {
      await report.mutateAsync({
        reason: reportReason,
        ...(reportDetails.trim() ? { details: reportDetails.trim() } : {}),
      });
      if (alive.current && interactionScope.current === scope) {
        setReporting(false);
        setMore(false);
        setReportDetails('');
        setNotice('Your report has been sent for review.');
      }
    } catch (error) {
      if (interactionScope.current === scope) showError(error);
    } finally {
      if (reportOperation.current === request) reportOperation.current = null;
    }
  };
  if (!user || user.id === 'temporary-guest')
    return (
      <View
        style={[
          styles.fullState,
          { backgroundColor: colors.background, paddingTop: insets.top + 20 },
        ]}
      >
        <AppIcon name="briefcase" size={40} color={brand.accent} />
        <Text style={[styles.stateTitle, { color: colors.ink }]}>
          Meet your next favourite business.
        </Text>
        <Text style={[styles.emptyCopy, { color: colors.muted }]}>
          Sign in to follow, message, and book approved businesses.
        </Text>
        <Action
          label="Sign in"
          icon="user"
          onPress={() => {
            void logout();
          }}
          brand={brand}
          colors={colors}
          primary
        />
        <Action
          label="Back"
          icon="back"
          onPress={goBack}
          brand={brand}
          colors={colors}
        />
      </View>
    );
  if (query.isLoading || identityLoading || (!business && !query.isError))
    return <Loading colors={colors} top={insets.top} />;
  if (query.isError || !business) {
    const unavailable =
      query.error instanceof ApiError &&
      [403, 404].includes(query.error.status);
    return (
      <View
        testID="business-profile-error"
        style={[
          styles.fullState,
          { backgroundColor: colors.background, paddingTop: insets.top + 20 },
        ]}
      >
        <AppIcon
          name={unavailable ? 'lock' : 'globe'}
          size={40}
          color={brand.accent}
        />
        <Text style={[styles.stateTitle, { color: colors.ink }]}>
          {unavailable
            ? 'Business unavailable'
            : 'We couldn’t open this business'}
        </Text>
        <Text style={[styles.emptyCopy, { color: colors.muted }]}>
          {unavailable
            ? 'This business may be unavailable or no longer public.'
            : 'Check your connection, then try again. Your place is saved.'}
        </Text>
        {!unavailable ? (
          <Action
            label="Try again"
            icon="refresh"
            onPress={() => {
              void query.refetch();
            }}
            brand={brand}
            colors={colors}
            pending={query.isFetching}
            primary
          />
        ) : null}
        <Action
          label="Back"
          icon="back"
          onPress={goBack}
          brand={brand}
          colors={colors}
        />
      </View>
    );
  }
  const relationship = business.viewer.relationship;
  const isMember = business.viewer.role !== null;
  const ownerControls =
    business.viewer.canManage ||
    business.viewer.canPublish ||
    business.viewer.canViewAnalytics ||
    business.viewer.canEditServices;
  const manageSection = business.viewer.canManage
    ? 'profile'
    : business.viewer.canEditServices
    ? 'services'
    : business.viewer.canViewAnalytics
    ? 'analytics'
    : null;
  const ownerPrimaryLabel =
    manageSection === 'analytics'
      ? 'Analytics'
      : manageSection
      ? 'Manage'
      : business.viewer.canPublish
      ? 'Add Clip'
      : 'Unavailable';
  const openOwnerPrimary = () =>
    manageSection
      ? navigation.navigate('BusinessManage', {
          providerId,
          section: manageSection,
        })
      : business.viewer.canPublish
      ? navigation.navigate('ClipComposer', {
          publisherProfileId: providerId,
          publisherProfileType: 'business',
        })
      : undefined;
  const availableServices = business.services.filter(item => item.available);
  const canBook =
    availableServices.length > 0 &&
    !business.availability.temporarilyUnavailable &&
    !isMember;
  const locationLabel = [business.location.area, business.location.city]
    .filter(Boolean)
    .join(', ');
  const directions = directionsUrl(business.location);
  const hours =
    business.availability.openingTime && business.availability.closingTime
      ? `${hoursLabel(business.availability.openingTime)} – ${hoursLabel(
          business.availability.closingTime,
        )} · IST`
      : null;
  const distance =
    viewerLocation &&
    business.location.latitude !== null &&
    business.location.longitude !== null
      ? businessDistance(
          businessDistanceKm(viewerLocation, {
            latitude: business.location.latitude,
            longitude: business.location.longitude,
          }),
        )
      : null;
  const locate = async () => {
    if (locating) return;
    const owner = user.id;
    setLocating(true);
    try {
      const position = await locateBusinessViewer();
      if (alive.current && userRef.current === owner)
        setViewerLocation(position);
    } catch (error) {
      if (userRef.current === owner) showError(error);
    } finally {
      if (alive.current && userRef.current === owner) setLocating(false);
    }
  };
  const allReviews =
    reviewsQuery.data?.pages.flatMap(page => page.reviews) ?? business.reviews;
  const bookings = reviewsQuery.data?.pages[0]?.eligibleBookings ?? [];
  const personal =
    identities.find(identity => identityProfileType(identity) === 'personal') ??
    null;
  const clipItems = (clips.data ?? []).slice(0, 6);
  const hasCoordinates =
    business.location.latitude !== null && business.location.longitude !== null;
  const jump = (key: string) =>
    scroll.current?.scrollTo({
      y: Math.max(
        0,
        (anchors.current._sections ?? 0) +
          (anchors.current[key] ?? 0) -
          insets.top,
      ),
      animated: true,
    });
  return (
    <View
      testID="business-profile-screen"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <StatusBar
        barStyle={
          compactHeader && theme.mode !== 'dark'
            ? 'dark-content'
            : 'light-content'
        }
        backgroundColor="transparent"
        translucent
      />
      <ScrollView
        ref={scroll}
        showsVerticalScrollIndicator={false}
        onScroll={event =>
          setCompactHeader(event.nativeEvent.contentOffset.y > 260)
        }
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => {
              void query.refetch();
              void reviewsQuery.refetch();
              void clips.refetch();
            }}
            tintColor={brand.accent}
          />
        }
      >
        <BusinessProfileHeader
          name={business.name}
          category={business.categories
            .map(category => category.name)
            .slice(0, 2)
            .join(' · ')}
          tagline={business.tagline}
          coverUrl={business.coverUrl}
          logoUrl={business.avatarUrl}
          brand={brand}
          approved
          location={locationLabel}
          distance={distance}
          rating={business.rating.average}
          reviewCount={business.rating.count}
          status={operatingLabel(business.availability.operatingStatus)}
          hours={hours}
          statusOpen={business.availability.operatingStatus === 'open'}
          topInset={insets.top}
          saved={business.viewer.isSaved}
          saving={save.isPending}
          onBack={goBack}
          onShare={doShare}
          onSave={() => {
            void doSave();
          }}
          onMore={() => setMore(true)}
          onCover={
            business.coverUrl
              ? () =>
                  setGallery({
                    items: [
                      { id: 'cover', kind: 'image', url: business.coverUrl! },
                    ],
                    index: 0,
                  })
              : undefined
          }
        />
        <View style={[styles.social, { backgroundColor: colors.surface }]}>
          <Action
            label={
              isMember
                ? 'Your business'
                : relationship?.isFollowing
                ? 'Following'
                : relationship?.isRequested
                ? 'Requested'
                : 'Follow'
            }
            icon={relationship?.isFollowing ? 'check' : 'follow'}
            onPress={() => void doFollow()}
            brand={brand}
            colors={colors}
            disabled={isMember || !relationship?.canFollow}
            pending={follow.isPending}
          />
          <Action
            label="Message"
            icon="message-circle"
            onPress={() => void doMessage()}
            brand={brand}
            colors={colors}
            disabled={isMember || !relationship?.canMessage || !chatReady}
            pending={messageBusy}
          />
        </View>
        <View style={[styles.stats, { backgroundColor: colors.surface }]}>
          {[
            [business.stats.followers, 'Followers'],
            [business.stats.clips, 'Clips'],
            [business.rating.count, 'Reviews'],
          ].map(([value, label]) => (
            <View key={label} style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.ink }]}>
                {value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.muted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        {ownerControls ? (
          <View
            testID="business-owner-controls"
            style={[styles.workspace, { backgroundColor: brand.deep }]}
          >
            <Text style={styles.workspaceEyebrow}>
              YOUR BUSINESS, BEAUTIFULLY RUN
            </Text>
            <Text style={styles.workspaceTitle}>The owner’s desk.</Text>
            <View style={styles.ownerGrid}>
              {(
                [
                  {
                    label: 'Edit profile',
                    icon: 'edit',
                    show: business.viewer.canManage,
                    action: () =>
                      navigation.navigate('BusinessManage', {
                        providerId,
                        section: 'profile',
                      }),
                  },
                  {
                    label: 'Manage services',
                    icon: 'briefcase',
                    show: business.viewer.canEditServices,
                    action: () =>
                      navigation.navigate('BusinessManage', {
                        providerId,
                        section: 'services',
                      }),
                  },
                  {
                    label: 'Bookings',
                    icon: 'calendar',
                    show: business.viewer.canManage,
                    action: () =>
                      navigation.navigate('ProviderDashboard', { providerId }),
                  },
                  {
                    label: 'Analytics',
                    icon: 'activity',
                    show: business.viewer.canViewAnalytics,
                    action: () =>
                      navigation.navigate('BusinessManage', {
                        providerId,
                        section: 'analytics',
                      }),
                  },
                  {
                    label: 'Add Clip',
                    icon: 'reels',
                    show: business.viewer.canPublish,
                    action: () =>
                      navigation.navigate('ClipComposer', {
                        publisherProfileId: providerId,
                        publisherProfileType: 'business',
                      }),
                  },
                  {
                    label: 'Add Product',
                    icon: 'shopping-bag',
                    show: business.viewer.canPublish,
                    action: () =>
                      navigation.navigate('CreateExploreProduct', {
                        publisherProfileId: providerId,
                        publisherProfileType: 'business',
                      }),
                  },
                  {
                    label: 'Add Event',
                    icon: 'calendar',
                    show: business.viewer.canPublish,
                    action: () =>
                      navigation.navigate('CreateExploreEvent', {
                        publisherProfileId: providerId,
                        publisherProfileType: 'business',
                      }),
                  },
                ] as {
                  label: string;
                  icon: IconName;
                  show: boolean;
                  action: () => void;
                }[]
              )
                .filter(item => item.show)
                .map(item => (
                  <PressableScale
                    key={item.label}
                    accessibilityLabel={item.label}
                    onPress={item.action}
                    style={styles.ownerAction}
                  >
                    <AppIcon name={item.icon} size={17} color="#F5EDD8" />
                    <Text style={styles.ownerLabel}>{item.label}</Text>
                  </PressableScale>
                ))}
            </View>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.jumpLinks}
        >
          {['Services', 'Clips', 'About', 'Reviews', 'Location'].map(label => (
            <PressableScale
              key={label}
              accessibilityLabel={`Go to ${label}`}
              onPress={() => jump(label)}
              style={[
                styles.jump,
                { borderColor: colors.line, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.jumpText, { color: colors.ink }]}>
                {label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
        <View
          style={styles.sections}
          onLayout={event => {
            anchors.current._sections = event.nativeEvent.layout.y;
          }}
        >
          <Section
            number="01"
            title="Made for you."
            copy="Explore what this business does best."
            colors={colors}
            onLayout={y => {
              anchors.current.Services = y;
            }}
          >
            {business.services.length ? (
              business.services.map(service => (
                <View
                  key={service.id}
                  style={[
                    styles.service,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  <View style={styles.serviceTop}>
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.serviceTitle, { color: colors.ink }]}
                      >
                        {service.title}
                      </Text>
                      {service.description ? (
                        <Text
                          style={[styles.bodySmall, { color: colors.muted }]}
                        >
                          {service.description}
                        </Text>
                      ) : null}
                      <View style={styles.serviceMeta}>
                        {service.durationMinutes ? (
                          <Text style={[styles.micro, { color: colors.muted }]}>
                            {service.durationMinutes} min
                          </Text>
                        ) : null}
                        {service.modes.map(mode => (
                          <Text
                            key={mode}
                            style={[styles.micro, { color: colors.muted }]}
                          >
                            {mode === 'center'
                              ? 'On-site'
                              : mode === 'home'
                              ? 'Home visit'
                              : 'Online'}
                          </Text>
                        ))}
                      </View>
                    </View>
                    <View
                      style={[
                        styles.serviceIcon,
                        { backgroundColor: brand.soft },
                      ]}
                    >
                      <AppIcon
                        name="briefcase"
                        size={21}
                        color={brand.accent}
                      />
                    </View>
                  </View>
                  <View style={styles.serviceBottom}>
                    <View>
                      <Text style={[styles.micro, { color: colors.muted }]}>
                        {service.price === null
                          ? 'BESPOKE PRICING'
                          : 'STARTING FROM'}
                      </Text>
                      <Text style={[styles.price, { color: colors.ink }]}>
                        {businessPrice(service.price)}
                      </Text>
                    </View>
                    <Action
                      label={service.available ? 'Book' : 'Unavailable'}
                      icon="calendar"
                      onPress={() => openBooking(service)}
                      brand={brand}
                      colors={colors}
                      primary
                      disabled={!canBook || !service.available}
                    />
                  </View>
                </View>
              ))
            ) : (
              <Empty
                icon="briefcase"
                title="New possibilities, coming into focus."
                copy="This business has not listed services yet. Follow to stay connected."
                colors={colors}
              />
            )}
          </Section>
          <Section
            number="02"
            title="A closer look."
            copy="Stories from the people behind the business."
            colors={colors}
            action={business.stats.clips ? 'All Clips' : undefined}
            onAction={() => openClips()}
            onLayout={y => {
              anchors.current.Clips = y;
            }}
          >
            {clips.isLoading ? (
              <Skeleton height={190} radius={16} />
            ) : clipItems.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              >
                {clipItems.map(clip => (
                  <PressableScale
                    key={clip.id}
                    accessibilityLabel={`Play ${business.name} Clip`}
                    onPress={() => openClips(clip.id)}
                    style={[styles.clip, { backgroundColor: brand.deep }]}
                  >
                    {clip.posterUrl ? (
                      <Image
                        source={{ uri: clip.posterUrl }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <View style={styles.videoArt}>
                        <AppIcon name="reels" size={32} color="#F5EDD8" />
                      </View>
                    )}
                    <View style={styles.playBadge}>
                      <AppIcon
                        name="play"
                        size={17}
                        color="#FFFFFF"
                        fill="#FFFFFF"
                      />
                    </View>
                    {clip.caption ? (
                      <Text numberOfLines={2} style={styles.clipCaption}>
                        {clip.caption}
                      </Text>
                    ) : null}
                  </PressableScale>
                ))}
              </ScrollView>
            ) : (
              <Empty
                icon="reels"
                title="The first story is still to come."
                copy="No Clips are available from this business yet."
                colors={colors}
              />
            )}
            {business.categories.length ? (
              <PressableScale
                accessibilityLabel="Explore Clips from this service category"
                onPress={() => openClips(undefined, true)}
                style={[styles.textAction, { borderColor: colors.line }]}
              >
                <Text
                  style={{
                    color: brand.accent,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  Explore more in {business.categories[0].name}
                </Text>
                <AppIcon name="chevron-right" size={16} color={brand.accent} />
              </PressableScale>
            ) : null}
          </Section>
          <Section
            number="03"
            title="The story behind it."
            colors={colors}
            onLayout={y => {
              anchors.current.About = y;
            }}
          >
            <Text
              numberOfLines={expandedAbout ? undefined : 5}
              style={[styles.body, { color: colors.muted }]}
            >
              {business.description ||
                'A complete introduction is on its way. Explore the services and connect with the team to learn more.'}
            </Text>
            {business.description && business.description.length > 240 ? (
              <PressableScale
                accessibilityLabel={
                  expandedAbout
                    ? 'Read less about business'
                    : 'Read more about business'
                }
                onPress={() => setExpandedAbout(current => !current)}
                style={styles.readMore}
              >
                <Text
                  style={{
                    color: brand.accent,
                    fontWeight: '600',
                    fontSize: 12,
                  }}
                >
                  {expandedAbout ? 'Read less' : 'Read more'}
                </Text>
              </PressableScale>
            ) : null}
            {business.yearsInBusiness !== null ? (
              <View style={[styles.aboutFact, { borderColor: colors.line }]}>
                <AppIcon name="briefcase" size={18} color={brand.accent} />
                <Text style={[styles.bodySmall, { color: colors.ink }]}>
                  {business.yearsInBusiness}{' '}
                  {business.yearsInBusiness === 1 ? 'year' : 'years'} in
                  business
                </Text>
              </View>
            ) : null}
            {business.certifications.length ? (
              <View style={styles.tags}>
                {business.certifications.map(value => (
                  <View
                    key={value}
                    style={[styles.tag, { backgroundColor: brand.soft }]}
                  >
                    <AppIcon
                      name="badge-check"
                      size={14}
                      color={brand.accent}
                    />
                    <Text
                      style={[
                        styles.micro,
                        { color: colors.ink, flexShrink: 1 },
                      ]}
                    >
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {business.languages.length ? (
              <Text style={[styles.bodySmall, { color: colors.muted }]}>
                Languages · {business.languages.join(', ')}
              </Text>
            ) : null}
          </Section>
          <Section
            number="04"
            title="Work worth seeing."
            copy="A portfolio of places, people, and possibilities."
            colors={colors}
          >
            {business.gallery.length ? (
              <View style={styles.galleryGrid}>
                {business.gallery.slice(0, 6).map((item, index) => (
                  <PressableScale
                    key={item.id}
                    accessibilityLabel={`Open business ${item.kind} ${
                      index + 1
                    }`}
                    onPress={() =>
                      setGallery({ items: business.gallery, index })
                    }
                    style={[
                      styles.galleryTile,
                      { backgroundColor: brand.soft },
                    ]}
                  >
                    {item.kind === 'image' ? (
                      <Image
                        source={{ uri: item.url }}
                        style={StyleSheet.absoluteFill}
                      />
                    ) : (
                      <AppIcon name="play" size={28} color={brand.accent} />
                    )}
                    {index === 5 && business.gallery.length > 6 ? (
                      <View style={styles.galleryMore}>
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 22,
                            fontWeight: '600',
                          }}
                        >
                          +{business.gallery.length - 6}
                        </Text>
                      </View>
                    ) : null}
                  </PressableScale>
                ))}
              </View>
            ) : (
              <Empty
                icon="images"
                title="A little more to discover soon."
                copy="This business has not added public portfolio photos or videos yet."
                colors={colors}
              />
            )}
          </Section>
          <Section
            number="05"
            title="Good words, real people."
            copy="Reviews from verified completed bookings."
            colors={colors}
            action={business.viewer.canReview ? 'Write a review' : undefined}
            onAction={() => setReviewing(true)}
            onLayout={y => {
              anchors.current.Reviews = y;
            }}
          >
            {business.rating.count > 0 && business.rating.average !== null ? (
              <View style={styles.ratingSummary}>
                <Text style={[styles.ratingNumber, { color: colors.ink }]}>
                  {business.rating.average.toFixed(1)}
                </Text>
                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', gap: 3 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <AppIcon
                        key={star}
                        name="star"
                        size={15}
                        color={brand.accent}
                        fill={
                          star <= Math.round(business.rating.average!)
                            ? brand.accent
                            : 'transparent'
                        }
                      />
                    ))}
                  </View>
                  <Text style={[styles.micro, { color: colors.muted }]}>
                    {business.rating.count} verified{' '}
                    {business.rating.count === 1 ? 'review' : 'reviews'}
                  </Text>
                </View>
              </View>
            ) : null}
            {allReviews.length ? (
              allReviews.map(review => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  colors={colors}
                  brand={brand}
                  onPhoto={index =>
                    setGallery({
                      items: review.photos.map(photo => ({
                        ...photo,
                        kind: 'image',
                      })),
                      index,
                    })
                  }
                />
              ))
            ) : (
              <Empty
                icon="star"
                title="Be part of the first chapter."
                copy="There are no verified customer reviews yet."
                colors={colors}
              />
            )}
            {reviewsQuery.isError ? (
              <Action
                label="Retry reviews"
                icon="refresh"
                onPress={() => {
                  void reviewsQuery.refetch();
                }}
                brand={brand}
                colors={colors}
              />
            ) : reviewsQuery.hasNextPage ? (
              <Action
                label="More reviews"
                icon="plus"
                onPress={() => {
                  void reviewsQuery.fetchNextPage();
                }}
                brand={brand}
                colors={colors}
                pending={reviewsQuery.isFetchingNextPage}
              />
            ) : null}
          </Section>
          <Section
            number="06"
            title="Make time for yourself."
            copy="Live booking availability, in India Standard Time."
            colors={colors}
          >
            <View style={styles.days}>
              {DAYS.map(day => {
                const working = business.availability.workingDays.some(
                  value => value.toLowerCase().slice(0, 3) === day.id,
                );
                return (
                  <View
                    key={day.id}
                    style={[
                      styles.day,
                      {
                        backgroundColor: working
                          ? brand.soft
                          : colors.background,
                        borderColor: working ? brand.line : colors.line,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        color: working ? brand.accent : colors.muted,
                        fontWeight: '600',
                      }}
                    >
                      {day.label}
                    </Text>
                    <AppIcon
                      name={working ? 'check' : 'minus'}
                      size={13}
                      color={working ? brand.accent : colors.muted}
                    />
                  </View>
                );
              })}
            </View>
            {hours ? (
              <Text style={[styles.bodySmall, { color: colors.ink }]}>
                {hours}
              </Text>
            ) : (
              <Text style={[styles.bodySmall, { color: colors.muted }]}>
                Working hours have not been published.
              </Text>
            )}
            {business.availability.nextAvailableAt ? (
              <View style={[styles.aboutFact, { borderColor: colors.line }]}>
                <AppIcon name="calendar" color={brand.accent} size={18} />
                <Text style={[styles.bodySmall, { color: colors.ink }]}>
                  Next available ·{' '}
                  {new Date(
                    business.availability.nextAvailableAt,
                  ).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: 'numeric',
                    month: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  IST
                </Text>
              </View>
            ) : null}
            {business.availability.temporarilyUnavailable ? (
              <Text style={[styles.bodySmall, { color: colors.muted }]}>
                The team is taking a pause. New bookings are temporarily
                unavailable.
              </Text>
            ) : (
              <>
                <Text style={[styles.bodySmall, { color: colors.muted }]}>
                  {business.availability.operatingStatus === 'fully_booked'
                    ? 'Today is fully booked. Choose another date to see the next available time.'
                    : 'Choose a service and date to see confirmed available times.'}
                </Text>
                <Action
                  label="View booking calendar"
                  icon="calendar"
                  onPress={() => openBooking()}
                  brand={brand}
                  colors={colors}
                  disabled={!canBook}
                />
              </>
            )}
          </Section>
          <Section
            number="07"
            title="Find your way here."
            colors={colors}
            onLayout={y => {
              anchors.current.Location = y;
            }}
          >
            {hasCoordinates ? (
              <View style={[styles.map, { backgroundColor: colors.soft }]}>
                <MapView
                  style={StyleSheet.absoluteFill}
                  initialRegion={{
                    latitude: business.location.latitude!,
                    longitude: business.location.longitude!,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                  toolbarEnabled={false}
                  liteMode
                >
                  <Marker
                    coordinate={{
                      latitude: business.location.latitude!,
                      longitude: business.location.longitude!,
                    }}
                    title={business.name}
                    pinColor={brand.accent}
                  />
                </MapView>
              </View>
            ) : null}
            <Text style={[styles.body, { color: colors.ink }]}>
              {[
                business.location.address,
                business.location.area,
                business.location.city,
                business.location.pincode,
              ]
                .filter(Boolean)
                .join(', ') || 'Ask the team for location details.'}
            </Text>
            <View style={styles.tags}>
              {[
                ...new Set(business.services.flatMap(service => service.modes)),
              ].map(mode => (
                <View
                  key={mode}
                  style={[styles.tag, { backgroundColor: colors.background }]}
                >
                  <AppIcon
                    name={
                      mode === 'online'
                        ? 'globe'
                        : mode === 'home'
                        ? 'home'
                        : 'location'
                    }
                    size={14}
                    color={brand.accent}
                  />
                  <Text style={[styles.micro, { color: colors.ink }]}>
                    {mode === 'online'
                      ? 'Online sessions'
                      : mode === 'home'
                      ? 'Home visits'
                      : 'On-site'}
                  </Text>
                </View>
              ))}
              {business.location.serviceRadiusKm !== null ? (
                <View
                  style={[styles.tag, { backgroundColor: colors.background }]}
                >
                  <Text style={[styles.micro, { color: colors.ink }]}>
                    Within {business.location.serviceRadiusKm} km
                  </Text>
                </View>
              ) : null}
            </View>
            {hasCoordinates ? (
              <Action
                label={distance ?? 'Show distance'}
                icon="location"
                onPress={() => {
                  void locate();
                }}
                brand={brand}
                colors={colors}
                pending={locating}
              />
            ) : null}
            {directions ? (
              <Action
                label="Get directions"
                icon="location"
                onPress={() => {
                  void Linking.openURL(directions).catch(showError);
                }}
                brand={brand}
                colors={colors}
              />
            ) : null}
          </Section>
          {business.products.length ? (
            <Section
              number="08"
              title="Curated by the business."
              copy="Approved products, selected with care."
              colors={colors}
            >
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {business.products.map(product => (
                  <PressableScale
                    key={product.id}
                    accessibilityLabel={`View ${product.name}`}
                    onPress={() =>
                      navigation.navigate('ProductDetail', {
                        productId: product.id,
                      })
                    }
                    style={[
                      styles.product,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    {product.imageUrl ? (
                      <Image
                        source={{ uri: product.imageUrl }}
                        style={styles.productImage}
                      />
                    ) : (
                      <View
                        style={[
                          styles.productImage,
                          styles.videoArt,
                          { backgroundColor: brand.soft },
                        ]}
                      >
                        <AppIcon
                          name="shopping-bag"
                          size={28}
                          color={brand.accent}
                        />
                      </View>
                    )}
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.serviceTitle,
                        { color: colors.ink, fontSize: 14 },
                      ]}
                    >
                      {product.name}
                    </Text>
                    <Text style={[styles.bodySmall, { color: colors.muted }]}>
                      {businessPrice(product.price)}
                    </Text>
                  </PressableScale>
                ))}
              </ScrollView>
            </Section>
          ) : null}
          {business.events.length ? (
            <Section
              number="09"
              title="Something to look forward to."
              copy="Upcoming experiences from this business."
              colors={colors}
            >
              {business.events.map(event => (
                <PressableScale
                  key={event.id}
                  accessibilityLabel={`View ${event.title}`}
                  onPress={() =>
                    navigation.navigate('EventDetail', { eventId: event.id })
                  }
                  style={[styles.event, { backgroundColor: colors.background }]}
                >
                  <View
                    style={[
                      styles.serviceIcon,
                      { backgroundColor: brand.soft },
                    ]}
                  >
                    <AppIcon name="calendar" color={brand.accent} size={22} />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={[styles.serviceTitle, { color: colors.ink }]}>
                      {event.title}
                    </Text>
                    <Text style={[styles.micro, { color: colors.muted }]}>
                      {new Date(event.startsAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {event.locationLabel ? ` · ${event.locationLabel}` : ''}
                    </Text>
                  </View>
                  <AppIcon
                    name="chevron-right"
                    size={18}
                    color={brand.accent}
                  />
                </PressableScale>
              ))}
            </Section>
          ) : null}
          <View style={styles.closing}>
            <AppIcon name="verified" size={19} color={brand.accent} />
            <Text style={[styles.closingText, { color: colors.muted }]}>
              An approved business. A real connection.
            </Text>
            <Text style={[styles.closingBrand, { color: colors.ink }]}>
              Knock.
            </Text>
          </View>
        </View>
      </ScrollView>
      {compactHeader ? (
        <View
          testID="business-compact-header"
          style={[
            styles.compactBar,
            {
              backgroundColor: colors.surface,
              borderColor: colors.line,
              paddingTop: insets.top + 5,
            },
          ]}
        >
          <PressableScale
            accessibilityLabel="Back"
            onPress={goBack}
            style={styles.menuClose}
          >
            <AppIcon name="back" size={23} color={colors.ink} />
          </PressableScale>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              color: colors.ink,
              fontWeight: '600',
              fontSize: 14,
            }}
          >
            {business.name}
          </Text>
          <PressableScale
            accessibilityLabel="More business options"
            onPress={() => setMore(true)}
            style={styles.menuClose}
          >
            <AppIcon name="more" size={22} color={colors.ink} />
          </PressableScale>
        </View>
      ) : null}
      <View
        testID="business-booking-footer"
        onLayout={event =>
          setFooterHeight(Math.round(event.nativeEvent.layout.height))
        }
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.line,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.micro, { color: colors.muted }]}>
            {isMember ? 'YOUR BUSINESS WORKSPACE' : 'YOUR NEXT GOOD EXPERIENCE'}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.footerPrice, { color: colors.ink }]}
          >
            {isMember
              ? business.name
              : availableServices.length
              ? businessPrice(
                  availableServices.reduce<number | null>(
                    (minimum, service) =>
                      service.price === null
                        ? minimum
                        : minimum === null
                        ? service.price
                        : Math.min(minimum, service.price),
                    null,
                  ),
                )
              : 'No services available'}
          </Text>
        </View>
        <Action
          label={isMember ? ownerPrimaryLabel : 'Book now'}
          icon={
            isMember
              ? manageSection === 'analytics'
                ? 'activity'
                : manageSection
                ? 'settings'
                : 'reels'
              : 'calendar'
          }
          onPress={() => (isMember ? openOwnerPrimary() : openBooking())}
          brand={brand}
          colors={colors}
          primary
          disabled={isMember ? !ownerControls : !canBook}
        />
      </View>
      {notice ? (
        <PressableScale
          accessibilityLabel="Dismiss business notice"
          onPress={() => setNotice(null)}
          style={[
            styles.notice,
            {
              backgroundColor: colors.surface,
              borderColor: brand.line,
              bottom: footerHeight + 12,
            },
          ]}
        >
          <Text
            accessibilityRole="alert"
            style={{ color: colors.ink, flex: 1, lineHeight: 20 }}
          >
            {notice}
          </Text>
          <AppIcon name="close" color={colors.muted} size={16} />
        </PressableScale>
      ) : null}
      <BusinessMediaViewer
        items={gallery?.items ?? []}
        initialIndex={gallery?.index ?? null}
        onClose={() => setGallery(null)}
      />
      <BusinessReviewComposer
        key={`${providerId}-${user.id}-${viewer?.type}-${viewer?.id}`}
        providerId={providerId}
        visible={reviewing}
        brand={brand}
        bookings={bookings}
        identity={personal}
        onClose={() => setReviewing(false)}
        onSubmit={payload => createReview.mutateAsync(payload)}
      />
      <Modal
        visible={more || reporting}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!report.isPending) {
            setMore(false);
            setReporting(false);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: '92%' }}
            contentContainerStyle={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                paddingBottom: insets.bottom + 20,
              },
            ]}
          >
            <View style={styles.menuHeading}>
              <Text style={[styles.sectionTitle, { color: colors.ink }]}>
                {reporting ? 'Report business' : business.name}
              </Text>
              <PressableScale
                disabled={report.isPending}
                accessibilityLabel="Close business menu"
                onPress={() => {
                  setMore(false);
                  setReporting(false);
                }}
                style={styles.menuClose}
              >
                <AppIcon name="close" size={22} color={colors.ink} />
              </PressableScale>
            </View>
            {reporting ? (
              <>
                <Text style={[styles.bodySmall, { color: colors.muted }]}>
                  Tell us what needs a closer look. Reports are reviewed by the
                  moderation team.
                </Text>
                {REPORT_REASONS.map(reason => (
                  <PressableScale
                    key={reason.id}
                    disabled={report.isPending}
                    accessibilityLabel={reason.label}
                    accessibilityState={{
                      selected: reportReason === reason.id,
                    }}
                    onPress={() => setReportReason(reason.id)}
                    style={styles.menuRow}
                  >
                    <AppIcon
                      name={
                        reportReason === reason.id ? 'check-circle' : 'flag'
                      }
                      size={18}
                      color={
                        reportReason === reason.id ? brand.accent : colors.muted
                      }
                    />
                    <Text style={[styles.bodySmall, { color: colors.ink }]}>
                      {reason.label}
                    </Text>
                  </PressableScale>
                ))}
                <TextInput
                  accessibilityLabel="Business report details"
                  editable={!report.isPending}
                  value={reportDetails}
                  onChangeText={setReportDetails}
                  multiline
                  maxLength={2000}
                  placeholder="Add details (optional)"
                  placeholderTextColor={colors.muted}
                  style={[
                    styles.reportInput,
                    { borderColor: colors.line, color: colors.ink },
                  ]}
                />
                {notice ? (
                  <Text
                    accessibilityRole="alert"
                    style={{ color: colors.error }}
                  >
                    {notice}
                  </Text>
                ) : null}
                <Action
                  label="Send report"
                  icon="flag"
                  onPress={() => void submitReport()}
                  brand={brand}
                  colors={colors}
                  primary
                  pending={report.isPending}
                />
              </>
            ) : (
              <>
                <MenuRow
                  label="Share profile"
                  icon="share"
                  colors={colors}
                  onPress={doShare}
                />
                <MenuRow
                  label="Copy profile link"
                  icon="clipboard"
                  colors={colors}
                  onPress={() => {
                    Clipboard.setString(businessProfileLink(providerId));
                    setMore(false);
                    setNotice('Profile link copied.');
                  }}
                />
                <MenuRow
                  label="Report business"
                  icon="flag"
                  colors={colors}
                  onPress={() => {
                    setNotice(null);
                    setReporting(true);
                  }}
                />
                {!isMember ? (
                  <MenuRow
                    label="Block business"
                    icon="lock"
                    colors={colors}
                    onPress={block}
                    destructive
                  />
                ) : null}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MenuRow({
  label,
  icon,
  onPress,
  colors,
  destructive,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  colors: Colors;
  destructive?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.menuRow}
    >
      <AppIcon
        name={icon}
        size={19}
        color={destructive ? colors.error : colors.ink}
      />
      <Text
        style={{ color: destructive ? colors.error : colors.ink, fontSize: 14 }}
      >
        {label}
      </Text>
    </PressableScale>
  );
}
function ReviewCard({
  review,
  colors,
  brand,
  onPhoto,
}: {
  review: BusinessReview;
  colors: Colors;
  brand: BusinessBrand;
  onPhoto: (index: number) => void;
}) {
  return (
    <View style={[styles.review, { borderColor: colors.line }]}>
      <View style={styles.reviewHeader}>
        {review.author.avatarUrl ? (
          <Image
            source={{ uri: review.author.avatarUrl }}
            style={styles.reviewAvatar}
          />
        ) : (
          <View
            style={[
              styles.reviewAvatar,
              styles.videoArt,
              { backgroundColor: brand.soft },
            ]}
          >
            <Text style={{ color: brand.accent, fontWeight: '600' }}>
              {review.author.displayName.charAt(0)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>
            {review.author.displayName}
          </Text>
          <Text style={[styles.micro, { color: colors.muted }]}>
            {new Date(review.createdAt).toLocaleDateString('en-IN')} · Verified
            booking
          </Text>
        </View>
        <View style={styles.factRating}>
          <AppIcon name="star" size={12} color={brand.accent} />
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: '600' }}>
            {review.rating}
          </Text>
        </View>
      </View>
      <Text style={[styles.body, { color: colors.ink }]}>{review.body}</Text>
      <Text style={[styles.micro, { color: colors.muted }]}>
        {review.serviceTitle}
      </Text>
      {review.photos.length ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {review.photos.map((photo, index) => (
            <PressableScale
              key={photo.id}
              accessibilityLabel={`Open customer photo ${index + 1}`}
              onPress={() => onPhoto(index)}
            >
              <Image source={{ uri: photo.url }} style={styles.reviewPhoto} />
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fullState: {
    flex: 1,
    paddingHorizontal: 28,
    gap: 20,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  stateTitle: {
    fontSize: 29,
    lineHeight: 36,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    textAlign: 'center',
  },
  compactBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  social: {
    paddingHorizontal: 24,
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 20,
  },
  action: {
    minHeight: 46,
    minWidth: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexShrink: 1,
  },
  actionLabel: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  stats: { flexDirection: 'row', paddingBottom: 24, paddingHorizontal: 24 },
  stat: { flex: 1, alignItems: 'center', gap: 5 },
  statValue: { fontSize: 19, fontWeight: '600' },
  statLabel: { fontSize: 10 },
  notice: {
    position: 'absolute',
    left: 20,
    right: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#13251B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workspace: {
    marginHorizontal: 20,
    marginTop: 20,
    padding: 20,
    borderRadius: 24,
    gap: 14,
  },
  workspaceEyebrow: {
    color: '#E2D4B7',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  workspaceTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  ownerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ownerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF12',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF2B',
  },
  ownerLabel: { color: '#F7F2E8', fontSize: 11, fontWeight: '500' },
  jumpLinks: { paddingHorizontal: 20, gap: 8, paddingVertical: 20 },
  jump: {
    minHeight: 44,
    paddingHorizontal: 17,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpText: { fontSize: 12, fontWeight: '600' },
  sections: { paddingHorizontal: 20, gap: 16 },
  section: {
    padding: 20,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 18,
  },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIndex: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.4,
  },
  sectionCopy: { marginTop: 6, fontSize: 12, lineHeight: 19 },
  sectionLink: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  linkText: { fontSize: 11, fontWeight: '600' },
  empty: { borderRadius: 18, padding: 20, alignItems: 'center', gap: 10 },
  emptyIcon: {
    height: 46,
    width: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { fontSize: 12, lineHeight: 20, textAlign: 'center' },
  service: {
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 18,
  },
  serviceTop: { flexDirection: 'row', gap: 12 },
  serviceTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  bodySmall: { fontSize: 12, lineHeight: 20 },
  serviceMeta: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  micro: { fontSize: 10, lineHeight: 17 },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '600', marginTop: 3 },
  clip: { height: 216, width: 132, borderRadius: 18, overflow: 'hidden' },
  videoArt: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    left: 12,
    top: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00000060',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipCaption: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '500',
    backgroundColor: '#102419A0',
    padding: 7,
    borderRadius: 8,
    lineHeight: 16,
  },
  textAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
  },
  body: { fontSize: 13, lineHeight: 22 },
  readMore: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  aboutFact: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    maxWidth: '100%',
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryTile: {
    width: '48%',
    aspectRatio: 1.1,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryMore: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#142C20A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    paddingBottom: 10,
  },
  ratingNumber: {
    fontSize: 54,
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  review: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, gap: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 38, height: 38, borderRadius: 19, flex: 0 },
  factRating: { flexDirection: 'row', gap: 3, alignItems: 'center' },
  reviewPhoto: { height: 66, width: 66, borderRadius: 12 },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  day: {
    minWidth: 33,
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 11,
  },
  map: { height: 185, borderRadius: 18, overflow: 'hidden' },
  product: { width: 150, borderRadius: 18, padding: 10, gap: 8 },
  productImage: { height: 135, width: 130, borderRadius: 12, flex: 0 },
  event: {
    padding: 13,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closing: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  closingText: { fontSize: 11 },
  closingBrand: {
    fontSize: 26,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: { fontSize: 16, marginTop: 3, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#06140EB0',
    justifyContent: 'flex-end',
  },
  menu: {
    padding: 24,
    gap: 7,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  menuHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  menuClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRow: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  reportInput: {
    minHeight: 78,
    maxHeight: 150,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
});
