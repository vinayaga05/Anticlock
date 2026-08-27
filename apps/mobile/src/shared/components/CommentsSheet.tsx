import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { CURRENT_USER } from '@/shared/data/flash';
import { FlashComment } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.62);

function formatCount(n: number) {
  return n.toLocaleString();
}

function relativeTime(iso: string) {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export type CommentsSheetProps = {
  contentId: string;
  commentCount: number;
  visible: boolean;
  onClose: () => void;
  /** Dim the peek area (useful on Flash feed). Default false for Clips video peek. */
  dimBackdrop?: boolean;
  commentsEnabled?: boolean;
};

export function CommentsSheet({
  contentId,
  commentCount,
  visible,
  onClose,
  dimBackdrop = false,
  commentsEnabled = true,
}: CommentsSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const comments = useEngagementStore(s => s.comments);
  const createComment = useEngagementStore(s => s.createComment);
  const createReply = useEngagementStore(s => s.createReply);
  const toggleCommentLike = useEngagementStore(s => s.toggleCommentLike);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<FlashComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  const roots = useMemo(
    () =>
      comments
        .filter(c => c.postId === contentId && !c.parentId)
        .sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
    [comments, contentId],
  );

  const repliesFor = (parentId: string) =>
    comments.filter(c => c.parentId === parentId);

  const liveCount = Math.max(
    commentCount,
    comments.filter(c => c.postId === contentId).length,
  );

  const submit = () => {
    if (!commentsEnabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (replyTo) {
      createReply(contentId, replyTo.id, trimmed);
      setExpandedReplies(prev => ({ ...prev, [replyTo.id]: true }));
      setReplyTo(null);
    } else {
      createComment(contentId, trimmed);
    }
    setText('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none">
        <Pressable
          style={[
            styles.peek,
            dimBackdrop ? { backgroundColor: 'rgba(0,0,0,0.35)' } : null,
          ]}
          onPress={onClose}
          accessibilityLabel="Close comments"
        />

        <View
          style={[
            styles.sheet,
            {
              height: SHEET_HEIGHT + insets.bottom,
              backgroundColor: theme.colors.backgroundElevated,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}>
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
                Comments
              </Text>
              <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                {formatCount(liveCount)} comments
              </Text>
            </View>
            <PressableScale onPress={onClose} accessibilityLabel="Close">
              <View
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: theme.radius.pill,
                  },
                ]}>
                <AppIcon name="close" size={18} color={theme.colors.textPrimary} />
              </View>
            </PressableScale>
          </View>

          {!commentsEnabled ? (
            <View style={styles.disabledWrap}>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, textAlign: 'center' },
                ]}>
                Comments are turned off for this post.
              </Text>
            </View>
          ) : (
            <FlatList
              data={roots}
              keyExtractor={item => item.id}
              style={styles.list}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text
                  style={[
                    theme.typography.bodySmall,
                    {
                      color: theme.colors.textTertiary,
                      textAlign: 'center',
                      paddingVertical: 24,
                    },
                  ]}>
                  No comments yet. Start the conversation.
                </Text>
              }
              renderItem={({ item }) => {
                const replies = repliesFor(item.id);
                const open = !!expandedReplies[item.id];
                return (
                  <View style={styles.thread}>
                    <CommentRow
                      comment={item}
                      onReply={() => setReplyTo(item)}
                      onLike={() => toggleCommentLike(item.id)}
                    />
                    {replies.length > 0 && !open ? (
                      <PressableScale
                        onPress={() =>
                          setExpandedReplies(prev => ({ ...prev, [item.id]: true }))
                        }
                        style={styles.viewReplies}>
                        <Text
                          style={[
                            theme.typography.caption,
                            { color: theme.colors.textSecondary, fontWeight: '600' },
                          ]}>
                          View {replies.length}{' '}
                          {replies.length === 1 ? 'reply' : 'replies'}
                        </Text>
                      </PressableScale>
                    ) : null}
                    {open
                      ? replies.map(r => (
                          <View key={r.id} style={styles.replyIndent}>
                            <CommentRow
                              comment={r}
                              onReply={() => setReplyTo(item)}
                              onLike={() => toggleCommentLike(r.id)}
                            />
                          </View>
                        ))
                      : null}
                  </View>
                );
              }}
            />
          )}

          {commentsEnabled ? (
            <View style={[styles.composer, { borderTopColor: theme.colors.borderSoft }]}>
              {replyTo ? (
                <View style={styles.replyBanner}>
                  <Text
                    style={[
                      theme.typography.caption,
                      { color: theme.colors.textSecondary, flex: 1 },
                    ]}
                    numberOfLines={1}>
                    Replying to @{replyTo.author.name}
                  </Text>
                  <PressableScale onPress={() => setReplyTo(null)}>
                    <Text
                      style={[theme.typography.caption, { color: theme.colors.primary }]}>
                      Cancel
                    </Text>
                  </PressableScale>
                </View>
              ) : null}
              <View style={styles.composerRow}>
                <Image source={{ uri: CURRENT_USER.avatarUrl }} style={styles.composerAvatar} />
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Add a comment…"
                  placeholderTextColor={theme.colors.textTertiary}
                  style={[
                    styles.input,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceMuted,
                      borderRadius: theme.radius.pill,
                    },
                  ]}
                  onSubmitEditing={submit}
                  returnKeyType="send"
                />
                <PressableScale onPress={submit} accessibilityLabel="Send comment">
                  <Text
                    style={[
                      theme.typography.body,
                      {
                        color: text.trim()
                          ? theme.colors.primary
                          : theme.colors.textTertiary,
                        fontWeight: '700',
                      },
                    ]}>
                    Send
                  </Text>
                </PressableScale>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function CommentRow({
  comment,
  onReply,
  onLike,
}: {
  comment: FlashComment;
  onReply: () => void;
  onLike: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.commentRow}>
      <Image source={{ uri: comment.author.avatarUrl }} style={styles.avatar} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text
          style={[
            theme.typography.caption,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}>
          {comment.author.name}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
          {comment.text}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {relativeTime(comment.createdAt)}
          </Text>
          <PressableScale onPress={onReply}>
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary, fontWeight: '600' },
              ]}>
              Reply
            </Text>
          </PressableScale>
          {comment.likeCount > 0 ? (
            <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
              {comment.likeCount} {comment.likeCount === 1 ? 'like' : 'likes'}
            </Text>
          ) : null}
          <PressableScale
            onPress={onLike}
            accessibilityLabel="Like comment"
            style={styles.heartHit}>
            <AppIcon
              name="heart"
              size={16}
              color={comment.liked ? theme.colors.like : theme.colors.textTertiary}
              strokeWidth={comment.liked ? 2.2 : 1.7}
            />
          </PressableScale>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  peek: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 16,
  },
  disabledWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  thread: {
    gap: 8,
  },
  commentRow: {
    flexDirection: 'row',
    gap: 10,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  heartHit: {
    marginLeft: 'auto',
  },
  viewReplies: {
    marginLeft: 46,
    paddingVertical: 2,
  },
  replyIndent: {
    marginLeft: 36,
  },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  composerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
});
