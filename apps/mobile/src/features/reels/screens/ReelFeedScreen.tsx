import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  Alert,
  ActivityIndicator,
  Share,
  useWindowDimensions,
  View,
  ViewToken,
} from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import {
  ClipMoreAction,
  ClipMoreSheet,
} from '@/features/reels/components/ClipMoreSheet';
import { GuidedReportVideoSheet } from '@/features/reels/components/GuidedReportVideoSheet';
import { ReelItem } from '@/shared/types';
import { useCartStore } from '@/shared/store/cartStore';
import {
  blockProfile,
  listBlockedProfiles,
  reportContentPost,
  reportReel,
} from '@/shared/api/reelSafety';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useClipPlaybackStore } from '@/shared/store/clipPlaybackStore';
import { useQueryClient } from '@tanstack/react-query';
import {
  deleteContentClip,
  useProfileClipReelsQuery,
  useProviderCategoryClipsQuery,
  useReelsQuery,
} from '@/shared/api/hooks';
import { evictDeletedClipFromCaches } from '@/shared/api/clipCacheEviction';
import { useLivePendingClips } from '@/shared/realtime/useLiveContent';
import { clipShareUrl } from '@/features/reels/feed/clipShare';
import { canDeleteClip, withoutHiddenClips } from './clipOwnership';
import { useContentProfileQuery } from '@/shared/api/storyHooks';
import { useProfileFollowMutation } from '@/shared/api/profileFollows';
import { createOrGetChannel } from '@/shared/api/messagesClient';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import {
  createAnalyticsEventId,
  recordReelAnalyticsEvent,
} from '@/shared/api/reelAnalytics';
import {
  recordContentClipView,
  setContentClipLike,
} from '@/shared/api/contentEngagement';
import { useTabBarBottomInset } from '@/shared/navigation/tabBarInset';
import type {
  MainTabParamList,
  RootStackParamList,
} from '@/shared/navigation/types';
import { CommentsBottomSheetHost } from '@/shared/navigation/CommentsBottomSheetHost';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import {
  buildLoopedClipFeed,
  mergeLoadedReelPages,
  type LoopedClipFeedEntry,
} from './clipFeedLoop';

const DEFAULT_AUTHOR_AVATAR =
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&h=200&q=80';
const MINIMUM_VIEW_WATCH_MS = 2_000;
const EMPTY_REELS: ReelItem[] = [];

function profileKey(profile: NonNullable<ReelItem['authorProfile']>) {
  return `${profile.type}:${profile.id}`;
}

function getAuthorAvatar(item: ReelItem) {
  return item.authorAvatarUrl ?? DEFAULT_AUTHOR_AVATAR;
}

function formatCount(n: number) {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Product clips → Shop; service/trip clips → Book. */
function getReelAction(item: ReelItem): 'cart' | 'book' | 'trip' | null {
  const t = item.bookTarget;
  if (!t) return null;
  if (t.cta === 'cart' || t.entityType === 'product') return 'cart';
  if (t.cta === 'trip') return 'trip';
  return 'book';
}

function SideAction({
  icon,
  label,
  active,
  activeColor,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  label?: string;
  active?: boolean;
  activeColor?: string;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.sideAction}>
        <View style={styles.sideIconCircle}>
          <AppIcon
            name={icon}
            size={24}
            color={active ? activeColor ?? '#FB7185' : '#FFFFFF'}
            strokeWidth={active ? 2.2 : 1.85}
          />
        </View>
        {label != null && label !== '' ? (
          <Text style={styles.sideLabel}>{String(label)}</Text>
        ) : null}
      </View>
    </PressableScale>
  );
}

function TopChromeButton({
  icon,
  onPress,
  accessibilityLabel,
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.topBtn}>
        <AppIcon name={icon} size={22} color="#fff" strokeWidth={1.85} />
      </View>
    </PressableScale>
  );
}

/**
 * Social actions stay on the Clip itself, so viewers can follow or start a
 * profile-scoped conversation without first opening the profile tab.
 */
function ClipCreatorActions({ item }: { item: ReelItem }) {
  const navigation = useNavigation<any>();
  const { active } = useActiveProfile();
  const { isReady: chatReady } = useStreamChat();
  const [openingChat, setOpeningChat] = useState(false);
  const target = item.authorProfile
    ? {
        id: item.authorProfile.id,
        type: item.authorProfile.type === 'business' ? ('business' as const) : ('personal' as const),
      }
    : null;
  const viewer = active
    ? { id: active.id, type: identityProfileType(active) }
    : null;
  const profileQuery = useContentProfileQuery(target?.type, target?.id, viewer);
  const profile = profileQuery.data;
  const relationship = profile?.relationship;
  const followMutation = useProfileFollowMutation(viewer, target);
  const isOwnProfile = Boolean(profile?.viewerCanManage) || Boolean(target && viewer && target.id === viewer.id && target.type === viewer.type);

  if (!target || isOwnProfile) return null;

  const status = relationship?.followStatus;
  const label = status === 'following' ? 'Following' : status === 'requested' ? 'Requested' : 'Follow';
  const canMessage = chatReady && relationship?.canMessage === true;

  const updateFollow = (action: 'follow' | 'unfollow') => {
    followMutation.mutate(action, {
      onError: error => {
        Alert.alert('Couldn’t update follow', error instanceof Error ? error.message : 'Please try again.');
      },
    });
  };

  const onFollowPress = () => {
    if (!relationship?.canFollow || followMutation.isPending) return;
    if (status === 'following' || status === 'requested') {
      Alert.alert(label, undefined, [
        { text: status === 'requested' ? 'Cancel request' : 'Unfollow', style: 'destructive', onPress: () => updateFollow('unfollow') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    updateFollow('follow');
  };

  const onMessagePress = async () => {
    if (!viewer || !target || !canMessage || openingChat) return;
    setOpeningChat(true);
    try {
      const result = await createOrGetChannel(target, viewer);
      navigation.navigate('Thread', {
        conversationId: result.channelId,
        channelId: result.channelId,
        profile: result.profile,
      });
    } catch (error) {
      Alert.alert('Couldn’t open chat', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setOpeningChat(false);
    }
  };

  return (
    <View style={styles.creatorActions}>
      <PressableScale
        accessibilityLabel={`${label} ${item.author}`}
        accessibilityState={{ disabled: followMutation.isPending || !relationship?.canFollow }}
        disabled={followMutation.isPending || !relationship?.canFollow}
        onPress={onFollowPress}
        style={[styles.creatorActionButton, status === 'following' || status === 'requested' ? styles.creatorActionSecondary : styles.creatorActionPrimary]}>
        {followMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name={status === 'following' ? 'follow' : 'user'} size={15} color="#fff" strokeWidth={2} />}
        <Text style={styles.creatorActionText}>{label}</Text>
      </PressableScale>
      <PressableScale
        accessibilityLabel={`Message ${item.author}`}
        accessibilityState={{ disabled: !canMessage || openingChat }}
        disabled={!canMessage || openingChat}
        onPress={() => void onMessagePress()}
        style={[styles.creatorActionButton, styles.creatorActionSecondary, (!canMessage || openingChat) ? styles.creatorActionDisabled : {}]}>
        {openingChat ? <ActivityIndicator size="small" color="#fff" /> : <AppIcon name="message-circle" size={15} color="#fff" strokeWidth={2} />}
        <Text style={styles.creatorActionText}>Message</Text>
      </PressableScale>
    </View>
  );
}

function VerticalFade({
  width,
  height,
  fromTop,
}: {
  width: number;
  height: number;
  fromTop: boolean;
}) {
  const id = fromTop ? 'clipsTopFade' : 'clipsBottomFade';
  const stops = fromTop
    ? [
        { offset: '0', opacity: '0.72' },
        { offset: '0.55', opacity: '0.28' },
        { offset: '1', opacity: '0' },
      ]
    : [
        { offset: '0', opacity: '0' },
        { offset: '0.35', opacity: '0.35' },
        { offset: '1', opacity: '0.82' },
      ];

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          {stops.map(s => (
            <Stop
              key={s.offset}
              offset={s.offset}
              stopColor="#000"
              stopOpacity={parseFloat(s.opacity)}
            />
          ))}
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export function ReelFeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<
    | RouteProp<MainTabParamList, 'PlayFeed'>
    | RouteProp<RootStackParamList, 'ProviderClips'>
  >();
  const params = route.params as
    | {
        reelId?: string;
        q?: string;
        profileType?: 'personal' | 'business';
        profileId?: string;
        providerId?: string;
        serviceCategoryId?: string;
        providerName?: string;
        exploreSimilar?: boolean;
        providerHasClips?: boolean;
      }
    | undefined;
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Keep each page tied to the window, not to a descendant `onLayout` event.
  // AVPlayer can cause an otherwise harmless native relayout when it becomes
  // ready or changes playback state. Feeding that transient layout back into
  // FlatList changes `getItemLayout` while its content offset is still based
  // on the old page size, which makes the current clip visibly jump.
  const pageWidth = Math.max(1, Math.round(windowWidth));
  const pageHeight = Math.max(1, Math.round(windowHeight));
  const addToCart = useCartStore(s => s.add);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackCycle, setPlaybackCycle] = useState(0);
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [menuReelId, setMenuReelId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<NonNullable<
    ReelItem['reportTarget']
  > | null>(null);
  const [blockedProfileKeys, setBlockedProfileKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());
  const queryClient = useQueryClient();
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [autoScroll, setAutoScroll] = useState(false);
  const [showSimilarProviders, setShowSimilarProviders] = useState(
    params?.exploreSimilar === true,
  );
  useEffect(() => {
    setShowSimilarProviders(params?.exploreSimilar === true);
  }, [params?.exploreSimilar, params?.providerId]);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [coins] = useState(120);
  const viewedReelIds = useRef(new Set<string>());
  const completedReelIds = useRef(new Set<string>());
  const likedByIdRef = useRef<Record<string, boolean>>({});
  const likeCountByIdRef = useRef<Record<string, number>>({});
  const likeRequestVersions = useRef<Record<string, number>>({});
  const listRef = useRef<FlatList<LoopedClipFeedEntry>>(null);
  const currentIndexRef = useRef(currentIndex);
  const loopedFeedRef = useRef<LoopedClipFeedEntry[]>([]);
  const activeReelIdRef = useRef<string | null>(null);
  const feedSignatureRef = useRef('');
  const loopJumpPendingRef = useRef(false);
  const pageFrameRef = useRef({ width: pageWidth, height: pageHeight });
  const analyticsSessionId = useRef<string | null>(null);
  if (!analyticsSessionId.current) {
    analyticsSessionId.current = createAnalyticsEventId();
  }
  const commentsOpen = useCommentsSheetStore(
    s => (s.open || s.closing) && s.sourceType === 'clip',
  );
  const playbackActive = useCommentsSheetStore(s => s.playbackActive);
  const openComments = useCommentsSheetStore(s => s.openComments);
  const commentCounts = useEngagementStore(s => s.commentCounts);
  const setActiveClip = useClipPlaybackStore(s => s.setActiveClip);
  const updateClipProgress = useClipPlaybackStore(s => s.updateProgress);
  const registerClipSeekController = useClipPlaybackStore(
    s => s.registerSeekController,
  );
  const clearClipPlayback = useClipPlaybackStore(s => s.clear);
  const providerPlayback = route.name === 'ProviderClips';
  const profilePlayback = Boolean(
    !providerPlayback && params?.profileType && params?.profileId,
  );
  const { active: activeViewerProfile } = useActiveProfile();
  const activeViewer = useMemo(
    () =>
      activeViewerProfile
        ? {
            id: activeViewerProfile.id,
            type: identityProfileType(activeViewerProfile),
          }
        : undefined,
    [activeViewerProfile],
  );
  const globalReelsQuery = useReelsQuery(
    !profilePlayback && !providerPlayback,
    activeViewer,
  );
  const profileReelsQuery = useProfileClipReelsQuery(
    profilePlayback ? params?.profileType : undefined,
    profilePlayback ? params?.profileId : undefined,
    activeViewer,
  );
  const providerReelsQuery = useProviderCategoryClipsQuery(
    providerPlayback ? params?.providerId : undefined,
    providerPlayback ? params?.serviceCategoryId : undefined,
    activeViewer,
  );
  // `loadedReels` is the one canonical collection used by the global feed.
  // It only contains server-published Clips and preserves page order
  // (publishedAt DESC) while removing overlap caused by refreshes/cursors.
  const loadedReels = useMemo(
    () =>
      mergeLoadedReelPages(
        (globalReelsQuery.data?.pages ?? []).map(page => page.items),
      ),
    [globalReelsQuery.data?.pages],
  );
  const loadedProviderReels = useMemo(
    () =>
      mergeLoadedReelPages(
        (providerReelsQuery.data?.pages ?? []).map(page => page.items),
      ),
    [providerReelsQuery.data?.pages],
  );
  const viewerSuffix = activeViewerProfile
    ? `&viewerProfileType=${encodeURIComponent(identityProfileType(activeViewerProfile))}&viewerProfileId=${encodeURIComponent(activeViewerProfile.id)}`
    : '';
  const live = useLivePendingClips({
    enabled: !profilePlayback && !providerPlayback,
    loadedReels,
    viewerSuffix,
  });
  const jumpToTopRef = useRef(false);
  const revealedReelIdRef = useRef<string | null>(null);
  const queriedReels = providerPlayback
    ? params?.providerHasClips === false && !showSimilarProviders
      ? EMPTY_REELS
      : loadedProviderReels
    : profilePlayback
      ? profileReelsQuery.data
      : loadedReels;
  const refetch = providerPlayback
    ? providerReelsQuery.refetch
    : profilePlayback
      ? profileReelsQuery.refetch
      : globalReelsQuery.refetch;
  const refreshingPlaybackUrlsRef = useRef(false);
  const refreshPlaybackUrls = useCallback(async () => {
    if (refreshingPlaybackUrlsRef.current) return;
    refreshingPlaybackUrlsRef.current = true;
    try {
      await refetch();
    } finally {
      refreshingPlaybackUrlsRef.current = false;
    }
  }, [refetch]);
  const pagedQuery = providerPlayback ? providerReelsQuery : globalReelsQuery;
  const hasNextPage = !profilePlayback && Boolean(pagedQuery.hasNextPage);
  const isFetchingNextPage = !profilePlayback && pagedQuery.isFetchingNextPage;
  const hasReachedEndOfServerFeed = profilePlayback
    ? true
    : Boolean(pagedQuery.data) &&
      !hasNextPage &&
      !isFetchingNextPage;
  // Content-feed results are already block-filtered on the server. Also hydrate
  // the local block list so newly blocked profiles hide immediately.
  useEffect(() => {
    let active = true;

    listBlockedProfiles()
      .then(blocks => {
        if (!active) return;
        setBlockedProfileKeys(previous => {
          const next = new Set(previous);
          let changed = false;
          for (const block of blocks) {
            const key = profileKey(block);
            if (!next.has(key)) {
              next.add(key);
              changed = true;
            }
          }
          return changed ? next : previous;
        });
      })
      // A signed-out, offline, or older-server session must not prevent the
      // feed from rendering. A newly created local block still hides at once.
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);
  // Keep the empty state referentially stable so a loading/refetch transition
  // cannot make FlatList think its data changed and recalculate its viewport.
  const feedReels = queriedReels ?? EMPTY_REELS;
  const feedLoading = providerPlayback
    ? params?.providerHasClips === false && !showSimilarProviders
      ? false
      : providerReelsQuery.isLoading
    : profilePlayback
      ? profileReelsQuery.isLoading
      : globalReelsQuery.isLoading;
  const feedError = providerPlayback
    ? params?.providerHasClips === false && !showSimilarProviders
      ? null
      : providerReelsQuery.error
    : profilePlayback
      ? profileReelsQuery.error
      : globalReelsQuery.error;
  const genieQ = params?.q?.trim().toLowerCase();
  const reels = useMemo(() => {
    const visibleReels = withoutHiddenClips(feedReels, hiddenIds).filter(
      reel =>
        !reel.authorProfile ||
        !blockedProfileKeys.has(profileKey(reel.authorProfile)),
    );
    if (!genieQ) return visibleReels;
    return visibleReels.filter(
      r =>
        r.title?.toLowerCase().includes(genieQ) ||
        r.caption?.toLowerCase().includes(genieQ) ||
        r.author?.toLowerCase().includes(genieQ),
    );
  }, [blockedProfileKeys, feedReels, genieQ, hiddenIds]);
  const loopedReels = useMemo(
    () => buildLoopedClipFeed(reels, hasReachedEndOfServerFeed),
    [hasReachedEndOfServerFeed, reels],
  );
  loopedFeedRef.current = loopedReels;

  useEffect(() => {
    const signature = reels.map(reel => reel.id).join('|');
    const previousSignature = feedSignatureRef.current;
    feedSignatureRef.current = signature;
    if (!previousSignature || previousSignature === signature) return;

    const retainedIndex = activeReelIdRef.current
      ? reels.findIndex(reel => reel.id === activeReelIdRef.current)
      : -1;
    const jumpToTop = jumpToTopRef.current;
    jumpToTopRef.current = false;
    const nextIndex = !jumpToTop && retainedIndex >= 0 ? retainedIndex : 0;
    currentIndexRef.current = nextIndex;
    activeReelIdRef.current = reels[nextIndex]?.id ?? null;
    setCurrentIndex(nextIndex);
    setPlaybackCycle(cycle => cycle + 1);
    requestAnimationFrame(() => {
      if (reels.length) {
        listRef.current?.scrollToIndex({ index: nextIndex, animated: false });
      }
    });
  }, [reels]);

  useEffect(() => {
    const activeEntry = loopedReels[currentIndex];
    activeReelIdRef.current = activeEntry?.reel.id ?? null;
    setActiveClip(activeEntry?.reel.id ?? null);
  }, [currentIndex, loopedReels, setActiveClip]);

  useEffect(() => clearClipPlayback, [clearClipPlayback]);

  useEffect(() => {
    const reelId = params?.reelId;
    if (!reelId || !reels.length) return;
    const idx = reels.findIndex(r => r.id === reelId);
    if (
      idx < 0 &&
      !profilePlayback &&
      !providerPlayback &&
      revealedReelIdRef.current !== reelId &&
      globalReelsQuery.isSuccess
    ) {
      // A shared link can point at a clip that is not in the loaded pages.
      revealedReelIdRef.current = reelId;
      jumpToTopRef.current = true;
      live.revealClip(reelId).then(
        found => {
          if (!found) jumpToTopRef.current = false;
        },
        () => {
          jumpToTopRef.current = false;
        },
      );
      return;
    }
    if (idx >= 0) {
      currentIndexRef.current = idx;
      setCurrentIndex(idx);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.reelId, providerPlayback, reels]);

  const tabBarBottomSafe = useTabBarBottomInset(20);
  const bottomSafe = providerPlayback
    ? Math.max(insets.bottom, 8) + 20
    : tabBarBottomSafe;
  const topFadeH = insets.top + 96;
  const bottomFadeH = bottomSafe + 160;

  // Device rotation, split-screen resizing, and Dynamic Type/window changes
  // are legitimate page-frame changes. Re-anchor the current page exactly
  // once for those changes instead of allowing FlatList to retain a stale
  // offset. Normal video ready/play/pause events do not change this frame.
  useEffect(() => {
    const previous = pageFrameRef.current;
    if (previous.width === pageWidth && previous.height === pageHeight) {
      return;
    }

    pageFrameRef.current = { width: pageWidth, height: pageHeight };
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: currentIndexRef.current * pageHeight,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [pageHeight, pageWidth]);

  const trackPlayback = useCallback(
    (reel: ReelItem, watchedMs: number, completed: boolean) => {
      if (!Number.isFinite(watchedMs) || watchedMs < 0) return;

      const reelId = reel.id;
      const contentPostId =
        reel.reportTarget?.kind === 'content_post'
          ? reel.reportTarget.id
          : null;
      const shouldRecordView =
        !viewedReelIds.current.has(reelId) &&
        (watchedMs >= MINIMUM_VIEW_WATCH_MS || completed);
      if (shouldRecordView) {
        viewedReelIds.current.add(reelId);
        if (contentPostId) {
          // Content Clips have a server-owned, idempotent view counter. A
          // completed Clip is still only one view, not a second completion
          // event, so ranking cannot be inflated by a single playback.
          recordContentClipView(contentPostId, {
            eventId: createAnalyticsEventId(),
            watchedMs: Math.max(MINIMUM_VIEW_WATCH_MS, watchedMs),
          }).catch(() => undefined);
          return;
        }

        // Legacy Reels retain their existing analytics contract.
        recordReelAnalyticsEvent(reelId, {
          eventType: 'view',
          watchedMs,
          completed: false,
          sessionId: analyticsSessionId.current ?? undefined,
        }).catch(() => undefined);
      }

      if (contentPostId) return;

      if (completed && !completedReelIds.current.has(reelId)) {
        completedReelIds.current.add(reelId);
        recordReelAnalyticsEvent(reelId, {
          eventType: 'view',
          watchedMs,
          completed: true,
          sessionId: analyticsSessionId.current ?? undefined,
        }).catch(() => undefined);
      }
    },
    [],
  );

  const toggleLike = useCallback((item: ReelItem) => {
    const isCurrentlyLiked = likedByIdRef.current[item.id] ?? !!item.liked;
    const nextLiked = !isCurrentlyLiked;
    const contentPostId =
      item.reportTarget?.kind === 'content_post' ? item.reportTarget.id : null;
    const previousLikeCount =
      likeCountByIdRef.current[item.id] ?? item.likeCount;
    const requestVersion = (likeRequestVersions.current[item.id] ?? 0) + 1;
    likeRequestVersions.current[item.id] = requestVersion;
    likedByIdRef.current[item.id] = nextLiked;
    const nextLikeCount = Math.max(0, previousLikeCount + (nextLiked ? 1 : -1));
    likeCountByIdRef.current[item.id] = nextLikeCount;

    setLiked(previous => ({ ...previous, [item.id]: nextLiked }));
    setLikeCounts(previous => ({
      ...previous,
      [item.id]: nextLikeCount,
    }));

    if (!contentPostId) return;

    setContentClipLike(contentPostId, nextLiked, activeViewer)
      .then(result => {
        // A quick double-tap can cause responses to arrive out of order.
        // Only the latest set-state response may reconcile the UI.
        if (likeRequestVersions.current[item.id] !== requestVersion) {
          return;
        }
        // The engagement helper returns null for a handled network/API error.
        // Treat it like a rejected request so an unsaved like never remains
        // visible as though it reached the server.
        if (!result) {
          likedByIdRef.current[item.id] = isCurrentlyLiked;
          likeCountByIdRef.current[item.id] = previousLikeCount;
          setLiked(previous => ({ ...previous, [item.id]: isCurrentlyLiked }));
          setLikeCounts(previous => ({
            ...previous,
            [item.id]: previousLikeCount,
          }));
          return;
        }
        likedByIdRef.current[item.id] = result.liked;
        setLiked(previous => ({ ...previous, [item.id]: result.liked }));
        const likeCount = result.likeCount;
        if (typeof likeCount === 'number') {
          likeCountByIdRef.current[item.id] = likeCount;
          setLikeCounts(previous => ({
            ...previous,
            [item.id]: likeCount,
          }));
        }
      })
      .catch(() => {
        // Keep optimistic state correct if the latest request was rejected;
        // stale requests must never overwrite a newer user choice.
        if (likeRequestVersions.current[item.id] !== requestVersion) return;
        likedByIdRef.current[item.id] = isCurrentlyLiked;
        likeCountByIdRef.current[item.id] = previousLikeCount;
        setLiked(previous => ({ ...previous, [item.id]: isCurrentlyLiked }));
        setLikeCounts(previous => ({
          ...previous,
          [item.id]: previousLikeCount,
        }));
      });
  }, [activeViewer]);

  const fetchNextServerPage = useCallback(() => {
    if (
      profilePlayback ||
      !hasNextPage ||
      isFetchingNextPage ||
      pagedQuery.isFetching
    ) {
      return;
    }
    pagedQuery.fetchNextPage().catch(() => undefined);
  }, [
    hasNextPage,
    isFetchingNextPage,
    pagedQuery,
    profilePlayback,
  ]);
  const fetchNextServerPageRef = useRef(fetchNextServerPage);
  fetchNextServerPageRef.current = fetchNextServerPage;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index == null) return;
      const nextIndex = viewableItems[0].index;
      const entry = loopedFeedRef.current[nextIndex];
      if (!entry) return;
      currentIndexRef.current = nextIndex;
      activeReelIdRef.current = entry.reel.id;
      setCurrentIndex(nextIndex);

      // Request the following chronological page before a viewer reaches the
      // current tail. The loop sentinel is only appended after the server has
      // explicitly exhausted this cursor, so this never starts a local cycle
      // while another server page is available.
      if (!entry.loopSentinel && nextIndex >= loopedFeedRef.current.length - 2) {
        fetchNextServerPageRef.current();
      }

      if (!entry.loopSentinel || loopJumpPendingRef.current) return;
      loopJumpPendingRef.current = true;
      // The sentinel renders clip 1, then swaps to its canonical row without a
      // visible transition. Remounting playback guarantees a zero-time start.
      requestAnimationFrame(() => {
        setPlaybackCycle(cycle => cycle + 1);
        currentIndexRef.current = 0;
        activeReelIdRef.current = loopedFeedRef.current[0]?.reel.id ?? null;
        listRef.current?.scrollToIndex({ index: 0, animated: false });
        setCurrentIndex(0);
        loopJumpPendingRef.current = false;
      });
    },
  ).current;

  // Do not connect RefreshControl to React Query's general `isRefetching`
  // flag. It also becomes true for background refreshes while a Reel is
  // playing, and on iOS a programmatic RefreshControl changes the scroll
  // inset. That can make a full-screen page look as if it slid downward.
  const refreshFeed = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refetch();
      // A refresh starts the next cycle from the newest server page. The
      // incoming pages are reconciled by stable Reel id above.
      currentIndexRef.current = 0;
      activeReelIdRef.current = null;
      setCurrentIndex(0);
      setPlaybackCycle(cycle => cycle + 1);
      requestAnimationFrame(() => {
        // Empty feeds have no rows. scrollToIndex(0) crashes FlatList.
        if (!loopedFeedRef.current.length) {
          listRef.current?.scrollToOffset({ offset: 0, animated: false });
          return;
        }
        listRef.current?.scrollToIndex({ index: 0, animated: false });
      });
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const shareClip = useCallback((item: ReelItem) => {
    const url = clipShareUrl(item.id);
    Share.share(
      Platform.OS === 'ios'
        ? { url, message: item.caption || item.author }
        : { message: url, title: item.author },
    ).catch(() => undefined);
  }, []);

  const showNewClips = useCallback(() => {
    if (!live.showPending().length) return;
    jumpToTopRef.current = true;
  }, [live]);

  const hideReel = useCallback(
    (reelId: string) => {
      setHiddenIds(previous => new Set(previous).add(reelId));
      // Local state dies with this screen; also evict the Clip from the
      // shared caches so profile players and other lists don't bring it back.
      evictDeletedClipFromCaches(queryClient, reelId).catch(() => undefined);
    },
    [queryClient],
  );

  const blockClipAuthor = useCallback(
    async (profile: NonNullable<ReelItem['authorProfile']>) => {
      try {
        await blockProfile(profile);
        setBlockedProfileKeys(previous =>
          new Set(previous).add(profileKey(profile)),
        );
        // The local filter removes the clip immediately. Refetching then lets
        // the server apply the same block to future pages and devices.
        await refetch();
      } catch (error) {
        Alert.alert(
          'Couldn’t block profile',
          error instanceof Error
            ? error.message
            : 'Please try again in a moment.',
        );
      }
    },
    [refetch],
  );

  const book = useCallback(
    (item: ReelItem) => {
      if (!item.bookTarget) return;
      const target = item.bookTarget;
      if (target.entityType && target.entityId && target.categoryId) {
        if (target.entityType === 'event') {
          navigation.navigate('EventDetail', { eventId: target.entityId });
          return;
        }
        if (target.entityType === 'course') {
          navigation.navigate('CourseDetail', { courseId: target.entityId });
          return;
        }
        if (target.entityType === 'product') {
          navigation.navigate('ProductDetail', { productId: target.entityId });
          return;
        }
        navigation.navigate('UniversalDetail', {
          entityType: target.entityType,
          entityId: target.entityId,
          categoryId: target.categoryId,
        });
        return;
      }
      if (target.entityType === 'product' && target.entityId) {
        navigation.navigate('ProductDetail', { productId: target.entityId });
        return;
      }
      if (target.serviceCategoryId && target.serviceTreeId) {
        navigation.navigate('ServiceCategory', {
          treeId: target.serviceTreeId,
          categoryId: target.serviceCategoryId,
        });
        return;
      }
      const { kind, id } = target;
      if (!kind || !id) return;
      if (kind === 'doctor')
        navigation.navigate('DoctorProfile', { doctorId: id });
      else if (kind === 'lab') navigation.navigate('LabDetail', { labId: id });
      else navigation.navigate('ClassDetail', { classId: id });
    },
    [navigation],
  );

  const addProduct = useCallback(
    (item: ReelItem) => {
      addToCart(1);
      const productId = item.bookTarget?.entityId;
      if (productId) {
        navigation.navigate('ProductDetail', { productId });
        return;
      }
      navigation.navigate('Main', { screen: 'Shop' });
    },
    [addToCart, navigation],
  );

  const menuReel = useMemo(
    () => (menuReelId ? reels.find(r => r.id === menuReelId) ?? null : null),
    [menuReelId, reels],
  );

  const handleMoreAction = useCallback(
    (action: ClipMoreAction) => {
      const reelId = menuReelId;
      if (!reelId) return;
      const reel = reels.find(r => r.id === reelId);

      switch (action) {
        case 'save':
          setSaved(prev => ({ ...prev, [reelId]: !prev[reelId] }));
          setMenuReelId(null);
          break;
        case 'interested':
          setMenuReelId(null);
          Alert.alert('Thanks', 'We’ll show you more clips like this.');
          break;
        case 'not_interested':
          setMenuReelId(null);
          Alert.alert('Got it', 'We’ll show fewer clips like this.');
          break;
        case 'report':
          setMenuReelId(null);
          setReportTarget(
            reel?.reportTarget ?? { kind: 'legacy_reel', id: reelId },
          );
          break;
        case 'block': {
          const profile = reel?.authorProfile;
          setMenuReelId(null);
          if (!profile) break;
          const profileKind = profile.type === 'business' ? 'business' : 'user';
          Alert.alert(
            `Block ${reel?.author ?? profileKind}?`,
            `You will no longer see videos from this ${profileKind}. You can unblock it later from your settings.`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Block',
                style: 'destructive',
                onPress: () => blockClipAuthor(profile),
              },
            ],
          );
          break;
        }
        case 'delete': {
          setMenuReelId(null);
          if (!reel || !canDeleteClip(reel)) break;
          Alert.alert(
            'Delete this clip?',
            'It will be removed from your profile and everyone’s feed.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: () => {
                  deleteContentClip(reel.id)
                    .then(() => hideReel(reel.id))
                    .catch(error =>
                      Alert.alert(
                        'Couldn’t delete clip',
                        error instanceof Error
                          ? error.message
                          : 'Please try again.',
                      ),
                    );
                },
              },
            ],
          );
          break;
        }
        case 'caption':
          setMenuReelId(null);
          Alert.alert(
            'Caption',
            reel?.caption?.trim() || 'No caption for this clip.',
          );
          break;
        case 'auto_scroll':
          setAutoScroll(prev => !prev);
          break;
        default:
          setMenuReelId(null);
          break;
      }
    },
    [blockClipAuthor, hideReel, menuReelId, reels],
  );

  const goToNextReel = useCallback(() => {
    if (reels.length <= 1) return;
    const next = Math.min(currentIndexRef.current + 1, loopedFeedRef.current.length - 1);
    currentIndexRef.current = next;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  }, [reels.length]);

  const renderItem = ({ item: entry, index }: { item: LoopedClipFeedEntry; index: number }) => {
    const item = entry.reel;
    const isLiked = liked[item.id] ?? !!item.liked;
    const action = getReelAction(item);
    const musicLabel = item.title ? `♪ ${item.title}` : '♪ Original audio';

    return (
      <View style={[styles.reel, { height: pageHeight, width: pageWidth }]}>
        {index === currentIndex ? (
          <VideoPlayer
            key={`${entry.key}:playback:${playbackCycle}`}
            uri={item.videoUrl}
            muted={false}
            paused={commentsOpen && !playbackActive}
            onPlaybackError={message => {
              // Content Clips use short-lived signed R2 URLs. Refresh the feed
              // once after an HTTP status error so an expired URL can be
              // replaced with a newly signed delivery URL.
              if (
                message.includes('ERROR_CODE_IO_BAD_HTTP_STATUS') &&
                typeof item.videoUrl === 'string' &&
                item.videoUrl.includes('X-Amz-Signature=')
              ) {
                refreshPlaybackUrls().catch(() => undefined);
              }
            }}
            seekControllerId={item.id}
            onSeekControllerChange={registerClipSeekController}
            onPlaybackProgress={(currentTime, _duration) => {
              if (commentsOpen && !playbackActive) return;
              updateClipProgress(item.id, currentTime, _duration);
              trackPlayback(item, currentTime * 1_000, false);
            }}
            onPlaybackComplete={duration => {
              if ((commentsOpen && !playbackActive) || duration <= 0) {
                return;
              }
              trackPlayback(item, duration * 1_000, true);
              if (autoScroll) {
                goToNextReel();
              }
            }}
          />
        ) : null}

        {/* Top fade + chrome */}
        <View
          style={[styles.topFade, { height: topFadeH }]}
          pointerEvents="none"
        >
          <VerticalFade width={windowWidth} height={topFadeH} fromTop />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TopChromeButton
            icon={providerPlayback ? 'back' : 'search'}
            accessibilityLabel={providerPlayback ? 'Back to provider profile' : 'Search'}
            onPress={() =>
              providerPlayback ? navigation.goBack() : navigation.navigate('Search')
            }
          />
          {providerPlayback ? (
            <Text numberOfLines={1} style={styles.providerFeedTitle}>
              {params?.providerName ?? 'Provider Clips'}
            </Text>
          ) : (
            <View style={styles.topRightCluster}>
              <PressableScale
                accessibilityLabel="Coins"
                onPress={() => {}}
                style={styles.coinsChip}
              >
                <AppIcon name="coins" size={16} color="#FBBF24" strokeWidth={2} />
                <Text style={styles.coinsText}>{coins}</Text>
              </PressableScale>
              <TopChromeButton
                icon="circle-plus"
                accessibilityLabel="Create"
                onPress={() => navigation.navigate('ClipComposer')}
              />
              <TopChromeButton
                icon="profile"
                accessibilityLabel="Profile"
                onPress={() => navigation.navigate('Profile')}
              />
            </View>
          )}
        </View>

        {/* Right engagement */}
        <View style={[styles.sideActions, { bottom: bottomSafe + 72 }]}>
          <SideAction
            icon="heart"
            label={formatCount(likeCounts[item.id] ?? item.likeCount)}
            active={isLiked}
            accessibilityLabel="Like"
            onPress={() => toggleLike(item)}
          />
          <SideAction
            icon="comment"
            label={formatCount(
              Math.max(item.commentCount, commentCounts[item.id] ?? 0),
            )}
            accessibilityLabel="Comments"
            onPress={() =>
              openComments({
                sourceType: 'clip',
                contentId: item.id,
                commentCount: Math.max(
                  item.commentCount,
                  commentCounts[item.id] ?? 0,
                ),
              })
            }
          />
          <SideAction
            icon="share"
            accessibilityLabel="Share"
            onPress={() => shareClip(item)}
          />
          <SideAction
            icon="more"
            accessibilityLabel="More options"
            onPress={() => setMenuReelId(item.id)}
          />
        </View>

        {/* Bottom fade + meta */}
        <View
          style={[styles.bottomFade, { height: bottomFadeH }]}
          pointerEvents="none"
        >
          <VerticalFade
            width={windowWidth}
            height={bottomFadeH}
            fromTop={false}
          />
        </View>
        <View style={[styles.meta, { bottom: bottomSafe }]}>
          <PressableScale
            accessibilityLabel={`Open ${item.author} profile`}
            onPress={() =>
              navigation.navigate(
                'Profile',
                item.feedSource === 'content_post' && item.authorProfile
                  ? {
                      profileType:
                        item.authorProfile.type === 'user'
                          ? 'personal'
                          : 'business',
                      profileId: item.authorProfile.id,
                    }
                  : undefined,
              )
            }
            style={styles.creatorRow}
          >
            <Image
              source={{ uri: getAuthorAvatar(item) }}
              style={styles.creatorAvatar}
            />
            <Text style={styles.creator}>@{item.author}</Text>
          </PressableScale>
          <ClipCreatorActions item={item} />
          <Text style={styles.caption} numberOfLines={3}>
            {item.caption}
          </Text>
          <View style={styles.musicRow}>
            <AppIcon name="music" size={13} color="rgba(255,255,255,0.85)" />
            <Text style={styles.musicText} numberOfLines={1}>
              {musicLabel}
            </Text>
          </View>
        </View>
        {action ? (
          <PressableScale
            onPress={() => (action === 'cart' ? addProduct(item) : book(item))}
            accessibilityLabel={
              action === 'cart' ? 'Shop product' : 'Book related service'
            }
            style={[
              styles.cta,
              styles.ctaCorner,
              {
                bottom: bottomSafe,
                backgroundColor: theme.colors.primary,
                borderRadius: theme.radius.pill,
              },
            ]}
          >
            <AppIcon
              name={
                action === 'cart'
                  ? 'cart'
                  : action === 'trip'
                  ? 'globe'
                  : 'calendar'
              }
              size={16}
              color="#042F2E"
            />
            <Text style={styles.ctaLabel}>
              {action === 'cart'
                ? 'Shop'
                : action === 'trip'
                ? 'Book trip'
                : 'Book'}
            </Text>
          </PressableScale>
        ) : null}
      </View>
    );
  };

  const emptyMessage =
    feedError instanceof Error
      ? feedError.message
      : providerPlayback
        ? 'No clips from this provider yet.'
        : profilePlayback
        ? 'No clips from this profile yet.'
        : 'No clips yet. Be the first to share one.';

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={loopedReels}
        keyExtractor={entry => entry.key}
        renderItem={renderItem}
        // Each retained feed row owns a native video player. Keep Android's
        // render window small so long feeds do not accumulate dozens of
        // player and view trees in the activity's limited Java heap.
        {...(Platform.OS === 'android'
          ? {
              initialNumToRender: 1,
              maxToRenderPerBatch: 2,
              windowSize: 3,
              removeClippedSubviews: true,
            }
          : null)}
        pagingEnabled
        scrollEnabled={!commentsOpen}
        showsVerticalScrollIndicator={false}
        decelerationRate="fast"
        disableIntervalMomentum
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReached={fetchNextServerPage}
        onEndReachedThreshold={0.6}
        onScrollToIndexFailed={info => {
          listRef.current?.scrollToOffset({
            offset: Math.max(0, info.index) * pageHeight,
            animated: false,
          });
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 80 }}
        // iOS safe-area inset auto-adjust shrinks the scroll viewport after mount
        // and makes full-screen pages drift downward under the tab bar.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        automaticallyAdjustKeyboardInsets={false}
        {...(Platform.OS === 'android'
          ? { overScrollMode: 'never' as const }
          : null)}
        ListEmptyComponent={
          <View
            style={[
              styles.empty,
              { height: pageHeight, width: pageWidth, paddingTop: insets.top + 80 },
            ]}>
            {feedLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.emptyTitle}>
                  {feedError
                    ? 'Could not load clips'
                    : providerPlayback
                      ? 'No provider clips yet'
                      : 'No clips yet'}
                </Text>
                <Text style={styles.emptyBody}>{emptyMessage}</Text>
                {!profilePlayback && !providerPlayback && !feedError ? (
                  <PressableScale
                    accessibilityLabel="Create a clip"
                    onPress={() => navigation.navigate('ClipComposer')}
                    style={[
                      styles.emptyCta,
                      { backgroundColor: theme.colors.primary },
                    ]}>
                    <AppIcon name="video" size={18} color="#042F2E" />
                    <Text style={styles.emptyCtaLabel}>Create a clip</Text>
                  </PressableScale>
                ) : null}
                {providerPlayback &&
                params?.providerHasClips === false &&
                !showSimilarProviders &&
                !feedError ? (
                  <PressableScale
                    accessibilityLabel="Explore clips from similar providers"
                    onPress={() => setShowSimilarProviders(true)}
                    style={[
                      styles.emptyCta,
                      { backgroundColor: theme.colors.primary },
                    ]}>
                    <AppIcon name="reels" size={18} color="#042F2E" />
                    <Text style={styles.emptyCtaLabel}>
                      Explore similar providers
                    </Text>
                  </PressableScale>
                ) : null}
                {feedError ? (
                  <PressableScale
                    accessibilityLabel="Try again"
                    onPress={() => void refetch()}
                    style={[
                      styles.emptyCta,
                      { backgroundColor: theme.colors.primary },
                    ]}>
                    <Text style={styles.emptyCtaLabel}>Try again</Text>
                  </PressableScale>
                ) : null}
              </>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={refreshFeed}
            tintColor="#FFFFFF"
            colors={[theme.colors.primary]}
            progressViewOffset={insets.top + 8}
          />
        }
      />
      {providerPlayback && loopedReels.length === 0 ? (
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TopChromeButton
            icon="back"
            accessibilityLabel="Back to provider profile"
            onPress={() => navigation.goBack()}
          />
          <Text numberOfLines={1} style={styles.providerFeedTitle}>
            {params?.providerName ?? 'Provider Clips'}
          </Text>
        </View>
      ) : null}
      {live.pending.length > 0 ? (
        <View
          pointerEvents="box-none"
          style={[styles.newClipsWrap, { top: insets.top + 58 }]}
        >
          <PressableScale
            accessibilityLabel={`${live.pending.length} new clips`}
            onPress={showNewClips}
            style={[styles.newClipsPill, { backgroundColor: theme.colors.primary }]}
          >
            <AppIcon name="arrow-up" size={16} color="#FFFFFF" strokeWidth={2.4} />
            {live.pending.slice(0, 3).map((clip, index) =>
              clip.authorAvatarUrl ? (
                <Image
                  key={clip.id}
                  source={{ uri: clip.authorAvatarUrl }}
                  style={index > 0 ? [styles.newClipsAvatar, styles.newClipsAvatarStacked] : styles.newClipsAvatar}
                />
              ) : null,
            )}
            <Text style={styles.newClipsText}>
              {live.pending.length === 1
                ? 'New clip'
                : `${live.pending.length > 9 ? '9+' : live.pending.length} new clips`}
            </Text>
          </PressableScale>
        </View>
      ) : null}
      <ClipMoreSheet
        visible={Boolean(menuReel)}
        saved={menuReel ? Boolean(saved[menuReel.id] ?? menuReel.saved) : false}
        autoScroll={autoScroll}
        blockTarget={
          menuReel?.authorProfile
            ? { ...menuReel.authorProfile, name: menuReel.author }
            : null
        }
        canDelete={canDeleteClip(menuReel)}
        onClose={() => setMenuReelId(null)}
        onAction={handleMoreAction}
      />
      <GuidedReportVideoSheet
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmit={reason => {
          if (!reportTarget) return;
          return reportTarget.kind === 'content_post'
            ? reportContentPost(reportTarget.id, reason)
            : reportReel(reportTarget.id, reason);
        }}
      />
      {providerPlayback ? <CommentsBottomSheetHost /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  list: { flex: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyBody: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  emptyCta: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    minHeight: 48,
    paddingHorizontal: 20,
  },
  emptyCtaLabel: {
    color: '#042F2E',
    fontSize: 15,
    fontWeight: '800',
  },
  newClipsWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  newClipsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  newClipsAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  newClipsAvatarStacked: { marginLeft: -12 },
  newClipsText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  reel: { backgroundColor: '#000' },
  topFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  bottomFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  providerFeedTitle: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingRight: 40,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  coinsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  coinsText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sideActions: {
    position: 'absolute',
    right: 10,
    alignItems: 'center',
    gap: 16,
  },
  meta: {
    position: 'absolute',
    left: 16,
    paddingRight: 78,
    gap: 6,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  creatorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  creator: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  creatorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  creatorActionButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  creatorActionPrimary: { backgroundColor: '#14B8A6' },
  creatorActionSecondary: {
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  creatorActionDisabled: { opacity: 0.55 },
  creatorActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sideAction: {
    alignItems: 'center',
    gap: 4,
  },
  sideIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  sideLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  caption: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  musicText: {
    flex: 1,
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '600',
  },
  cta: {
    flexShrink: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaCorner: {
    position: 'absolute',
    right: 12,
  },
  ctaLabel: {
    color: '#042F2E',
    fontWeight: '800',
    fontSize: 13,
  },
});
