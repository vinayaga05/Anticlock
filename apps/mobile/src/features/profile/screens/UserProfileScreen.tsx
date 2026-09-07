import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  CURRENT_USER,
  FlashPost,
  formatProfileCount,
  getProfileHighlights,
  getProfileMeta,
  resolveProfileUser,
  useProfileStore,
} from '@/shared/data/flash';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useAuth } from '@/shared/context/AuthProvider';

type ProfileTab = 'posts' | 'reels' | 'tagged';

type GridItem = {
  id: string;
  postId: string;
  uri: string | number;
  isVideo?: boolean;
};

function getPostThumbnail(post: FlashPost) {
  const media = post.media[0];
  if (media) {
    return media.type === 'video' ? media.posterUrl ?? media.url : media.url;
  }
  if (post.linkPreview?.imageUrl) return post.linkPreview.imageUrl;
  if (post.attachment?.imageUrl) return post.attachment.imageUrl;
  return null;
}

export function UserProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'Profile'>>();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const cellSize = (screenWidth - 2) / 3;
  const { user: authUser } = useAuth();

  const userId = route.params?.userId ?? CURRENT_USER.id;
  const baseUser = resolveProfileUser(userId);
  const user =
    userId === CURRENT_USER.id && baseUser
      ? {
          ...baseUser,
          name: authUser?.displayName ?? baseUser.name,
          avatarUrl: authUser?.avatarUrl ?? baseUser.avatarUrl,
        }
      : baseUser;
  const meta = getProfileMeta(userId);
  const allPosts = useEngagementStore(s => s.posts);
  const followingIds = useProfileStore(s => s.followingIds);
  const isFollowing = useProfileStore(s => s.isFollowing(userId));
  const toggleFollow = useProfileStore(s => s.toggleFollow);
  const getFollowerCount = useProfileStore(s => s.getFollowerCount);
  const getFollowingCount = useProfileStore(s => s.getFollowingCount);
  const getPostCount = useProfileStore(s => s.getPostCount);
  const storyRevision = useStoryStore(s => `${s.stories.length}-${s.archive.length}`);

  const posts = useMemo(
    () => allPosts.filter(p => p.author.id === userId && !p.hidden),
    [allPosts, userId],
  );

  const [tab, setTab] = useState<ProfileTab>('posts');

  const isOwnProfile = userId === CURRENT_USER.id;
  const profileBio = isOwnProfile ? authUser?.bio ?? meta.bio : meta.bio;
  const profileLocation = isOwnProfile ? authUser?.location ?? meta.location : meta.location;
  const profileWebsite = isOwnProfile ? authUser?.website : undefined;
  const postCount = getPostCount(userId);
  const followerCount = getFollowerCount(userId);
  const followingCount = getFollowingCount(userId);

  const highlights = useMemo(
    () => getProfileHighlights(userId),
    [userId, storyRevision, followingIds],
  );

  const gridItems = useMemo<GridItem[]>(() => {
    if (tab === 'tagged') return [];
    return posts.flatMap(post => {
      if (tab === 'reels') {
        const videos = post.media.filter(m => m.type === 'video');
        return videos.map(m => ({
          id: `${post.id}-${m.id}`,
          postId: post.id,
          uri: m.posterUrl ?? m.url,
          isVideo: true,
        }));
      }
      const thumb = getPostThumbnail(post);
      if (!thumb) return [];
      const hasVideo = post.media.some(m => m.type === 'video');
      return [
        {
          id: post.id,
          postId: post.id,
          uri: thumb,
          isVideo: hasVideo && post.media.length === 1,
        },
      ];
    });
  }, [posts, tab]);

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <Text style={{ color: theme.colors.textSecondary }}>User not found</Text>
      </View>
    );
  }

  const openSettings = () => navigation.navigate('AccountSettings');

  const onShareProfile = async () => {
    await Share.share({
      message: `Check out @${meta.username} on Anticlock`,
    });
  };

  const onFollowPress = () => {
    toggleFollow(user.id);
  };

  const onHighlightPress = (highlightId: string) => {
    if (highlightId === 'hl-new') {
      navigation.navigate('StoryCreator');
      return;
    }
    if (highlightId.startsWith('hl-story-') || highlightId === 'shortcut-story') {
      navigation.navigate('StoryViewer', { authorId: userId });
      return;
    }
    if (highlightId === 'hl-archive') {
      navigation.navigate('ComingSoon', { title: 'Story Archive' });
      return;
    }
  };

  const openPost = (postId: string) => {
    navigation.navigate('FlashComments', { postId });
  };

  const renderHeader = () => (
    <View style={styles.headerBlock}>
      <View style={styles.statsRow}>
        <View style={styles.avatarWrap}>
          <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          {isOwnProfile ? (
            <PressableScale
              onPress={() => navigation.navigate('StoryCreator')}
              style={[styles.avatarAdd, { backgroundColor: theme.colors.primary }]}>
              <AppIcon name="plus" size={14} color="#fff" strokeWidth={2.5} />
            </PressableScale>
          ) : null}
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.textPrimary }]}>
              {formatProfileCount(postCount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textPrimary }]}>posts</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.textPrimary }]}>
              {formatProfileCount(followerCount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textPrimary }]}>
              followers
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.textPrimary }]}>
              {formatProfileCount(followingCount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textPrimary }]}>
              following
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: theme.colors.textPrimary }]}>
            {user.name}
          </Text>
          {user.verified ? (
            <AppIcon name="verified" size={14} color={theme.colors.primary} strokeWidth={2} />
          ) : null}
        </View>
        {profileLocation ? (
          <View style={styles.locationRow}>
            <AppIcon name="location" size={13} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.locationText, { color: theme.colors.textPrimary }]}>
              {profileLocation}
            </Text>
          </View>
        ) : null}
        {profileBio ? (
          <Text style={[styles.bio, { color: theme.colors.textPrimary }]}>{profileBio}</Text>
        ) : null}
        {profileWebsite ? (
          <View style={styles.locationRow}>
            <AppIcon name="globe" size={13} color={theme.colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.locationText, { color: theme.colors.link }]} numberOfLines={1}>
              {profileWebsite}
            </Text>
          </View>
        ) : null}
        {isOwnProfile ? (
          <PressableScale style={[styles.bannerBtn, { borderColor: theme.colors.border }]}>
            <Text style={[styles.bannerBtnText, { color: theme.colors.textPrimary }]}>
              + Add banners
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <View style={styles.actionsRow}>
        {isOwnProfile ? (
          <>
            <PressableScale
              onPress={() => navigation.navigate('EditProfile')}
              style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>
                Edit profile
              </Text>
            </PressableScale>
            <PressableScale
              onPress={onShareProfile}
              style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>
                Share profile
              </Text>
            </PressableScale>
          </>
        ) : (
          <>
            <PressableScale
              onPress={onFollowPress}
              style={[
                styles.actionBtn,
                {
                  backgroundColor: isFollowing
                    ? theme.colors.surfaceMuted
                    : theme.colors.primary,
                },
              ]}>
              <Text
                style={[
                  styles.actionBtnText,
                  {
                    color: isFollowing ? theme.colors.textPrimary : theme.colors.textInverse,
                  },
                ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </PressableScale>
            <PressableScale
              onPress={() => navigation.navigate('Thread', { conversationId: 'msg-1' })}
              style={[styles.actionBtn, { backgroundColor: theme.colors.surfaceMuted }]}>
              <Text style={[styles.actionBtnText, { color: theme.colors.textPrimary }]}>
                Message
              </Text>
            </PressableScale>
          </>
        )}
        <PressableScale
          style={[styles.actionBtnIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
          <AppIcon name="follow" size={18} color={theme.colors.textPrimary} strokeWidth={2} />
        </PressableScale>
      </View>

      {highlights.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.highlightsRow}>
          {highlights.map(item => (
            <PressableScale
              key={item.id}
              onPress={() => onHighlightPress(item.id)}
              style={styles.highlightItem}>
              <View
                style={[
                  styles.highlightRing,
                  {
                    borderColor: item.id.startsWith('hl-story-')
                      ? theme.colors.primary
                      : theme.colors.border,
                    backgroundColor: item.isNew
                      ? theme.colors.background
                      : theme.colors.surfaceMuted,
                  },
                ]}>
                {item.isNew ? (
                  <AppIcon name="plus" size={22} color={theme.colors.textPrimary} strokeWidth={2} />
                ) : item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.highlightImage} />
                ) : null}
              </View>
              <Text
                style={[styles.highlightLabel, { color: theme.colors.textPrimary }]}
                numberOfLines={1}>
                {item.label}
              </Text>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}

      <View style={[styles.tabBar, { borderColor: theme.colors.borderSoft }]}>
        {(
          [
            { id: 'posts' as const, icon: 'grid' },
            { id: 'reels' as const, icon: 'reels' },
            { id: 'tagged' as const, icon: 'user' },
          ] as const
        ).map(item => {
          const active = tab === item.id;
          return (
            <PressableScale
              key={item.id}
              onPress={() => setTab(item.id)}
              style={[
                styles.tabItem,
                active ? { borderBottomColor: theme.colors.textPrimary } : null,
              ]}>
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
          {
            paddingTop: insets.top + 4,
            borderBottomColor: theme.colors.borderSoft,
            backgroundColor: theme.colors.background,
          },
        ]}>
        <PressableScale
          onPress={() => navigation.goBack()}
          style={styles.topHit}
          accessibilityLabel="Back">
          <AppIcon name="back" size={26} color={theme.colors.textPrimary} strokeWidth={2} />
        </PressableScale>

        <PressableScale style={styles.usernameRow}>
          {meta.isPrivate ? (
            <AppIcon name="lock" size={14} color={theme.colors.textPrimary} strokeWidth={2} />
          ) : null}
          <Text style={[styles.username, { color: theme.colors.textPrimary }]} numberOfLines={1}>
            {meta.username}
          </Text>
          {isOwnProfile ? (
            <AppIcon
              name="chevron-down"
              size={16}
              color={theme.colors.textPrimary}
              strokeWidth={2.5}
            />
          ) : null}
        </PressableScale>

        <View style={styles.topRight}>
          {isOwnProfile ? (
            <>
              <PressableScale
                onPress={() => navigation.navigate('FlashComposer')}
                style={styles.topHit}
                accessibilityLabel="Create">
                <AppIcon name="plus" size={24} color={theme.colors.textPrimary} strokeWidth={2} />
              </PressableScale>
              <PressableScale style={styles.topHit} accessibilityLabel="Activity">
                <AppIcon name="send" size={22} color={theme.colors.textPrimary} strokeWidth={2} />
              </PressableScale>
            </>
          ) : null}
          <PressableScale
            onPress={
              isOwnProfile
                ? openSettings
                : () => Alert.alert('Options', undefined, [{ text: 'OK' }])
            }
            style={styles.topHit}
            accessibilityLabel="Menu">
            <AppIcon name="more" size={24} color={theme.colors.textPrimary} strokeWidth={2} />
          </PressableScale>
        </View>
      </View>

      <FlatList
        data={gridItems}
        key={`${userId}-${tab}-${gridItems.length}`}
        numColumns={3}
        keyExtractor={item => item.id}
        ListHeaderComponent={renderHeader}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={gridItems.length > 0 ? styles.gridRow : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListEmptyComponent={
          <View style={styles.emptyGrid}>
            <AppIcon
              name={tab === 'reels' ? 'reels' : tab === 'tagged' ? 'user' : 'camera'}
              size={40}
              color={theme.colors.textTertiary}
              strokeWidth={1.5}
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {tab === 'tagged'
                ? 'Photos and videos you are tagged in will appear here.'
                : tab === 'reels'
                  ? 'Nothing to play yet'
                  : 'No posts yet'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => openPost(item.postId)}
            style={[styles.gridCell, { width: cellSize, height: cellSize }]}>
            <Image
              source={
                typeof item.uri === 'number' ? item.uri : { uri: String(item.uri) }
              }
              style={styles.gridImage}
            />
            {item.isVideo ? (
              <View style={styles.videoBadge}>
                <AppIcon name="play" size={16} color="#fff" strokeWidth={2} fill="#fff" />
              </View>
            ) : null}
          </PressableScale>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  username: {
    fontSize: 18,
    fontWeight: '700',
    maxWidth: '70%',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBlock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarAdd: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 8,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 14,
  },
  identity: {
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  displayName: {
    fontSize: 14,
    fontWeight: '700',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 14,
  },
  bio: {
    fontSize: 14,
    lineHeight: 18,
  },
  bannerBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnIcon: {
    width: 36,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightsRow: {
    gap: 16,
    paddingRight: 16,
  },
  highlightItem: {
    width: 68,
    alignItems: 'center',
    gap: 6,
  },
  highlightRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  highlightImage: {
    width: '100%',
    height: '100%',
  },
  highlightLabel: {
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  gridRow: {
    gap: 1,
    marginBottom: 1,
  },
  gridCell: {
    marginBottom: 1,
    backgroundColor: '#efefef',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  emptyGrid: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
