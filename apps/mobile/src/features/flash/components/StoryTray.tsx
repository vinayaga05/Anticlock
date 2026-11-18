import React, { useCallback, useEffect, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '@/shared/hooks/useTheme';
import { StoryRing } from '@/features/flash/components/StoryRing';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { RootStackParamList } from '@/shared/navigation/types';
import { useStoriesQuery } from '@/shared/api/storyHooks';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { isApiEnabled } from '@/shared/api/config';

const LOAD_THRESHOLD = 56;

export function StoryTray() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    getTrayEntries,
    loadMoreTrayStories,
    hasMoreTrayStories,
    setApiStories,
    setViewerProfile,
  } = useStoryStore();
  const loadingMoreRef = useRef(false);
  const { active: activeViewerProfile } = useActiveProfile();
  const viewerProfile = activeViewerProfile
    ? {
        id: activeViewerProfile.id,
        type: identityProfileType(activeViewerProfile),
      }
    : null;
  const { data: apiStories, refetch } = useStoriesQuery(viewerProfile);

  useEffect(() => {
    setViewerProfile(
      activeViewerProfile
        ? {
            id: activeViewerProfile.id,
            type: identityProfileType(activeViewerProfile),
            name: activeViewerProfile.name,
            avatarUrl: activeViewerProfile.avatarUrl,
          }
        : null,
    );
  }, [activeViewerProfile, setViewerProfile]);

  useEffect(() => {
    if (isApiEnabled && apiStories) {
      setApiStories(apiStories);
    }
  }, [apiStories, setApiStories]);

  // New stories from other profiles appear when the Flash tab regains focus.
  useFocusEffect(
    useCallback(() => {
      if (isApiEnabled) refetch();
    }, [refetch]),
  );

  useEffect(() => {
    const timer = setInterval(
      () => useStoryStore.getState().pruneExpired(),
      30_000,
    );
    return () => clearInterval(timer);
  }, []);

  const entries = getTrayEntries();

  const openCreator = () => navigation.navigate('StoryCreator');
  const openViewer = (authorId: string) =>
    navigation.navigate('StoryViewer', { authorId });

  const onPressEntry = (
    authorId: string,
    isOwn: boolean,
    hasActive: boolean,
  ) => {
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
        contentOffset.x + layoutMeasurement.width >=
        contentSize.width - LOAD_THRESHOLD;
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
        contentContainerStyle={styles.row}
      >
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
      <View
        style={[styles.divider, { backgroundColor: theme.colors.borderSoft }]}
      />
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
