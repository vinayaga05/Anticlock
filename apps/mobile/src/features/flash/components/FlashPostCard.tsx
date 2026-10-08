import React, { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { FlashPost, PostVisibility } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { FlashActionRow } from '@/features/flash/components/FlashActionRow';
import { FlashMediaCarousel } from '@/features/flash/components/FlashMediaCarousel';
import { PostEndDivider } from '@/features/flash/components/PostEndDivider';
import { ReactionPicker } from '@/features/flash/components/ReactionPicker';
import { FlashShareSheet } from '@/features/flash/components/FlashShareSheet';
import { conversations } from '@/shared/data/mocks';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

const CONTENT_PAD = 12;

const VISIBILITY_LABEL: Record<PostVisibility, string> = {
  public: 'Public',
  followers: 'Followers',
  friends: 'Friends',
  community: 'Community',
  only_me: 'Only me',
};

type Props = {
  post: FlashPost;
};

export function FlashPostCard({ post }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const toggleLike = useEngagementStore(s => s.toggleLike);
  const setReaction = useEngagementStore(s => s.setReaction);
  const toggleSavePost = useEngagementStore(s => s.toggleSavePost);
  const hidePost = useEngagementStore(s => s.hidePost);
  const deletePost = useEngagementStore(s => s.deletePost);
  const setPostVisibility = useEngagementStore(s => s.setPostVisibility);
  const toggleComments = useEngagementStore(s => s.toggleComments);
  const pinPost = useEngagementStore(s => s.pinPost);
  const followAuthor = useEngagementStore(s => s.followAuthor);
  const openComments = useCommentsSheetStore(s => s.openComments);

  const [expanded, setExpanded] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const total = Object.values(post.reactionCounts).reduce((a, b) => a + (b ?? 0), 0);
  const longText = (post.text?.length ?? 0) > 160;
  const displayText =
    longText && !expanded ? `${post.text!.slice(0, 160)}…` : post.text;

  const openMenu = () => {
    if (post.isOwn) {
      Alert.alert('Post options', undefined, [
        {
          text: 'Edit visibility',
          onPress: () =>
            Alert.alert('Visibility', undefined, [
              { text: 'Public', onPress: () => setPostVisibility(post.id, 'public') },
              { text: 'Followers', onPress: () => setPostVisibility(post.id, 'followers') },
              { text: 'Friends', onPress: () => setPostVisibility(post.id, 'friends') },
              { text: 'Only me', onPress: () => setPostVisibility(post.id, 'only_me') },
              { text: 'Cancel', style: 'cancel' },
            ]),
        },
        {
          text: post.commentsEnabled === false ? 'Turn comments on' : 'Turn comments off',
          onPress: () => toggleComments(post.id),
        },
        { text: 'Save post', onPress: () => toggleSavePost(post.id) },
        {
          text: post.pinned ? 'Unpin post' : 'Pin post',
          onPress: () => pinPost(post.id),
        },
        {
          text: 'Delete post',
          style: 'destructive',
          onPress: () => deletePost(post.id),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Post options', undefined, [
        { text: 'Save post', onPress: () => toggleSavePost(post.id) },
        { text: 'Hide post', onPress: () => hidePost(post.id) },
        {
          text: post.author.followed ? 'Unfollow' : 'Follow',
          onPress: () => followAuthor(post.author.id, !post.author.followed),
        },
        {
          text: 'Mute user',
          onPress: () => Alert.alert('Muted', `${post.author.name} muted (mock).`),
        },
        {
          text: 'Report post',
          onPress: () => Alert.alert('Reported', 'Thanks — we will review this (mock).'),
        },
        {
          text: 'Copy link',
          onPress: () => setShareOpen(true),
        },
        {
          text: 'Block user',
          style: 'destructive',
          onPress: () => Alert.alert('Blocked', `${post.author.name} blocked (mock).`),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const openAuthorProfile = () =>
    navigation.navigate(
      'Profile',
      post.source === 'api' && post.publisherProfileId && post.publisherProfileType
        ? {
            profileType: post.publisherProfileType,
            profileId: post.publisherProfileId,
          }
        : { userId: post.author.id },
    );

  return (
    <View style={[styles.post, { backgroundColor: theme.colors.background }]}>
      <View style={styles.contentPad}>
        <View style={styles.header}>
          <PressableScale onPress={openAuthorProfile} accessibilityLabel={`Open ${post.author.name} profile`}>
            <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
          </PressableScale>
          <View style={styles.headerMeta}>
            <PressableScale onPress={openAuthorProfile} accessibilityLabel={`Open ${post.author.name} profile`}>
              <View style={styles.nameRow}>
                <Text
                  style={[styles.authorName, { color: theme.colors.textPrimary }]}
                  numberOfLines={1}>
                  {post.author.name}
                </Text>
                {post.author.verified ? (
                  <AppIcon name="verified" size={14} color={theme.colors.primary} strokeWidth={2} />
                ) : null}
              </View>
            </PressableScale>
            <Text
              style={[styles.metaText, { color: theme.colors.textTertiary }]}
              numberOfLines={1}>
              {post.timeLabel} · {VISIBILITY_LABEL[post.visibility]}
              {post.pinned ? ' · Pinned' : ''}
            </Text>
            {post.communityName ? (
              <PressableScale
                onPress={() => navigation.navigate('Main', { screen: 'Community' })}
                accessibilityLabel={`Open ${post.communityName}`}>
                <Text style={[styles.metaText, { color: theme.colors.primary }]}>
                  {post.communityName}
                </Text>
              </PressableScale>
            ) : null}
          </View>
          {!post.isOwn && !post.author.followed ? (
            <PressableScale
              onPress={() => followAuthor(post.author.id, true)}
              scaleTo={0.96}
              style={[
                styles.follow,
                {
                  borderColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <Text style={[styles.followLabel, { color: theme.colors.primary }]}>Follow</Text>
            </PressableScale>
          ) : null}
          <PressableScale
            onPress={openMenu}
            accessibilityLabel="Post menu"
            scaleTo={0.96}
            style={styles.menuHit}>
            <AppIcon name="more" size={20} color={theme.colors.textTertiary} strokeWidth={2} />
          </PressableScale>
        </View>

        {displayText ? (
          <Pressable onPress={() => longText && setExpanded(e => !e)} style={styles.bodyBlock}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
              {displayText}
            </Text>
            {longText ? (
              <Text style={[styles.seeMore, { color: theme.colors.primary }]}>
                {expanded ? 'Show less' : 'See more'}
              </Text>
            ) : null}
          </Pressable>
        ) : null}

        {post.sharedClipTitle ? (
          <View
            style={[
              styles.clipShare,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderRadius: 8,
              },
            ]}>
            <AppIcon name="reels" size={18} color={theme.colors.primary} strokeWidth={2} />
            <Text
              style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, flex: 1 }]}
              numberOfLines={1}>
              {post.sharedClipTitle}
            </Text>
          </View>
        ) : null}
      </View>

      {post.media.length > 0 ? <FlashMediaCarousel media={post.media} /> : null}

      {post.linkPreview ? (
        <View style={[styles.link, { borderColor: theme.colors.border }]}>
          {post.linkPreview.imageUrl ? (
            <Image source={{ uri: post.linkPreview.imageUrl }} style={styles.linkImage} />
          ) : null}
          <View style={[styles.linkBody, styles.contentPad]}>
            <Text style={[styles.metaText, { color: theme.colors.textTertiary }]} numberOfLines={1}>
              {post.linkPreview.url.replace(/^https?:\/\//, '')}
            </Text>
            <Text
              style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}
              numberOfLines={2}>
              {post.linkPreview.title}
            </Text>
            <Text
              style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
              numberOfLines={2}>
              {post.linkPreview.description}
            </Text>
          </View>
        </View>
      ) : null}

      <FlashActionRow
        viewerReaction={post.viewerReaction}
        saved={post.saved}
        likeCount={total}
        commentCount={post.commentCount}
        shareCount={post.shareCount}
        onLikePress={() => toggleLike(post.id)}
        onLikeLongPress={() => setReactionsOpen(true)}
        onComment={() =>
          openComments({
            sourceType: 'flashPost',
            contentId: post.id,
            commentCount: post.commentCount,
            commentsEnabled: post.commentsEnabled !== false,
          })
        }
        onShare={() => setShareOpen(true)}
        onSave={() => toggleSavePost(post.id)}
      />

      <PostEndDivider id={post.id} />

      <ReactionPicker
        visible={reactionsOpen}
        onClose={() => setReactionsOpen(false)}
        selected={post.viewerReaction}
        onSelect={r => setReaction(post.id, r)}
      />
      <FlashShareSheet
        postId={post.id}
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        onSendKnock={() =>
          navigation.navigate('Thread', {
            conversationId: conversations[0]?.id ?? 'msg-1',
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    width: '100%',
    paddingTop: 10,
    gap: 8,
  },
  contentPad: {
    paddingHorizontal: CONTENT_PAD,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 40,
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerMeta: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  metaText: {
    fontSize: 13,
  },
  follow: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  followLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  menuHit: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyBlock: {
    gap: 2,
  },
  seeMore: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  link: {
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  linkImage: {
    width: '100%',
    aspectRatio: 4 / 5,
  },
  linkBody: {
    paddingVertical: 10,
    gap: 2,
    backgroundColor: 'transparent',
  },
  clipShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
});
