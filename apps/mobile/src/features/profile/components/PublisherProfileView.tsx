import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { FilterPills } from '@/shared/components/FilterPills';
import { PressableScale } from '@/shared/components/PressableScale';
import { formatProfileCount } from '@/shared/data/flash';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import {
  useContentProfilePostsQuery,
  useContentProfileQuery,
  useMyContentQuery,
  type ApiContentPost,
  type MyContentItem,
} from '@/shared/api/storyHooks';
import {
  identityProfileType,
  type PublisherProfileType,
} from '@/shared/publishing/publisherSelection';

type Tab = 'flash' | 'clip';

const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  uploading: 'Uploading',
  processing: 'Processing',
  pending_review: 'In review',
  rejected: 'Rejected',
  failed: 'Failed',
  removed: 'Removed',
};

function thumbnailOf(post: ApiContentPost): string | null {
  if (post.posterUrl) return post.posterUrl;
  const image = post.media?.find(item => item.kind === 'image');
  return image?.url ?? null;
}

/**
 * API-backed profile: header, counts and content tabs for the content
 * published AS this profile (personal or business). Business content never
 * appears on the owner's personal profile and vice versa. On the viewer's
 * own profiles a switcher moves between owned profiles and an owner-only
 * "In progress" list shows processing/review/failed items.
 */
export function PublisherProfileView({
  profileType,
  profileId,
}: {
  profileType?: PublisherProfileType;
  profileId?: string;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const cellSize = (width - 2) / 3;
  const { identities, active: globalActive } = useActiveProfile();

  // A switcher choice wins; then an explicit profile; otherwise the
  // viewer's global active profile (personal unless switched in Settings).
  const [ownSelectedId, setOwnSelectedId] = useState<string | null>(null);
  const selectedOwned = ownSelectedId
    ? identities.find(item => item.id === ownSelectedId)
    : undefined;
  const fallbackOwned = globalActive;
  const activeRef: { type: PublisherProfileType; id: string } | null =
    selectedOwned
      ? { type: identityProfileType(selectedOwned), id: selectedOwned.id }
      : profileId
        ? { type: profileType ?? 'personal', id: profileId }
        : fallbackOwned
          ? { type: identityProfileType(fallbackOwned), id: fallbackOwned.id }
          : null;

  const [tab, setTab] = useState<Tab>('flash');
  const profileQuery = useContentProfileQuery(activeRef?.type, activeRef?.id);
  const postsQuery = useContentProfilePostsQuery(
    activeRef?.type,
    activeRef?.id,
    tab,
  );
  const profile = profileQuery.data;
  const isOwner = Boolean(profile?.viewerCanManage);
  const mineQuery = useMyContentQuery(activeRef?.id, isOwner);
  const inProgress = useMemo<MyContentItem[]>(
    () =>
      (mineQuery.data ?? []).filter(
        item => item.contentStatus !== 'published' && item.contentStatus !== 'removed',
      ),
    [mineQuery.data],
  );

  const refetchProfile = profileQuery.refetch;
  const refetchPosts = postsQuery.refetch;
  const refetchMine = mineQuery.refetch;
  useFocusEffect(
    useCallback(() => {
      if (!activeRef?.id) return;
      refetchProfile();
      refetchPosts();
      if (isOwner) refetchMine();
    }, [activeRef?.id, isOwner, refetchProfile, refetchPosts, refetchMine]),
  );

  const ownedIds = new Set(identities.map(item => item.id));
  const showSwitcher =
    identities.length > 1 && activeRef !== null && ownedIds.has(activeRef.id);
  const publisher = profile?.publisher;
  const posts = postsQuery.data ?? [];

  const header = (
    <View style={styles.header}>
      {showSwitcher ? (
        <FilterPills
          activeId={activeRef?.id ?? ''}
          onChange={setOwnSelectedId}
          pills={identities.map(item => ({
            id: item.id,
            label:
              identityProfileType(item) === 'personal'
                ? `${item.name} (Personal)`
                : item.name,
          }))}
        />
      ) : null}
      <View style={styles.statsRow}>
        {publisher?.avatarUrl ? (
          <Image source={{ uri: publisher.avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
              {publisher?.displayName.charAt(0).toUpperCase() ?? ''}
            </Text>
          </View>
        )}
        <View style={styles.stats}>
          {(
            [
              ['posts', profile?.counts.flash ?? 0],
              ['clips', profile?.counts.clips ?? 0],
              ['stories', profile?.counts.stories ?? 0],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.colors.textPrimary }]}>
                {formatProfileCount(value)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textPrimary }]}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: theme.colors.textPrimary }]}>
            {publisher?.displayName ?? (profileQuery.isError ? 'Profile unavailable' : 'Loading…')}
          </Text>
          {publisher?.verified ? (
            <AppIcon name="verified" size={14} color={theme.colors.primary} strokeWidth={2} />
          ) : null}
        </View>
        {publisher ? (
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {publisher.type === 'business'
              ? `Business${publisher.businessCategory ? ` · ${publisher.businessCategory}` : ''}`
              : 'Personal profile'}
            {publisher.handle ? `  @${publisher.handle}` : ''}
          </Text>
        ) : null}
      </View>

      {isOwner && inProgress.length > 0 ? (
        <View style={[styles.progressCard, { borderColor: theme.colors.borderSoft }]}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            In progress (only you can see this)
          </Text>
          {inProgress.slice(0, 5).map(item => (
            <View key={item.id} style={styles.progressRow}>
              <Text
                numberOfLines={1}
                style={[theme.typography.bodySmall, styles.progressCaption, { color: theme.colors.textPrimary }]}>
                {item.contentType === 'clip' ? 'Clip' : item.contentType === 'story' ? 'Story' : 'Post'}
                {item.caption ? ` · ${item.caption}` : ''}
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {STATUS_LABEL[item.contentStatus] ?? item.contentStatus}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.tabBar, { borderColor: theme.colors.borderSoft }]}>
        {(
          [
            { id: 'flash' as const, icon: 'grid' },
            { id: 'clip' as const, icon: 'reels' },
          ] as const
        ).map(item => {
          const active = tab === item.id;
          return (
            <PressableScale
              key={item.id}
              accessibilityLabel={item.id === 'flash' ? 'Posts' : 'Clips'}
              onPress={() => setTab(item.id)}
              style={[styles.tabItem, { borderBottomColor: active ? theme.colors.textPrimary : 'transparent' }]}>
              <AppIcon
                name={item.icon}
                size={22}
                color={active ? theme.colors.textPrimary : theme.colors.textTertiary}
                strokeWidth={active ? 2.25 : 1.75}
              />
            </PressableScale>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <View
        style={[
          styles.topBar,
          { paddingTop: insets.top + 4, borderBottomColor: theme.colors.borderSoft },
        ]}>
        <PressableScale onPress={() => navigation.goBack()} style={styles.topHit} accessibilityLabel="Back">
          <AppIcon name="back" size={26} color={theme.colors.textPrimary} strokeWidth={2} />
        </PressableScale>
        <Text numberOfLines={1} style={[styles.title, { color: theme.colors.textPrimary }]}>
          {publisher?.handle ?? publisher?.displayName ?? ''}
        </Text>
        <View style={styles.topHit} />
      </View>
      <FlatList
        data={posts}
        key={`${activeRef?.id ?? 'none'}-${tab}`}
        numColumns={3}
        keyExtractor={item => item.id}
        ListHeaderComponent={header}
        refreshing={postsQuery.isRefetching}
        onRefresh={() => {
          refetchProfile();
          refetchPosts();
          if (isOwner) refetchMine();
        }}
        columnWrapperStyle={posts.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {postsQuery.isLoading
                ? 'Loading…'
                : tab === 'clip'
                  ? 'No clips yet'
                  : 'No posts yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const thumb = thumbnailOf(item);
          const isClip = item.format === 'clip' && item.mediaType === 'video';
          return (
            <PressableScale
              disabled={!isClip}
              accessibilityLabel={isClip ? 'Open clip' : undefined}
              onPress={() =>
                navigation.navigate('Main', {
                  screen: 'PlayFeed',
                  params: {
                    reelId: item.id,
                    profileType: activeRef?.type,
                    profileId: activeRef?.id,
                  },
                })
              }
              style={[
                styles.cell,
                { width: cellSize, height: cellSize, backgroundColor: theme.colors.surfaceMuted },
              ]}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.cellImage} />
              ) : (
                <Text numberOfLines={4} style={[theme.typography.caption, styles.cellText, { color: theme.colors.textPrimary }]}>
                  {item.caption}
                </Text>
              )}
              {item.mediaType === 'video' ? (
                <View style={styles.videoBadge}>
                  <AppIcon name="play" size={16} color="#fff" strokeWidth={2} fill="#fff" />
                </View>
              ) : null}
            </PressableScale>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topHit: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  header: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 28 },
  avatar: { width: 86, height: 86, borderRadius: 43 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingRight: 8 },
  statItem: { alignItems: 'center', gap: 2 },
  statNumber: { fontSize: 16, fontWeight: '700' },
  statLabel: { fontSize: 14 },
  identity: { gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  displayName: { fontSize: 14, fontWeight: '700' },
  progressCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 8 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressCaption: { flex: 1 },
  tabBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 4 },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  gridRow: { gap: 1, marginBottom: 1 },
  cell: { marginBottom: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cellImage: { width: '100%', height: '100%' },
  cellText: { padding: 8 },
  videoBadge: { position: 'absolute', top: 8, right: 8 },
  empty: { alignItems: 'center', paddingVertical: 48 },
});
