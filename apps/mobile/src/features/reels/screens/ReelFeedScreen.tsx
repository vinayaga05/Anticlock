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
  Share,
  StyleSheet,
  Text,
  Alert,
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
import { reels as r2Reels } from '@/shared/data/mocks';
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
import { useClipPlaybackStore } from '@/shared/store/clipPlaybackStore';
import {
  deleteContentClip,
  fetchContentClip,
  fetchMoreContentClips,
  useReelsQuery,
} from '@/shared/api/hooks';
import {
  appendClipPage,
  canDeleteClip,
  clipAuthorLabel,
  clipShareUrl,
  prependClip,
  withoutHiddenClips,
} from '@/features/reels/feed/clipFeedPaging';
import {
  createAnalyticsEventId,
  recordReelAnalyticsEvent,
} from '@/shared/api/reelAnalytics';
import {
  recordContentClipView,
  setContentClipLike,
} from '@/shared/api/contentEngagement';
import { useTabBarBottomInset } from '@/shared/navigation/tabBarInset';
import type { MainTabParamList } from '@/shared/navigation/types';

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
  const route = useRoute<RouteProp<MainTabParamList, 'PlayFeed'>>();
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
  const [activeIndex, setActiveIndex] = useState(0);
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
  const [autoScroll, setAutoScroll] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [coins] = useState(120);
  const viewedReelIds = useRef(new Set<string>());
  const completedReelIds = useRef(new Set<string>());
  const likedByIdRef = useRef<Record<string, boolean>>({});
  const likeCountByIdRef = useRef<Record<string, number>>({});
  const likeRequestVersions = useRef<Record<string, number>>({});
  const listRef = useRef<FlatList<ReelItem>>(null);
  const activeIndexRef = useRef(activeIndex);
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
  const setActiveClip = useClipPlaybackStore(s => s.setActiveClip);
  const updateClipProgress = useClipPlaybackStore(s => s.updateProgress);
  const registerClipSeekController = useClipPlaybackStore(
    s => s.registerSeekController,
  );
  const clearClipPlayback = useClipPlaybackStore(s => s.clear);
  const { data: feedPage, refetch } = useReelsQuery(r2Reels);
  const queriedReels = feedPage?.items;
  // Infinite scroll: pages after the first are appended locally and reset
  // whenever the first page is fetched again (pull-to-refresh, publish).
  const [morePages, setMorePages] = useState<ReelItem[]>(EMPTY_REELS);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const morePagesRef = useRef<ReelItem[]>(EMPTY_REELS);
  const loadingMoreRef = useRef(false);
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [linkedClip, setLinkedClip] = useState<ReelItem | null>(null);
  const requestedLinkRef = useRef<string | null>(null);
  const firstPageLeadIdRef = useRef<string | null>(null);
  useEffect(() => {
    morePagesRef.current = EMPTY_REELS;
    setMorePages(EMPTY_REELS);
    setNextCursor(feedPage?.nextCursor ?? null);
    loadingMoreRef.current = false;
    // A new first page that starts with a different Clip (for example the
    // creator's just-published one) is shown from the top.
    const leadId = feedPage?.items[0]?.id ?? null;
    const previousLeadId = firstPageLeadIdRef.current;
    firstPageLeadIdRef.current = leadId;
    if (previousLeadId && leadId && previousLeadId !== leadId && !route.params?.reelId) {
      activeIndexRef.current = 0;
      setActiveIndex(0);
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
    // Only a new first page resets paging.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedPage]);
  // Content-feed results are already block-filtered on the server. Hydrate the
  // same persisted block list for editorial/legacy Reels as well, whose public
  // endpoint deliberately has no viewer-specific server filter.
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
  // `useReelsQuery` supplies demo data only when the API is deliberately
  // disabled for local development. Do not use the bundled/R2 demo list as a
  // production fallback: the public feed endpoint is the publication gate.
  // Keep the empty state referentially stable so a loading/refetch transition
  // cannot make FlatList think its data changed and recalculate its viewport.
  const feedReels = useMemo(() => {
    const firstPage = queriedReels ?? EMPTY_REELS;
    const paged = morePages.length
      ? appendClipPage(firstPage, morePages).items
      : firstPage;
    const linked = linkedClip ? prependClip(paged, linkedClip) : paged;
    return withoutHiddenClips(linked, hiddenIds);
  }, [hiddenIds, linkedClip, morePages, queriedReels]);
  const genieQ = route.params?.q?.trim().toLowerCase();
  const reels = useMemo(() => {
    const visibleReels = feedReels.filter(
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
  }, [blockedProfileKeys, feedReels, genieQ]);

  useEffect(() => {
    setActiveClip(reels[activeIndex]?.id ?? null);
  }, [activeIndex, reels, setActiveClip]);

  useEffect(() => clearClipPlayback, [clearClipPlayback]);

  // A shared link can point at a Clip outside the loaded batch: load it by id
  // and show it first.
  useEffect(() => {
    const reelId = route.params?.reelId;
    if (!reelId || !queriedReels) return;
    if (feedReels.some(r => r.id === reelId)) return;
    if (requestedLinkRef.current === reelId) return;
    requestedLinkRef.current = reelId;
    fetchContentClip(reelId)
      .then(clip => {
        if (clip) setLinkedClip(clip);
      })
      .catch(() => undefined);
  }, [feedReels, queriedReels, route.params?.reelId]);

  useEffect(() => {
    const reelId = route.params?.reelId;
    if (!reelId || !reels.length) return;
    const idx = reels.findIndex(r => r.id === reelId);
    if (idx >= 0) {
      activeIndexRef.current = idx;
      setActiveIndex(idx);
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: idx, animated: false });
      });
    }
  }, [route.params?.reelId, reels]);

  const bottomSafe = useTabBarBottomInset(20);
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
        offset: activeIndexRef.current * pageHeight,
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

    setContentClipLike(contentPostId, nextLiked)
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
  }, []);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index != null) {
        const nextIndex = viewableItems[0].index;
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
      }
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
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refetch]);

  const loadMoreReels = useCallback(async () => {
    const cursor = nextCursor;
    if (!cursor || loadingMoreRef.current || genieQ) return;
    loadingMoreRef.current = true;
    try {
      const page = await fetchMoreContentClips(cursor);
      const previous = morePagesRef.current;
      const { added } = appendClipPage(
        appendClipPage(queriedReels ?? EMPTY_REELS, previous).items,
        page.items,
      );
      const next = [...previous, ...page.items];
      morePagesRef.current = next;
      setMorePages(next);
      // A page that only repeats what is on screen ends this session's feed.
      setNextCursor(added > 0 || page.items.length === 0 ? page.nextCursor : null);
    } catch {
      // Keep the cursor so the next scroll to the end retries.
    } finally {
      loadingMoreRef.current = false;
    }
  }, [genieQ, nextCursor, queriedReels]);

  const shareReel = useCallback(async (item: ReelItem) => {
    const url = clipShareUrl(item.id);
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url, message: item.caption?.trim() || undefined }
          : { message: item.caption?.trim() ? `${item.caption.trim()}\n${url}` : url },
      );
    } catch {
      // The share sheet was dismissed or is unavailable.
    }
  }, []);

  const hideReel = useCallback((reelId: string) => {
    setHiddenIds(previous => new Set(previous).add(reelId));
  }, []);

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
          Alert.alert('Delete this clip?', 'It will be removed from your profile and everyone’s feed.', [
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
                      error instanceof Error ? error.message : 'Please try again.',
                    ),
                  );
              },
            },
          ]);
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
    const next = activeIndex + 1;
    if (next >= reels.length) return;
    activeIndexRef.current = next;
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setActiveIndex(next);
  }, [activeIndex, reels.length]);

  const renderItem = ({ item, index }: { item: ReelItem; index: number }) => {
    const isLiked = liked[item.id] ?? !!item.liked;
    const action = getReelAction(item);
    const musicLabel = item.title ? `♪ ${item.title}` : '♪ Original audio';

    return (
      <View style={[styles.reel, { height: pageHeight, width: pageWidth }]}>
        <VideoPlayer
          uri={item.videoUrl}
          poster={item.posterUrl || undefined}
          muted={false}
          paused={index !== activeIndex || (commentsOpen && !playbackActive)}
          seekControllerId={index === activeIndex ? item.id : undefined}
          onSeekControllerChange={
            index === activeIndex ? registerClipSeekController : undefined
          }
          onPlaybackProgress={(currentTime, _duration) => {
            if (index !== activeIndex || (commentsOpen && !playbackActive)) {
              return;
            }
            updateClipProgress(item.id, currentTime, _duration);
            trackPlayback(item, currentTime * 1_000, false);
          }}
          onPlaybackComplete={duration => {
            if (
              index !== activeIndex ||
              (commentsOpen && !playbackActive) ||
              duration <= 0
            ) {
              return;
            }
            trackPlayback(item, duration * 1_000, true);
            if (autoScroll) {
              goToNextReel();
            }
          }}
        />

        {/* Top fade + chrome */}
        <View
          style={[styles.topFade, { height: topFadeH }]}
          pointerEvents="none"
        >
          <VerticalFade width={windowWidth} height={topFadeH} fromTop />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TopChromeButton
            icon="search"
            accessibilityLabel="Search"
            onPress={() => navigation.navigate('Search')}
          />
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
            label={formatCount(item.commentCount)}
            accessibilityLabel="Comments"
            onPress={() =>
              openComments({
                sourceType: 'clip',
                contentId: item.id,
                commentCount: item.commentCount,
              })
            }
          />
          <SideAction
            icon="share"
            accessibilityLabel="Share"
            onPress={() => void shareReel(item)}
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
            <Text style={styles.creator}>{clipAuthorLabel(item)}</Text>
          </PressableScale>
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

  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        style={styles.list}
        data={reels}
        keyExtractor={item => item.id}
        renderItem={renderItem}
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
        onEndReached={() => void loadMoreReels()}
        onEndReachedThreshold={2}
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
      <ClipMoreSheet
        visible={Boolean(menuReel)}
        saved={menuReel ? Boolean(saved[menuReel.id] ?? menuReel.saved) : false}
        autoScroll={autoScroll}
        canDelete={canDeleteClip(menuReel)}
        blockTarget={
          menuReel?.authorProfile
            ? { ...menuReel.authorProfile, name: menuReel.author }
            : null
        }
        onClose={() => setMenuReelId(null)}
        onAction={handleMoreAction}
      />
      <GuidedReportVideoSheet
        visible={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        onSubmit={reason => {
          if (!reportTarget) return;
          const target = reportTarget;
          const request =
            target.kind === 'content_post'
              ? reportContentPost(target.id, reason)
              : reportReel(target.id, reason);
          // A reported Clip leaves this viewer's feed right away.
          return Promise.resolve(request).then(result => {
            const reported = reels.find(
              r => r.id === target.id || r.reportTarget?.id === target.id,
            );
            if (reported) hideReel(reported.id);
            return result;
          });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  list: { flex: 1 },
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
