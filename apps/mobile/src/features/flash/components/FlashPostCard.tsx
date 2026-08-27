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
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { FlashPost, PostVisibility } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { FlashActionRow } from '@/features/flash/components/FlashActionRow';
import { ReactionPicker, REACTION_META } from '@/features/flash/components/ReactionPicker';
import { FlashShareSheet } from '@/features/flash/components/FlashShareSheet';
import { conversations } from '@/shared/data/mocks';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';

const VISIBILITY_LABEL: Record<PostVisibility, string> = {
  public: 'Public',
  followers: 'Followers',
  friends: 'Friends',
  community: 'Community',
  only_me: 'Only me',
};

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}

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
  const [mediaReady, setMediaReady] = useState<Record<string, boolean>>({});

  const total = Object.values(post.reactionCounts).reduce((a, b) => a + (b ?? 0), 0);
  const topReactions = REACTION_META.filter(r => (post.reactionCounts[r.id] ?? 0) > 0).slice(
    0,
    3,
  );
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

  return (
    <Card style={styles.card} elevated>
      <View style={styles.header}>
        <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} />
        <View style={styles.headerMeta}>
          <View style={styles.nameRow}>
            <Text
              style={[styles.authorName, { color: theme.colors.textPrimary }]}
              numberOfLines={1}>
              {post.author.name}
            </Text>
            {post.author.verified ? (
              <AppIcon name="verified" size={16} color={theme.colors.primary} strokeWidth={2} />
            ) : null}
          </View>
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
          <AppIcon name="more" size={22} color={theme.colors.textTertiary} strokeWidth={2} />
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
              borderRadius: 18,
            },
          ]}>
          <AppIcon name="reels" size={20} color={theme.colors.primary} strokeWidth={2} />
          <Text
            style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, flex: 1 }]}
            numberOfLines={1}>
            {post.sharedClipTitle}
          </Text>
        </View>
      ) : null}

      {post.media.length > 0 ? (
        <View style={styles.mediaRow}>
          {post.media.slice(0, 2).map((m, idx) => (
            <View
              key={m.id}
              style={[
                styles.mediaItem,
                post.media.length === 1 ? styles.mediaSingle : null,
                { backgroundColor: theme.colors.surfaceMuted },
              ]}>
              <Image
                source={{ uri: m.type === 'video' ? m.posterUrl ?? m.url : m.url }}
                style={[styles.mediaImage, { opacity: mediaReady[m.id] ? 1 : 0 }]}
                onLoad={() => setMediaReady(prev => ({ ...prev, [m.id]: true }))}
              />
              {m.type === 'video' ? (
                <View style={styles.playBadge}>
                  <AppIcon name="play" size={20} color="#fff" strokeWidth={2} fill="#fff" />
                </View>
              ) : null}
              {idx === 1 && post.media.length > 2 ? (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{post.media.length - 2}</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {post.linkPreview ? (
        <View
          style={[
            styles.link,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}>
          {post.linkPreview.imageUrl ? (
            <Image source={{ uri: post.linkPreview.imageUrl }} style={styles.linkImage} />
          ) : null}
          <View style={styles.linkBody}>
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

      <View style={styles.summary}>
        <View style={styles.reactSummary}>
          <View style={styles.reactStack}>
            {topReactions.map((r, index) => (
              <View
                key={r.id}
                style={[
                  styles.reactBubble,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.background,
                    marginLeft: index === 0 ? 0 : -6,
                    zIndex: topReactions.length - index,
                  },
                ]}>
                <AppIcon
                  name={r.icon}
                  size={11}
                  color={r.color}
                  strokeWidth={1.75}
                  fill={r.id === 'like' || r.id === 'love' ? r.color : 'none'}
                />
              </View>
            ))}
          </View>
          <Text
            style={[styles.summaryText, { color: theme.colors.textSecondary }]}
            numberOfLines={1}>
            {formatCount(total)} reactions
          </Text>
        </View>
        <Text
          style={[styles.summaryRight, { color: theme.colors.textSecondary }]}
          numberOfLines={1}>
          {formatCount(post.commentCount)} comments
        </Text>
      </View>

      <FlashActionRow
        viewerReaction={post.viewerReaction}
        saved={post.saved}
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: 24,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  metaText: {
    fontSize: 14,
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyBlock: {
    gap: 4,
  },
  seeMore: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  mediaRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  mediaItem: {
    flex: 1,
    aspectRatio: 16 / 9,
    borderRadius: 18,
    overflow: 'hidden',
  },
  mediaSingle: {
    flex: 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  moreText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  link: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  linkImage: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  linkBody: {
    padding: 12,
    gap: 2,
  },
  clipShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: -2,
    paddingTop: 0,
  },
  reactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  reactStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    fontSize: 13,
    flexShrink: 1,
  },
  summaryRight: {
    fontSize: 13,
    flexShrink: 1,
    textAlign: 'right',
  },
});
