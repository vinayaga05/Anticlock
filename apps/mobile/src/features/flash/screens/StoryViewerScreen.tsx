import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { VideoPlayer } from '@/features/video/components/VideoPlayer';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { storyTimeLabel, type StoryItem } from '@/shared/data/flash/storyTypes';
import { RootStackParamList } from '@/shared/navigation/types';

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
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.progressTrack}>
          <View
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

function StoryMedia({ item }: { item: StoryItem }) {
  if (item.type === 'text') {
    return (
      <View
        style={[
          styles.textStory,
          { backgroundColor: item.backgroundColor ?? '#0F766E' },
        ]}>
        <Text style={styles.textStoryContent}>{item.textContent}</Text>
      </View>
    );
  }

  if (item.type === 'video' && item.mediaUrl) {
    return (
      <VideoPlayer uri={item.mediaUrl} muted paused={false} />
    );
  }

  if (item.mediaUrl) {
    return (
      <Image
        source={
          typeof item.mediaUrl === 'number'
            ? item.mediaUrl
            : { uri: String(item.mediaUrl) }
        }
        style={styles.media}
        resizeMode="cover"
      />
    );
  }

  return <View style={[styles.media, { backgroundColor: '#111' }]} />;
}

export function StoryViewerScreen() {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'StoryViewer'>>();
  const { authorId: startAuthorId } = route.params;

  const stories = useStoryStore(s => s.stories);
  const viewedByAuthor = useStoryStore(s => s.viewedByAuthor);

  const getAllTrayEntries = useStoryStore(s => s.getAllTrayEntries);
  const getActiveStory = useStoryStore(s => s.getActiveStory);
  const markItemViewed = useStoryStore(s => s.markItemViewed);
  const markAllViewed = useStoryStore(s => s.markAllViewed);

  const trayUsers = useMemo(() => {
    return getAllTrayEntries().filter(e => e.hasActiveStory);
  }, [getAllTrayEntries, stories, viewedByAuthor]);

  const [userIndex, setUserIndex] = useState(() => {
    const idx = trayUsers.findIndex(u => u.authorId === startAuthorId);
    return idx >= 0 ? idx : 0;
  });
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');

  const currentUser = trayUsers[userIndex];
  const story = currentUser ? getActiveStory(currentUser.authorId) : undefined;
  const items = story?.items ?? [];
  const item = items[itemIndex];

  const durationMs = item?.durationMs ?? 5000;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<number>(Date.now());

  const dismiss = useCallback(() => navigation.goBack(), [navigation]);

  const goNextItem = useCallback(() => {
    if (!story) return;
    if (itemIndex < items.length - 1) {
      setItemIndex(i => i + 1);
      setProgress(0);
      startedRef.current = Date.now();
      return;
    }
    markAllViewed(story.authorId);
    if (userIndex < trayUsers.length - 1) {
      setUserIndex(i => i + 1);
      setItemIndex(0);
      setProgress(0);
      startedRef.current = Date.now();
      return;
    }
    dismiss();
  }, [dismiss, itemIndex, items.length, markAllViewed, story, trayUsers.length, userIndex]);

  const goPrevItem = useCallback(() => {
    if (itemIndex > 0) {
      setItemIndex(i => i - 1);
      setProgress(0);
      startedRef.current = Date.now();
      return;
    }
    if (userIndex > 0) {
      const prevUser = trayUsers[userIndex - 1];
      const prevStory = getActiveStory(prevUser.authorId);
      const prevCount = prevStory?.items.length ?? 1;
      setUserIndex(i => i - 1);
      setItemIndex(Math.max(0, prevCount - 1));
      setProgress(0);
      startedRef.current = Date.now();
    }
  }, [getActiveStory, itemIndex, trayUsers, userIndex]);

  useEffect(() => {
    if (!item || !story) return;
    markItemViewed(story.authorId, item.id);
  }, [item, markItemViewed, story]);

  useEffect(() => {
    if (!item || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    startedRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedRef.current;
      const p = elapsed / durationMs;
      setProgress(p);
      if (p >= 1) goNextItem();
    }, 50);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [durationMs, goNextItem, item, paused]);

  const panGesture = Gesture.Pan()
    .onEnd(e => {
      if (e.translationY > 80) {
        runOnJS(dismiss)();
      } else if (e.translationX < -80) {
        runOnJS(goNextItem)();
      } else if (e.translationX > 80) {
        runOnJS(goPrevItem)();
      }
    });

  const sendReply = () => {
    const text = reply.trim();
    if (!text || !story) return;
    setReply('');
    navigation.navigate('Thread', { conversationId: 'msg-1' });
  };

  if (!story || !item) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.emptyText}>Story unavailable</Text>
        <PressableScale onPress={dismiss}>
          <Text style={styles.emptyLink}>Close</Text>
        </PressableScale>
      </View>
    );
  }

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.root}>
        <StoryMedia item={item} />

        <View style={[styles.topFade, { height: insets.top + 120 }]} pointerEvents="none">
          <Svg width={SCREEN_W} height={insets.top + 120} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="storyTop" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0.65} />
                <Stop offset="1" stopColor="#000" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={SCREEN_W} height={insets.top + 120} fill="url(#storyTop)" />
          </Svg>
        </View>

        <View style={[styles.bottomFade, { height: insets.bottom + 140 }]} pointerEvents="none">
          <Svg width={SCREEN_W} height={insets.bottom + 140} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="storyBottom" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000" stopOpacity={0.75} />
              </LinearGradient>
            </Defs>
            <Rect width={SCREEN_W} height={insets.bottom + 140} fill="url(#storyBottom)" />
          </Svg>
        </View>

        <View style={[styles.chrome, { paddingTop: insets.top + 8 }]}>
          <StoryProgress
            count={items.length}
            activeIndex={itemIndex}
            progress={progress}
          />
          <View style={styles.headerRow}>
            <PressableScale
              onPress={() =>
                navigation.navigate('Profile', { userId: story.author.id })
              }
              style={styles.headerLeft}>
              <Image source={{ uri: story.author.avatarUrl }} style={styles.headerAvatar} />
              <Text style={styles.headerName}>{story.author.name}</Text>
              <Text style={styles.headerTime}>{storyTimeLabel(item.createdAt)}</Text>
            </PressableScale>
            <PressableScale onPress={dismiss} accessibilityLabel="Close story">
              <AppIcon name="close" size={22} color="#fff" />
            </PressableScale>
          </View>
        </View>

        <Pressable
          style={styles.tapLeft}
          onPress={goPrevItem}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />
        <Pressable
          style={styles.tapRight}
          onPress={goNextItem}
          onLongPress={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
        />

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.replyPill}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Send message…"
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.replyInput}
              returnKeyType="send"
              onSubmitEditing={sendReply}
            />
          </View>
          <PressableScale accessibilityLabel="React to story" style={styles.footerBtn}>
            <AppIcon name="heart" size={24} color="#fff" />
          </PressableScale>
          <PressableScale accessibilityLabel="Share story" style={styles.footerBtn}>
            <AppIcon name="share" size={22} color="#fff" />
          </PressableScale>
        </View>
      </View>
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
    width: SCREEN_W,
    height: SCREEN_H,
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
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 36,
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
