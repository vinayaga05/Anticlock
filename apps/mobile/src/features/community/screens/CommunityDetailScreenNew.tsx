import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  useCommunityQuery,
  useCommunityPostsQuery,
  useLeaveCommunityMutation,
  useLikePostMutation,
  useUnlikePostMutation,
  useReportPostMutation,
  isApiEnabled,
} from '@/shared/api';
import type { CommunityPost } from '@anticlock/contracts';

export function CommunityDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { communityId } = route.params;

  const {
    data: community,
    isLoading: isCommunityLoading,
    error: communityError,
    refetch: refetchCommunity,
  } = useCommunityQuery(communityId);
  const {
    data: postsData,
    isLoading: isPostsLoading,
    error: postsError,
    refetch: refetchPosts,
  } = useCommunityPostsQuery(communityId);
  const leaveMutation = useLeaveCommunityMutation();
  const likeMutation = useLikePostMutation();
  const unlikeMutation = useUnlikePostMutation();
  const reportMutation = useReportPostMutation();

  const posts = postsData?.posts ?? [];

  const handleLeave = async () => {
    Alert.alert('Leave Community', 'Are you sure you want to leave this community?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveMutation.mutateAsync(communityId);
            navigation.goBack();
          } catch (err) {
            console.error('Failed to leave community:', err);
          }
        },
      },
    ]);
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      if (isLiked) {
        await unlikeMutation.mutateAsync({ postId, communityId });
      } else {
        await likeMutation.mutateAsync({ postId, communityId });
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    }
  };

  const handleReport = (postId: string) => {
    Alert.alert('Report Post', 'Why are you reporting this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Spam',
        onPress: () => reportPost(postId, 'spam'),
      },
      {
        text: 'Harassment',
        onPress: () => reportPost(postId, 'harassment'),
      },
      {
        text: 'Inappropriate',
        onPress: () => reportPost(postId, 'inappropriate'),
      },
      {
        text: 'Other',
        onPress: () => reportPost(postId, 'other'),
      },
    ]);
  };

  const reportPost = async (postId: string, reason: string) => {
    try {
      await reportMutation.mutateAsync({
        postId,
        request: { reason: reason as any },
      });
      Alert.alert('Reported', 'Thank you for reporting. We will review it soon.');
    } catch (err) {
      console.error('Failed to report post:', err);
    }
  };

  const isLoading = isCommunityLoading || isPostsLoading;
  const error = communityError || postsError;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}>
          <AppHeader
            title={community?.name ?? 'Community'}
            showBack
            onBack={() => navigation.goBack()}
          />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.padded, { gap: 16, paddingVertical: 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => {
                refetchCommunity();
                refetchPosts();
              }}
              tintColor={theme.colors.primary}
            />
          }>
          {!isApiEnabled ? (
            <View
              style={[
                styles.notice,
                { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
              ]}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                API is disabled. Using mock data.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View
              style={[
                styles.notice,
                { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
              ]}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.error }]}>
                Failed to load community. Please try again.
              </Text>
            </View>
          ) : null}

          {community ? (
            <>
              <View
                style={[
                  styles.header,
                  {
                    backgroundColor: theme.colors.surface,
                    borderRadius: theme.radius.lg,
                    ...theme.shadows.card,
                  },
                ]}>
                <Text style={[theme.typography.h2, { color: theme.colors.textPrimary }]}>
                  {community.name}
                </Text>
                {community.description ? (
                  <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                    {community.description}
                  </Text>
                ) : null}
                <View style={styles.stats}>
                  <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                    {community.memberCount} members · {community.postCount} posts
                  </Text>
                </View>
                {community.tags.length > 0 ? (
                  <View style={styles.tags}>
                    {community.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[
                          styles.tag,
                          {
                            backgroundColor: theme.colors.primarySoft,
                            borderRadius: theme.radius.pill,
                          },
                        ]}>
                        <Text
                          style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
                {community.isMember ? (
                  <View style={styles.actions}>
                    <Button
                      title="Create Post"
                      icon="plus"
                      onPress={() =>
                        navigation.navigate('CreateCommunityPost', { communityId })
                      }
                    />
                    <Button
                      title="Leave"
                      variant="secondary"
                      onPress={handleLeave}
                      disabled={leaveMutation.isPending}
                    />
                  </View>
                ) : null}
              </View>

              <View style={{ gap: 8 }}>
                <Text style={[theme.typography.h3, { color: theme.colors.textPrimary }]}>
                  Posts
                </Text>
                {posts.length === 0 ? (
                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 20 },
                    ]}>
                    No posts yet. {community.isMember ? 'Be the first to post!' : ''}
                  </Text>
                ) : null}
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={() => handleLike(post.id, post.isLiked ?? false)}
                    onComment={() =>
                      navigation.navigate('CommunityPostComments', {
                        postId: post.id,
                        communityId,
                      })
                    }
                    onReport={() => handleReport(post.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

function PostCard({
  post,
  onLike,
  onComment,
  onReport,
}: {
  post: CommunityPost;
  onLike: () => void;
  onComment: () => void;
  onReport: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.postCard,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          ...theme.shadows.card,
        },
      ]}>
      <View style={styles.postHeader}>
        <Text style={[theme.typography.bodyBold, { color: theme.colors.textPrimary }]}>
          {post.authorName}
        </Text>
        <PressableScale onPress={onReport}>
          <AppIcon name="more-horizontal" size={20} color={theme.colors.textTertiary} />
        </PressableScale>
      </View>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
        {post.content}
      </Text>
      {post.mediaUrl ? (
        <View
          style={[
            styles.mediaPlaceholder,
            { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md },
          ]}>
          <AppIcon name="image" size={32} color={theme.colors.textTertiary} />
        </View>
      ) : null}
      <View style={styles.postActions}>
        <PressableScale onPress={onLike} style={styles.action}>
          <AppIcon
            name={post.isLiked ? 'heart' : 'heart'}
            size={20}
            color={post.isLiked ? theme.colors.error : theme.colors.textSecondary}
          />
          <Text
            style={[
              theme.typography.caption,
              { color: post.isLiked ? theme.colors.error : theme.colors.textSecondary },
            ]}>
            {post.likeCount}
          </Text>
        </PressableScale>
        <PressableScale onPress={onComment} style={styles.action}>
          <AppIcon name="message-circle" size={20} color={theme.colors.textSecondary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {post.commentCount}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  notice: { padding: 12 },
  header: { padding: 16, gap: 12 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  postCard: { padding: 16, gap: 12 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mediaPlaceholder: { height: 200, justifyContent: 'center', alignItems: 'center' },
  postActions: { flexDirection: 'row', gap: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
