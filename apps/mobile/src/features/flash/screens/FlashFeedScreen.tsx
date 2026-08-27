import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from '@/shared/components/AppHeader';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { FeedTab } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { FlashComposerBar } from '@/features/flash/components/FlashComposerBar';
import { FlashPostCard } from '@/features/flash/components/FlashPostCard';
import { useCommentsSheetStore } from '@/shared/store/commentsSheetStore';
import { TAB_BAR_VISIBLE_HEIGHT } from '@/shared/navigation/FloatingPillTabBar';

const FEED_PILLS = [
  { id: 'forYou', label: 'For You' },
  { id: 'following', label: 'Following' },
  { id: 'nearby', label: 'Nearby' },
];

export function FlashFeedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<FeedTab>('forYou');
  const posts = useEngagementStore(s => s.posts);
  const hiddenIds = useEngagementStore(s => s.hiddenIds);
  const commentsOpen = useCommentsSheetStore(
    s => (s.open || s.closing) && s.sourceType === 'flashPost',
  );

  const feed = useMemo(
    () =>
      posts.filter(
        p => !p.hidden && !hiddenIds.includes(p.id) && p.feedTabs.includes(tab),
      ),
    [posts, hiddenIds, tab],
  );

  const bottomPad =
    TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + 8 + 24;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={feed}
        keyExtractor={item => item.id}
        scrollEnabled={!commentsOpen}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 10,
          paddingBottom: bottomPad,
          gap: 16,
        }}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <AppHeader title="Flash" />
            <FilterPills
              activeId={tab}
              onChange={id => setTab(id as FeedTab)}
              pills={FEED_PILLS}
            />
            <FlashComposerBar />
          </View>
        }
        renderItem={({ item }) => <FlashPostCard post={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerBlock: {
    gap: 16,
    marginBottom: 0,
  },
});
