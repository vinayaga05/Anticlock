import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  FlatList,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { CURRENT_USER } from '@/shared/data/flash';
import { FlashComment } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import {
  CommentsSourceType,
  getSheetBottomInset,
} from '@/shared/store/commentsSheetStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CORNER_RADIUS = 27;
const TOP_GAP = 10;
const DEFAULT_VISIBLE = 0.72;

const SPRING = {
  damping: 22,
  stiffness: 220,
  mass: 0.85,
};

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

type Snap = 'default' | 'expanded';

export type CommentsBottomSheetProps = {
  sourceType: CommentsSourceType;
  contentId: string;
  commentCount: number;
  visible: boolean;
  closing?: boolean;
  commentsEnabled?: boolean;
  onCloseComplete: () => void;
  onPlaybackActiveChange?: (shouldPlay: boolean) => void;
};

/**
 * Instagram-style comments sheet shared by Clips and Flash.
 * Renders beneath the floating tab bar (parent supplies stacking).
 * Sheet bottom sits above the tab bar clearance.
 */
export function CommentsBottomSheet({
  sourceType: _sourceType,
  contentId,
  commentCount,
  visible,
  closing = false,
  commentsEnabled = true,
  onCloseComplete,
  onPlaybackActiveChange,
}: CommentsBottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();
  const bottomInset = getSheetBottomInset(insets.bottom);

  const comments = useEngagementStore(s => s.comments);
  const createComment = useEngagementStore(s => s.createComment);
  const createReply = useEngagementStore(s => s.createReply);
  const toggleCommentLike = useEngagementStore(s => s.toggleCommentLike);

  const expandedY = insets.top + TOP_GAP;
  const closedY = SCREEN_HEIGHT;
  const defaultY = expandedY + (1 - DEFAULT_VISIBLE) * (closedY - expandedY);
  const sheetHeight = closedY - expandedY;

  const translateY = useSharedValue(closedY);
  const backdrop = useSharedValue(0);
  const scrollOffset = useSharedValue(0);
  const dragStartY = useSharedValue(defaultY);
  const snapAtDragStart = useSharedValue(0);
  const lastTranslationY = useSharedValue(0);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<FlashComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [sheetMounted, setSheetMounted] = useState(false);
  const [snap, setSnap] = useState<Snap>('default');

  const nativeGesture = useMemo(() => Gesture.Native(), []);

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

  const notifyPlayback = useCallback(
    (play: boolean) => {
      onPlaybackActiveChange?.(play);
    },
    [onPlaybackActiveChange],
  );

  const finishClose = useCallback(() => {
    setSheetMounted(false);
    setSnap('default');
    setText('');
    setReplyTo(null);
    notifyPlayback(true);
    onCloseComplete();
  }, [notifyPlayback, onCloseComplete]);

  const snapToDefault = useCallback(() => {
    setSnap('default');
    notifyPlayback(true);
    translateY.value = withSpring(defaultY, SPRING);
    backdrop.value = withSpring(0.45, SPRING);
  }, [backdrop, defaultY, notifyPlayback, translateY]);

  const snapToExpanded = useCallback(() => {
    setSnap('expanded');
    notifyPlayback(false);
    translateY.value = withSpring(expandedY, SPRING);
    backdrop.value = withSpring(0.55, SPRING);
  }, [backdrop, expandedY, notifyPlayback, translateY]);

  const dismissSheet = useCallback(() => {
    Keyboard.dismiss();
    translateY.value = withTiming(closedY, { duration: 260 }, finished => {
      if (finished) {
        runOnJS(finishClose)();
      }
    });
    backdrop.value = withTiming(0, { duration: 240 });
  }, [backdrop, closedY, finishClose, translateY]);

  const settleAfterDrag = useCallback(
    (y: number, dy: number, velocityY: number, fromExpanded: boolean) => {
      const visibleAtStart = closedY - (fromExpanded ? expandedY : defaultY);
      const dismissDistance = visibleAtStart * 0.28;

      if (velocityY < -700) {
        snapToExpanded();
        return;
      }

      if (velocityY > 1200) {
        if (fromExpanded) snapToDefault();
        else dismissSheet();
        return;
      }

      if (!fromExpanded && dy > dismissDistance) {
        dismissSheet();
        return;
      }

      if (fromExpanded && dy > (defaultY - expandedY) * 0.35) {
        if (dy > (defaultY - expandedY) + dismissDistance * 0.5) {
          dismissSheet();
        } else {
          snapToDefault();
        }
        return;
      }

      const mid = (expandedY + defaultY) / 2;
      const dismissGate = defaultY + (closedY - defaultY) * 0.25;
      if (y >= dismissGate) dismissSheet();
      else if (y < mid) snapToExpanded();
      else snapToDefault();
    },
    [closedY, defaultY, dismissSheet, expandedY, snapToDefault, snapToExpanded],
  );

  useEffect(() => {
    if (visible && !closing) {
      setSheetMounted(true);
      setSnap('default');
      translateY.value = closedY;
      backdrop.value = 0;
      const id = requestAnimationFrame(() => {
        translateY.value = withSpring(defaultY, SPRING);
        backdrop.value = withSpring(0.45, SPRING);
        notifyPlayback(true);
      });
      return () => cancelAnimationFrame(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, contentId]);

  useEffect(() => {
    if (closing && sheetMounted) {
      dismissSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closing]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => {
      notifyPlayback(false);
      if (translateY.value > expandedY + 40) {
        translateY.value = withSpring(expandedY, SPRING);
        backdrop.value = withSpring(0.55, SPRING);
        setSnap('expanded');
      }
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      if (snap === 'default') notifyPlayback(true);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [backdrop, expandedY, notifyPlayback, snap, translateY]);

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  const endDrag = (y: number, dy: number, velocityY: number, fromExpanded: boolean) => {
    settleAfterDrag(y, dy, velocityY, fromExpanded);
  };

  const listPan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
      snapAtDragStart.value = translateY.value < (expandedY + defaultY) / 2 ? 1 : 0;
      lastTranslationY.value = 0;
      runOnJS(dismissKeyboard)();
    })
    .onUpdate(e => {
      const changeY = e.translationY - lastTranslationY.value;
      lastTranslationY.value = e.translationY;
      const scrollingList = scrollOffset.value > 1;
      const pullingDown = changeY > 0;
      const pullingUp = changeY < 0;

      if (scrollingList && pullingDown) {
        dragStartY.value = translateY.value - e.translationY;
        return;
      }

      if (pullingUp && translateY.value <= expandedY + 0.5) {
        dragStartY.value = translateY.value - e.translationY;
        return;
      }

      const next = Math.min(closedY, Math.max(expandedY, dragStartY.value + e.translationY));
      translateY.value = next;
      const progress = 1 - (next - expandedY) / (closedY - expandedY);
      backdrop.value = Math.max(0, Math.min(0.55, progress * 0.55));
    })
    .onEnd(e => {
      runOnJS(endDrag)(
        translateY.value,
        translateY.value - dragStartY.value,
        e.velocityY,
        snapAtDragStart.value === 1,
      );
    })
    .simultaneousWithExternalGesture(nativeGesture);

  const headerPan = Gesture.Pan()
    .onBegin(() => {
      dragStartY.value = translateY.value;
      snapAtDragStart.value = translateY.value < (expandedY + defaultY) / 2 ? 1 : 0;
      runOnJS(dismissKeyboard)();
    })
    .onUpdate(e => {
      const next = Math.min(closedY, Math.max(expandedY, dragStartY.value + e.translationY));
      translateY.value = next;
      const progress = 1 - (next - expandedY) / (closedY - expandedY);
      backdrop.value = Math.max(0, Math.min(0.55, progress * 0.55));
    })
    .onEnd(e => {
      runOnJS(endDrag)(
        translateY.value,
        translateY.value - dragStartY.value,
        e.velocityY,
        snapAtDragStart.value === 1,
      );
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const keyboardPadStyle = useAnimatedStyle(() => ({
    paddingBottom: bottomInset + keyboard.height.value,
  }));

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

  if (!sheetMounted) return null;

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <GestureDetector
          gesture={Gesture.Tap().onEnd(() => {
            runOnJS(dismissSheet)();
          })}>
          <Animated.View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            height: sheetHeight,
            backgroundColor: theme.colors.backgroundElevated,
          },
          sheetStyle,
        ]}>
        <GestureDetector gesture={headerPan}>
          <View>
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
            </View>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
                  Comments
                </Text>
                <Text
                  style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {formatCount(liveCount)} comments
                </Text>
              </View>
              <PressableScale onPress={dismissSheet} accessibilityLabel="Close">
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
            <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
          </View>
        </GestureDetector>

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
          <GestureDetector gesture={listPan}>
            <Animated.View style={styles.listWrap}>
              <GestureDetector gesture={nativeGesture}>
                <FlatList
                  data={roots}
                  keyExtractor={item => item.id}
                  style={styles.list}
                  contentContainerStyle={styles.listContent}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  onScroll={e => {
                    scrollOffset.value = e.nativeEvent.contentOffset.y;
                  }}
                  scrollEventThrottle={16}
                  bounces
                  ListEmptyComponent={
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        {
                          color: theme.colors.textTertiary,
                          textAlign: 'center',
                          paddingVertical: 28,
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
                                {
                                  color: theme.colors.textSecondary,
                                  fontWeight: '600',
                                },
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
              </GestureDetector>
            </Animated.View>
          </GestureDetector>
        )}

        {commentsEnabled ? (
          <Animated.View
            style={[
              styles.composer,
              { borderTopColor: theme.colors.borderSoft },
              keyboardPadStyle,
            ]}>
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
                  <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
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
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
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
    ...StyleSheet.absoluteFill,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    zIndex: 40,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    borderTopLeftRadius: CORNER_RADIUS,
    borderTopRightRadius: CORNER_RADIUS,
    overflow: 'hidden',
    zIndex: 50,
    elevation: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  listWrap: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
