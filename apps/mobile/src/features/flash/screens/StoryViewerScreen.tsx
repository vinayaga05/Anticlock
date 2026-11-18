import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  AppState,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useQueryClient } from '@tanstack/react-query';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { storyTimeLabel, type StoryItem } from '@/shared/data/flash/storyTypes';
import { RootStackParamList } from '@/shared/navigation/types';
import { navigateToProfile } from '@/shared/navigation/businessNavigation';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { useStreamChat } from '@/shared/providers/StreamChatProvider';
import { createOrGetChannel } from '@/shared/api/messagesClient';
import { setContentPostLike } from '@/shared/api/contentEngagement';
import { deleteContentClip } from '@/shared/api/hooks';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import { useStoriesQuery } from '@/shared/api/storyHooks';
import { isApiEnabled } from '@/shared/api/config';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

function StoryProgress({
  count,
  activeIndex,
  progress,
}: {
  count: number;
  activeIndex: number;
  progress: number;
}) {
  return (
    <View style={styles.progressRow}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.progressTrack}>
          <View
            testID={`story-progress-${i}`}
            style={[
              styles.progressFill,
              {
                width:
                  i < activeIndex
                    ? '100%'
                    : i === activeIndex
                    ? `${Math.min(progress, 1) * 100}%`
                    : '0%',
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

function StoryMedia({
  item,
  paused,
  onProgress,
  onComplete,
  onBuffering,
  onError,
}: {
  item: StoryItem;
  paused: boolean;
  onProgress: (seconds: number, duration: number) => void;
  onComplete: () => void;
  onBuffering: (buffering: boolean) => void;
  onError: () => void;
}) {
  const style = item.storyStyle;
  const [canvas, setCanvas] = useState({ width: SCREEN_W, height: SCREEN_H });
  return (
    <View
      testID="story-media"
      style={StyleSheet.absoluteFill}
      onLayout={event => {
        const { width, height } = event.nativeEvent.layout;
        if (width > 0 && height > 0) setCanvas({ width, height });
      }}
    >
      {item.type === 'text' ? (
        <View
          style={[
            styles.textStory,
            {
              backgroundColor:
                style?.backgroundColor ?? item.backgroundColor ?? '#0F766E',
            },
          ]}
        />
      ) : item.type === 'video' && item.mediaUrl ? (
        <VideoPlayer
          key={item.id}
          uri={item.mediaUrl}
          muted={false}
          paused={paused}
          poster={item.posterUrl}
          onPlaybackProgress={onProgress}
          onPlaybackComplete={onComplete}
          onBufferingChange={onBuffering}
          onPlaybackError={onError}
        />
      ) : item.mediaUrl ? (
        <Image
          source={
            typeof item.mediaUrl === 'number'
              ? item.mediaUrl
              : { uri: String(item.mediaUrl) }
          }
          style={styles.media}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.media, { backgroundColor: '#111' }]} />
      )}
      {item.textContent ? (
        <View
          testID="story-caption-position"
          style={{
            position: 'absolute',
            width: canvas.width * 0.8,
            left: canvas.width * (style?.textX ?? 0.5) - canvas.width * 0.4,
            top: canvas.height * (style?.textY ?? 0.35),
            padding: 8,
          }}
        >
          <Text
            testID="story-caption"
            style={[
              styles.textStoryContent,
              {
                color: style?.textColor ?? '#fff',
                fontSize: 28 * (style?.textScale ?? 1),
                lineHeight: 36 * (style?.textScale ?? 1),
              },
            ]}
          >
            {item.textContent}
          </Text>
        </View>
      ) : null}
      {style?.sticker ? (
        <Text
          style={[
            styles.sticker,
            { left: canvas.width * 0.5 - 32, top: canvas.height * 0.68 },
          ]}
        >
          {style.sticker}
        </Text>
      ) : null}
      {item.locationName ? (
        <Text style={styles.location}>⌖ {item.locationName}</Text>
      ) : null}
    </View>
  );
}

export function StoryViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StoryViewer'>>();
  const focused = useIsFocused();
  const queryClient = useQueryClient();
  const { active } = useActiveProfile();
  const viewer = active
    ? { id: active.id, type: identityProfileType(active) }
    : null;
  const { client, isReady: chatReady } = useStreamChat();
  const stories = useStoryStore(s => s.stories);
  const getAllTrayEntries = useStoryStore(s => s.getAllTrayEntries);
  const markItemViewed = useStoryStore(s => s.markItemViewed);
  const viewedByAuthor = useStoryStore(s => s.viewedByAuthor);
  const setApiStories = useStoryStore(s => s.setApiStories);
  const removeStoryItem = useStoryStore(s => s.removeStoryItem);
  const { data: apiStories } = useStoriesQuery(viewer);
  useEffect(() => {
    if (isApiEnabled && apiStories) setApiStories(apiStories);
  }, [apiStories, setApiStories]);

  // Viewing an item changes unread ranking. Keep the open sequence stable.
  const [authorOrder, setAuthorOrder] = useState(() =>
    getAllTrayEntries()
      .filter(e => e.hasActiveStory)
      .map(e => e.authorId),
  );
  const [authorId, setAuthorId] = useState(route.params.authorId);
  const [itemIndex, setItemIndex] = useState(() => {
    const initial = stories.find(
      candidate => candidate.authorId === route.params.authorId,
    );
    const viewed = viewedByAuthor[route.params.authorId] ?? [];
    const firstUnread =
      initial?.items.findIndex(candidate => !viewed.includes(candidate.id)) ??
      0;
    return Math.max(0, firstUnread);
  });
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [replyFocused, setReplyFocused] = useState(false);
  const [working, setWorking] = useState(false);
  const [reply, setReply] = useState('');
  const [liked, setLiked] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === 'active',
  );
  const elapsedRef = useRef(0);
  const dismissedRef = useRef(false);
  const holdRef = useRef(false);
  const sendingRef = useRef(false);
  const paused = held || replyFocused || working || !focused || !appActive;
  const story = useMemo(
    () => stories.find(s => s.authorId === authorId),
    [stories, authorId],
  );
  const items = useMemo(
    () => story?.items.filter(i => Date.parse(i.expiresAt) > Date.now()) ?? [],
    [story],
  );
  const item = items[itemIndex];
  const own =
    item?.viewerCanManage === true ||
    (viewer?.id === story?.author.id &&
      viewer?.type === (story?.author.profileType ?? 'personal'));
  const durationMs = Math.max(1000, item?.durationMs ?? 5000);
  useEffect(() => {
    if (!authorOrder.length && stories.length)
      setAuthorOrder(
        getAllTrayEntries()
          .filter(e => e.hasActiveStory)
          .map(e => e.authorId),
      );
  }, [authorOrder.length, getAllTrayEntries, stories]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state =>
      setAppActive(state === 'active'),
    );
    return () => listener.remove();
  }, []);
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main', params: { screen: 'Flash' } }],
      });
    }
  }, [navigation]);
  const selectAuthor = useCallback(
    (id: string, last = false) => {
      const next = stories.find(s => s.authorId === id);
      if (!next) return;
      const count = next.items.filter(
        i => Date.parse(i.expiresAt) > Date.now(),
      ).length;
      if (!count) return;
      setAuthorId(id);
      setItemIndex(last ? count - 1 : 0);
      setReply('');
      setReplyFocused(false);
    },
    [stories],
  );
  const nextAuthor = useCallback(() => {
    const index = authorOrder.indexOf(authorId);
    const next = authorOrder
      .slice(index + 1)
      .find(id =>
        stories.some(
          s =>
            s.authorId === id &&
            s.items.some(i => Date.parse(i.expiresAt) > Date.now()),
        ),
      );
    if (next) selectAuthor(next);
    else dismiss();
  }, [authorId, authorOrder, dismiss, selectAuthor, stories]);
  const previousAuthor = useCallback(() => {
    const index = authorOrder.indexOf(authorId);
    const previous = authorOrder
      .slice(0, index)
      .reverse()
      .find(id =>
        stories.some(
          s =>
            s.authorId === id &&
            s.items.some(i => Date.parse(i.expiresAt) > Date.now()),
        ),
      );
    if (previous) selectAuthor(previous);
  }, [authorId, authorOrder, selectAuthor, stories]);
  const goNextItem = useCallback(() => {
    if (itemIndex < items.length - 1) setItemIndex(i => i + 1);
    else nextAuthor();
  }, [itemIndex, items.length, nextAuthor]);
  const goPrevItem = useCallback(() => {
    if (itemIndex > 0) setItemIndex(i => i - 1);
    else {
      const previous = authorOrder[authorOrder.indexOf(authorId) - 1];
      if (previous) selectAuthor(previous, true);
    }
  }, [authorId, authorOrder, itemIndex, selectAuthor]);
  useEffect(() => {
    elapsedRef.current = 0;
    setProgress(0);
    setLiked(item?.viewerHasLiked === true);
    setMediaFailed(false);
    setBuffering(false);
  }, [item?.id, item?.viewerHasLiked]);
  useEffect(() => {
    if (item && story) markItemViewed(story.authorId, item.id);
  }, [item, markItemViewed, story]);
  useEffect(() => {
    if (!item || paused || buffering || (item.type === 'video' && !mediaFailed))
      return;
    let tickAt = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      elapsedRef.current += now - tickAt;
      tickAt = now;
      const value = elapsedRef.current / durationMs;
      setProgress(value);
      if (value >= 1) {
        clearInterval(timer);
        goNextItem();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [durationMs, goNextItem, item, paused, buffering, mediaFailed]);
  const onPlaybackProgress = useCallback(
    (seconds: number, duration: number) => {
      if (duration > 0) setProgress(seconds / duration);
    },
    [],
  );
  const panGesture = Gesture.Pan().onEnd(e => {
    if (
      e.translationY > 80 &&
      Math.abs(e.translationY) > Math.abs(e.translationX)
    )
      runOnJS(dismiss)();
    else if (e.translationX < -80) runOnJS(nextAuthor)();
    else if (e.translationX > 80) runOnJS(previousAuthor)();
  });
  const sendReply = async () => {
    const text = reply.trim();
    if (
      !text ||
      !story ||
      !item ||
      !viewer ||
      !client ||
      !chatReady ||
      sendingRef.current
    )
      return;
    sendingRef.current = true;
    setWorking(true);
    try {
      const result = await createOrGetChannel(
        { id: story.author.id, type: story.author.profileType ?? 'personal' },
        viewer,
      );
      const channel = client.channel('messaging', result.channelId);
      await channel.watch();
      await channel.sendMessage({ text: `Replied to your story: ${text}` });
      setReply('');
      navigation.navigate('Thread', {
        conversationId: result.channelId,
        channelId: result.channelId,
        profile: result.profile,
      });
    } catch (error) {
      Alert.alert(
        'Couldn’t send reply',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      sendingRef.current = false;
      setWorking(false);
    }
  };
  const toggleLike = async () => {
    if (!item || !viewer || working) return;
    setWorking(true);
    try {
      const result = await setContentPostLike(item.id, !liked, viewer);
      if (result) setLiked(result.liked);
    } catch {
      Alert.alert('Couldn’t react', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };
  const shareStory = async () => {
    if (!story) return;
    setWorking(true);
    try {
      await Share.share({
        message: `${
          story.author.name
        } on Knock: anticlock://story/${encodeURIComponent(story.authorId)}`,
      });
    } catch {
      Alert.alert('Couldn’t share story', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };
  const deleteStory = () => {
    if (!item || !own || working) return;
    setWorking(true);
    Alert.alert(
      'Delete this story?',
      'It will no longer be visible to your audience.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setWorking(false) },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteContentClip(item.id);
              removeStoryItem(item.id);
              await queryClient.invalidateQueries({
                queryKey: contentQueryKeys.storyTray,
              });
              dismiss();
            } catch {
              Alert.alert('Couldn’t delete story', 'Please try again.');
            } finally {
              setWorking(false);
            }
          },
        },
      ],
      { cancelable: true, onDismiss: () => setWorking(false) },
    );
  };
  if (!story || !item)
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>Story unavailable</Text>
        <PressableScale onPress={dismiss}>
          <Text style={styles.emptyLink}>Close</Text>
        </PressableScale>
      </View>
    );
  return (
    <GestureDetector gesture={panGesture}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StoryMedia
          item={item}
          paused={paused}
          onProgress={onPlaybackProgress}
          onComplete={goNextItem}
          onBuffering={setBuffering}
          onError={() => setMediaFailed(true)}
        />
        <View
          style={[styles.topFade, { height: insets.top + 120 }]}
          pointerEvents="none"
        >
          <Svg
            width={SCREEN_W}
            height={insets.top + 120}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id="storyTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0.65} />
                <Stop offset="1" stopColor="#000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect
              width={SCREEN_W}
              height={insets.top + 120}
              fill="url(#storyTop)"
            />
          </Svg>
        </View>
        <View
          style={[styles.bottomFade, { height: insets.bottom + 140 }]}
          pointerEvents="none"
        >
          <Svg
            width={SCREEN_W}
            height={insets.bottom + 140}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id="storyBottom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.75} />
              </LinearGradient>
            </Defs>
            <Rect
              width={SCREEN_W}
              height={insets.bottom + 140}
              fill="url(#storyBottom)"
            />
          </Svg>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous story item"
          style={[
            styles.tapLeft,
            { top: insets.top + 82, bottom: insets.bottom + 78 },
          ]}
          onPress={() => {
            if (!holdRef.current) goPrevItem();
          }}
          onPressIn={() => {
            holdRef.current = false;
            setHeld(true);
          }}
          onLongPress={() => {
            holdRef.current = true;
          }}
          onPressOut={() => setHeld(false)}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next story item"
          style={[
            styles.tapRight,
            { top: insets.top + 82, bottom: insets.bottom + 78 },
          ]}
          onPress={() => {
            if (!holdRef.current) goNextItem();
          }}
          onPressIn={() => {
            holdRef.current = false;
            setHeld(true);
          }}
          onLongPress={() => {
            holdRef.current = true;
          }}
          onPressOut={() => setHeld(false)}
        />
        <View style={[styles.chrome, { paddingTop: insets.top + 8 }]}>
          <StoryProgress
            count={items.length}
            activeIndex={itemIndex}
            progress={progress}
          />
          <View style={styles.headerRow}>
            <PressableScale
              onPress={() =>
                navigateToProfile(navigation, {
                  id: story.author.id,
                  type: story.author.profileType ?? 'personal',
                })
              }
              style={styles.headerLeft}
            >
              <Image
                source={{ uri: story.author.avatarUrl }}
                style={styles.headerAvatar}
              />
              <Text style={styles.headerName}>{story.author.name}</Text>
              <Text style={styles.headerTime}>
                {storyTimeLabel(item.createdAt)}
              </Text>
            </PressableScale>
            <PressableScale onPress={dismiss} accessibilityLabel="Close story">
              <AppIcon name="close" size={22} color="#fff" />
            </PressableScale>
          </View>
          {story.audience === 'close_friends' ? (
            <Text style={styles.closeFriends}>Close friends</Text>
          ) : null}
        </View>
        {mediaFailed ? (
          <Text style={styles.mediaError}>
            This video couldn’t be loaded. Tap to continue.
          </Text>
        ) : null}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          {own ? (
            <>
              <PressableScale
                onPress={() => navigation.navigate('StoryCreator')}
                accessibilityLabel="Add another story"
                style={styles.ownerAction}
              >
                <AppIcon name="plus" size={20} color="#fff" />
                <Text style={styles.ownerLabel}>Add story</Text>
              </PressableScale>
              <PressableScale
                onPress={deleteStory}
                accessibilityLabel="Delete story"
                style={styles.ownerAction}
              >
                <AppIcon name="trash" size={20} color="#fff" />
                <Text style={styles.ownerLabel}>Delete</Text>
              </PressableScale>
            </>
          ) : (
            <>
              <View style={styles.replyPill}>
                <TextInput
                  value={reply}
                  onChangeText={setReply}
                  onFocus={() => setReplyFocused(true)}
                  onBlur={() => setReplyFocused(false)}
                  placeholder={
                    chatReady
                      ? 'Send a private reply…'
                      : 'Messaging unavailable'
                  }
                  editable={chatReady && !working}
                  accessibilityLabel="Private story reply"
                  placeholderTextColor="rgba(255,255,255,.65)"
                  style={styles.replyInput}
                  returnKeyType="send"
                  onSubmitEditing={sendReply}
                />
              </View>
              <PressableScale
                onPress={() => {
                  if (reply.trim()) void sendReply();
                  else void toggleLike();
                }}
                accessibilityLabel={
                  reply.trim()
                    ? 'Send story reply'
                    : liked
                    ? 'Remove story reaction'
                    : 'React to story'
                }
                style={styles.footerBtn}
              >
                <AppIcon
                  name={reply.trim() ? 'send' : 'heart'}
                  size={24}
                  color={liked && !reply.trim() ? '#ff3d86' : '#fff'}
                />
              </PressableScale>
            </>
          )}
          <PressableScale
            onPress={() => void shareStory()}
            accessibilityLabel="Share story"
            style={styles.footerBtn}
          >
            <AppIcon name="share" size={22} color="#fff" />
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
  },
  emptyLink: {
    color: '#5EEAD4',
    fontWeight: '700',
  },
  media: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  textStory: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  textStoryContent: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
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
  chrome: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    gap: 10,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerName: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  headerTime: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 13,
    fontWeight: '600',
  },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_W * 0.3,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: SCREEN_W * 0.7,
  },
  sticker: {
    position: 'absolute',
    width: 64,
    textAlign: 'center',
    fontSize: 48,
  },
  location: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '20%',
    color: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,.35)',
  },
  closeFriends: {
    alignSelf: 'flex-start',
    color: '#fff',
    backgroundColor: '#258536',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
  },
  mediaError: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    color: '#fff',
    padding: 20,
    textAlign: 'center',
  },
  ownerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
  },
  ownerLabel: { color: '#fff', fontWeight: '600' },
  footer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  replyPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  replyInput: {
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  footerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
