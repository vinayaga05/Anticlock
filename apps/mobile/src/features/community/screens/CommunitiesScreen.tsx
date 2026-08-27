import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { FilterPills } from '@/shared/components/FilterPills';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  applyQuickFilter,
  exploreQuickFilters,
  featuredEvents,
  filterExploreItems,
  fromPeopleYouFollow,
  myExploreSubmissions,
  nearYouItems,
  searchExploreItems,
  trendingProducts,
  upcomingEvents,
  type ExploreItem,
} from '@/shared/data/explore';
import { useCommunityStore } from '@/shared/data/community';
import {
  ExploreEventCard,
  ExploreProductCard,
} from '@/features/community/components/ExploreCards';
import {
  ChallengeCard,
  ClubCard,
} from '@/features/community/components/ClubChallengeCards';
import { TAB_BAR_VISIBLE_HEIGHT } from '@/shared/navigation/FloatingPillTabBar';

type HubFilter = 'all' | 'events' | 'products';
type ModeTab = 'explore' | 'clubs' | 'challenges';

const MODE_TABS: { id: ModeTab; label: string }[] = [
  { id: 'explore', label: 'Explore' },
  { id: 'clubs', label: 'Clubs' },
  { id: 'challenges', label: 'Challenges' },
];

export function CommunitiesScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<ModeTab>('explore');
  const [filter, setFilter] = useState<HubFilter>('all');
  const [quick, setQuick] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const clubs = useCommunityStore(s => s.clubs);
  const challenges = useCommunityStore(s => s.challenges);

  const quickPills = useMemo(
    () =>
      exploreQuickFilters.filter(q => q.appliesTo === 'all' || q.appliesTo === filter),
    [filter],
  );

  const openItem = (item: ExploreItem) => {
    const isCatalog =
      !item.id.startsWith('sub-') && item.meta.reviewStatus === 'approved';
    if (isCatalog && item.kind === 'event') {
      navigation.navigate('EventDetail', { eventId: item.id });
      return;
    }
    if (isCatalog && item.kind === 'product') {
      navigation.navigate('ProductDetail', { productId: item.id });
      return;
    }
    navigation.navigate('ExploreSubmissionDetail', { itemId: item.id });
  };

  const renderItem = (item: ExploreItem, compact = false) =>
    item.kind === 'event' ? (
      <ExploreEventCard
        key={item.id}
        item={item}
        compact={compact}
        onPress={() => openItem(item)}
      />
    ) : (
      <ExploreProductCard
        key={item.id}
        item={item}
        compact={compact}
        onPress={() => openItem(item)}
      />
    );

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return applyQuickFilter(
      filterExploreItems(searchExploreItems(query), filter),
      quick,
    );
  }, [query, filter, quick]);

  const featured = filterExploreItems(featuredEvents, filter);
  const trending = filterExploreItems(trendingProducts, filter);
  const near = applyQuickFilter(filterExploreItems(nearYouItems, filter), quick);
  const following = filterExploreItems(fromPeopleYouFollow, filter);
  const upcoming = filterExploreItems(upcomingEvents, filter);
  const mine = filterExploreItems(myExploreSubmissions, filter);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}>
          <AppHeader title="Community" />

          <View style={styles.modeRow}>
            {MODE_TABS.map(t => {
              const active = t.id === mode;
              return (
                <PressableScale
                  key={t.id}
                  onPress={() => setMode(t.id)}
                  accessibilityLabel={t.label}
                  style={[
                    styles.modeTab,
                    {
                      backgroundColor: active
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}>
                  <Text
                    style={[
                      theme.typography.caption,
                      {
                        color: active ? theme.colors.primary : theme.colors.textSecondary,
                        fontWeight: '700',
                      },
                    ]}>
                    {t.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {mode === 'clubs' ? (
          <View style={[styles.padded, { gap: 14, marginTop: 12, paddingBottom: 24 }]}>
            <View style={styles.rowBetween}>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.textSecondary, flex: 1, paddingRight: 8 },
                ]}>
                Clubs and communities around a sport or activity.
              </Text>
              <Button title="Create" icon="plus" onPress={() => navigation.navigate('CreateClub')} />
            </View>
            {clubs.map(club => (
              <ClubCard
                key={club.id}
                club={club}
                onPress={() => navigation.navigate('ClubDetail', { clubId: club.id })}
              />
            ))}
          </View>
        ) : null}

        {mode === 'challenges' ? (
          <View style={[styles.padded, { gap: 14, marginTop: 12, paddingBottom: 24 }]}>
            <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
              Join challenges individually or with an event.
            </Text>
            {challenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onPress={() =>
                  navigation.navigate('ChallengeDetail', { challengeId: challenge.id })
                }
              />
            ))}
          </View>
        ) : null}

        {mode === 'explore' ? (
          <View style={{ gap: 20, marginTop: 12, paddingBottom: 24 }}>
            <View style={[styles.padded, { gap: 12 }]}>
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}>
                <AppIcon name="search" size={18} color={theme.colors.textTertiary} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search events, products..."
                  placeholderTextColor={theme.colors.textTertiary}
                  style={[styles.searchInput, { color: theme.colors.textPrimary }]}
                />
              </View>

              <FilterPills
                activeId={filter}
                onChange={id => {
                  setFilter(id as HubFilter);
                  setQuick(null);
                }}
                pills={[
                  { id: 'all', label: 'All' },
                  { id: 'events', label: 'Events' },
                  { id: 'products', label: 'Products' },
                ]}
              />

              {quickPills.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}>
                  {quickPills.map(q => {
                    const active = quick === q.id;
                    return (
                      <PressableScale
                        key={q.id}
                        onPress={() => setQuick(active ? null : q.id)}
                        style={[
                          styles.quickChip,
                          {
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surfaceMuted,
                            borderRadius: theme.radius.pill,
                          },
                        ]}>
                        <Text
                          style={{
                            color: active ? '#fff' : theme.colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '700',
                          }}>
                          {q.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            {query.trim() ? (
              <View style={[styles.padded, { gap: 12 }]}>
                <SectionHeader title="Search results" />
                {searchResults.length === 0 ? (
                  <Text
                    style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                    No matches. Try another keyword.
                  </Text>
                ) : (
                  searchResults.map(item => renderItem(item))
                )}
              </View>
            ) : (
              <>
                {mine.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader
                        title="Your submissions"
                        subtitle="Review status is separate from who can see your post"
                      />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}>
                      {mine.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {featured.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader title="Featured Events" />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}>
                      {featured.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {trending.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader title="Trending Products" />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}>
                      {trending.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {near.length > 0 ? (
                  <View style={[styles.padded, { gap: 12 }]}>
                    <SectionHeader title="Near You" />
                    {near.map(item => renderItem(item))}
                  </View>
                ) : null}

                {following.length > 0 ? (
                  <View style={[styles.padded, { gap: 12 }]}>
                    <SectionHeader
                      title="From People You Follow"
                      subtitle="May include followers-only posts pending review"
                    />
                    {following.map(item => renderItem(item))}
                  </View>
                ) : null}

                {upcoming.length > 0 && filter !== 'products' ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader title="Upcoming Events" />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}>
                      {upcoming.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScreenContainer>

      {mode === 'explore' ? (
        <PressableScale
          onPress={() => navigation.navigate('ExploreCreate')}
          accessibilityLabel="Create event or product"
          style={[
            styles.fab,
            {
              backgroundColor: theme.colors.primary,
              bottom: TAB_BAR_VISIBLE_HEIGHT + Math.max(insets.bottom, 8) + 16,
              ...theme.shadows.float,
            },
          ]}>
          <AppIcon name="plus" size={28} color="#fff" />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', gap: 8 },
  modeTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 8 },
  hRow: { paddingHorizontal: 16, gap: 12 },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
