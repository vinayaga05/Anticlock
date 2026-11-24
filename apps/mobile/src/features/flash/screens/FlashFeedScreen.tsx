import { useGenieScreen } from '@/features/assistant/search/useGenieScreen';
import { SearchFilterChips } from '@/features/assistant/search/SearchFilterChips';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useFlashPostsQuery } from '@/shared/api/storyHooks';
import { isApiEnabled } from '@/shared/api/config';
import {
  AppState,
  FlatList,
  Text,
  StyleSheet,
  View,
  type CellRendererProps,
} from 'react-native';
import {
  visibleMediaOwner,
  type MediaBounds,
} from '@/features/video/playback/feedVisibility';
import { useAssistantStore } from '@/features/assistant/store/assistantStore';
import type { FlashPost } from '@/shared/data/flash/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/shared/components/AppHeader';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { FeedTab } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { FlashComposerBar } from '@/features/flash/components/FlashComposerBar';
import { StoryTray } from '@/features/flash/components/StoryTray';
import { FlashPostCard } from '@/features/flash/components/FlashPostCard';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { TAB_BAR_VISIBLE_HEIGHT } from '@/shared/navigation/FloatingPillTabBar';

const FEED_PILLS = [
  { id: 'forYou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'nearby', label: 'Nearby' },
];

type Row = { y: number; index: number };
const GeometryContext = createContext<{
  record: (id: string, row: Row | null) => void;
}>({ record: () => {} });
function FeedCell({
  item,
  index,
  children,
  style,
  onLayout,
}: CellRendererProps<FlashPost>) {
  const { record } = useContext(GeometryContext);
  useEffect(() => () => record(item.id, null), [item.id, record]);
  return (
    <View
      style={style}
      onLayout={event => {
        onLayout?.(event);
        record(item.id, { y: event.nativeEvent.layout.y, index });
      }}
    >
      {children}
    </View>
  );
}

export function FlashFeedScreen() {
  const theme = useTheme();
  const focused = useIsFocused();
  const assistantOpen = useAssistantStore(s => Boolean(s.open || s.speaking));
  const [appActive, setAppActive] = useState(
    AppState.currentState === 'active',
  );
  const [preparedPostId, setPreparedPostId] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<Set<string>>(() => new Set());
  const rows = useRef(new Map<string, Row>());
  const mediaBounds = useRef(new Map<string, MediaBounds>());
  const viewport = useRef({ offset: 0, height: 0 });
  const feedRef = useRef<FlashPost[]>([]);
  const eligible = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state =>
      setAppActive(state === 'active'),
    );
    return () => sub.remove();
  }, []);
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const [recent, setRecent] = useState(false);
  const listRef = useRef<FlatList<FlashPost>>(null);
  const { active: activeViewerProfile } = useActiveProfile();
  const viewerProfile = activeViewerProfile
    ? {
        id: activeViewerProfile.id,
        type: identityProfileType(activeViewerProfile),
      }
    : null;
  const posts = useEngagementStore(s => s.posts);
  const hiddenIds = useEngagementStore(s => s.hiddenIds);
  const upsertApiPosts = useEngagementStore(s => s.upsertApiPosts);
  const {
    data: apiPosts,
    refetch,
    isRefetching,
    isLoading,
    error,
  } = useFlashPostsQuery(viewerProfile);

  // Server-published Flash posts (personal + business publishers) lead the
  // feed; previously this screen only rendered the local mock store.
  useEffect(() => {
    if (isApiEnabled && apiPosts) upsertApiPosts(apiPosts);
  }, [apiPosts, upsertApiPosts]);

  useFocusEffect(
    useCallback(() => {
      if (isApiEnabled) refetch();
    }, [refetch]),
  );
  const commentsOpen = useCommentsSheetStore(s => s.open || s.closing);

  const feed = useMemo(() => {
    const authoritative = isApiEnabled && (recent || tab === 'following');
    const allowed = new Map((apiPosts ?? []).map(post=>[post.id,post]));
    const visible = posts.filter(p => !p.hidden && !hiddenIds.includes(p.id) &&
      (authoritative ? allowed.has(p.id) : true) && p.feedTabs.includes(tab) &&
      (tab !== 'following' || !isApiEnabled || allowed.get(p.id)?.author?.followed === true));
    if (recent) visible.sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt));
    return visible;
  }, [posts, hiddenIds, tab, recent, apiPosts]);
  useGenieScreen({
    domain:'flash',
    filters:{following:tab === 'following' || undefined,sort:recent ? 'recent' : undefined},
    status:isLoading || isRefetching || Boolean(apiPosts?.some(p=>!posts.some(visible=>visible.id===p.id))) ? 'loading' : error ? 'error' : 'ready',
    partial:(apiPosts?.length ?? 0) >= 50,
    rows:feed.map((p,index)=>({id:p.id,name:p.text?.slice(0,70) || `Post by ${p.author?.name ?? 'a member'}`,
      detail:`${p.author?.name ?? 'a member'} · ${p.timeLabel}`,open:()=>listRef.current?.scrollToIndex({index, animated:true})})),
  }, next=>{setTab(next.following ? 'following' : 'forYou');setRecent(next.sort === 'recent'); if (error) void refetch();});
  const feedScope = `${tab}:${viewerProfile?.type ?? ''}:${
    viewerProfile?.id ?? ''
  }`;
  useLayoutEffect(() => {
    viewport.current.offset = 0;
    rows.current.clear();
    mediaBounds.current.clear();
    setActivePostId(null);
    setPreparedPostId(null);
  }, [feedScope]);

  feedRef.current = feed;
  eligible.current =
    focused &&
    appActive &&
    !isRefetching &&
    !commentsOpen &&
    !assistantOpen &&
    overlays.size === 0;
  const tabClearance = TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + 8;
  const calculate = useCallback(() => {
    if (!eligible.current) {
      setActivePostId(null);
      setPreparedPostId(null);
      return;
    }
    const geometry = feedRef.current.flatMap((post, index) => {
      const row = rows.current.get(post.id);
      const media = mediaBounds.current.get(post.id);
      return row && row.index === index && media
        ? [{ id: post.id, rowY: row.y, media }]
        : [];
    });
    const owner = visibleMediaOwner(
      geometry,
      viewport.current.offset,
      Math.max(0, viewport.current.height - tabClearance),
    );
    setActivePostId(owner);
    // At most one upcoming video may prepare, within one viewport of the fold.
    const ownerIndex = feedRef.current.findIndex(post => post.id === owner);
    const next = geometry.find(bounds => {
      const index = feedRef.current.findIndex(post => post.id === bounds.id);
      const top = bounds.rowY + bounds.media.y;
      return (
        index > ownerIndex &&
        bounds.id !== owner &&
        top >= viewport.current.offset &&
        top < viewport.current.offset + viewport.current.height * 2 &&
        feedRef.current[index]?.media.some(media => media.type === 'video')
      );
    });
    setPreparedPostId(next?.id ?? null);
  }, [tabClearance]);
  const recordRow = useCallback(
    (id: string, row: Row | null) => {
      if (row) rows.current.set(id, row);
      else {
        rows.current.delete(id);
        mediaBounds.current.delete(id);
      }
      calculate();
    },
    [calculate],
  );
  const recordMedia = useCallback(
    (id: string, bounds: MediaBounds) => {
      mediaBounds.current.set(id, bounds);
      calculate();
    },
    [calculate],
  );
  const overlayChange = useCallback((id: string, open: boolean) => {
    setOverlays(previous => {
      if (previous.has(id) === open) return previous;
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  useLayoutEffect(() => {
    calculate();
  }, [
    calculate,
    feed,
    focused,
    appActive,
    isRefetching,
    commentsOpen,
    assistantOpen,
    overlays,
  ]);
  const geometryContext = useMemo(() => ({ record: recordRow }), [recordRow]);
  const playbackEnabled =
    focused &&
    appActive &&
    !isRefetching &&
    !commentsOpen &&
    !assistantOpen &&
    overlays.size === 0;

  const bottomPad =
    TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + 8 + 24;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <GeometryContext.Provider value={geometryContext}>
        <FlatList
          ref={listRef}
          onScrollToIndexFailed={({index,averageItemLength})=>listRef.current?.scrollToOffset({offset:index*averageItemLength,animated:true})}
          key={`${feedScope}:${recent}`}
          data={feed}
          CellRendererComponent={FeedCell}
          extraData={[activePostId, preparedPostId, playbackEnabled]}
          scrollEventThrottle={16}
          onLayout={event => {
            viewport.current.height = event.nativeEvent.layout.height;
            calculate();
          }}
          onScroll={event => {
            viewport.current.offset = event.nativeEvent.contentOffset.y;
            calculate();
          }}
          onContentSizeChange={calculate}
          windowSize={5}
          initialNumToRender={3}
          keyExtractor={item => item.id}
          scrollEnabled={!commentsOpen}
          refreshing={isApiEnabled ? isRefetching : false}
          onRefresh={isApiEnabled ? () => refetch() : undefined}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 10,
            paddingBottom: bottomPad,
          }}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <AppHeader title="Flash" />
              <StoryTray />
              <FilterPills
                activeId={tab}
                onChange={id => setTab(id as FeedTab)}
                pills={FEED_PILLS}
              />
              <SearchFilterChips filters={{sort:recent?'recent':undefined}} onClear={()=>setRecent(false)} />
              <FlashComposerBar />
              {error && (recent || tab === 'following') ? <Text style={{color:theme.colors.textSecondary}}>Could not load posts. Pull to retry.</Text> :
                !isLoading && !feed.length && (recent || tab === 'following') ? <Text style={{color:theme.colors.textSecondary}}>No matching posts.</Text> : null}
            </View>
          }
          renderItem={({ item }) => (
            <FlashPostCard
              post={item}
              preparationEnabled={playbackEnabled && item.id === preparedPostId}
              playbackActive={playbackEnabled && item.id === activePostId}
              onMediaLayout={recordMedia}
              onOverlayChange={overlayChange}
            />
          )}
        />
      </GeometryContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
});
