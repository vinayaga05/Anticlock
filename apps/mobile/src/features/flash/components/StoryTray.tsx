import React, { useCallback, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/shared/hooks/useTheme';
import { StoryRing } from '@/features/flash/components/StoryRing';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { RootStackParamList } from '@/shared/navigation/types';

const LOAD_THRESHOLD = 56;

export function StoryTray() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const stories = useStoryStore(s => s.stories);
  const viewedByAuthor = useStoryStore(s => s.viewedByAuthor);
  const trayVisibleCount = useStoryStore(s => s.trayVisibleCount);
  const getTrayEntries = useStoryStore(s => s.getTrayEntries);
  const loadMoreTrayStories = useStoryStore(s => s.loadMoreTrayStories);
  const hasMoreTrayStories = useStoryStore(s => s.hasMoreTrayStories);
  const loadingMoreRef = useRef(false);

  const entries = useMemo(
    () => getTrayEntries(),
    [getTrayEntries, stories, viewedByAuthor, trayVisibleCount],
  );

  const openCreator = () => navigation.navigate('StoryCreator');
  const openViewer = (authorId: string) =>
    navigation.navigate('StoryViewer', { authorId });

  const onPressEntry = (authorId: string, isOwn: boolean, hasActive: boolean) => {
    if (isOwn && !hasActive) {
      openCreator();
      return;
    }
    openViewer(authorId);
  };

  const maybeLoadMore = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMoreTrayStories() || loadingMoreRef.current) return;
      const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
      const nearEnd =
        contentOffset.x + layoutMeasurement.width >= contentSize.width - LOAD_THRESHOLD;
      if (!nearEnd) return;
      loadingMoreRef.current = true;
      loadMoreTrayStories();
      requestAnimationFrame(() => {
        loadingMoreRef.current = false;
      });
    },
    [hasMoreTrayStories, loadMoreTrayStories],
  );

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={maybeLoadMore}
        contentContainerStyle={styles.row}>
        {entries.map(entry => (
          <StoryRing
            key={entry.authorId}
            entry={entry}
            onPress={() =>
              onPressEntry(entry.authorId, entry.isOwn, entry.hasActiveStory)
            }
            onAddPress={entry.isOwn ? openCreator : undefined}
          />
        ))}
      </ScrollView>
      <View style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12,
  },
  row: {
    paddingHorizontal: 4,
    gap: 14,
    alignItems: 'flex-start',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
});
