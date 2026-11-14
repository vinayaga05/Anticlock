import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useShallow } from 'zustand/react/shallow';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { FilterPills } from '@/shared/components/FilterPills';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import type { ExploreItem } from '@/shared/data/explore';
import type { ExploreEvent, Product } from '@anticlock/contracts';
import { useCommunityStore } from '@/shared/data/community';
import {
  ExploreEventCard,
  ExploreProductCard,
} from '@/features/community/components/ExploreCards';
import {
  ChallengeCard,
  DiscoverTeamCard,
  TeamCard,
} from '@/features/community/components/ClubChallengeCards';
import { SPORT_TAGS, CURRENT_USER_ID } from '@/shared/data/community';
import { ComplaintsPanel } from '@/features/community/components/ComplaintsPanel';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import {
  useExploreEventsQuery,
  useMyExploreEventsQuery,
} from '@/shared/api/exploreHooks';
import {
  useExploreProductsQuery,
  useMyProductsQuery,
} from '@/shared/api/shopHooks';

type HubFilter = 'all' | 'events' | 'products';
type ModeTab = 'feed' | 'teams' | 'challenges' | 'complaints';
type TeamTab = 'mine' | 'discover';

const MODE_TABS: { id: ModeTab; label: string }[] = [
  { id: 'feed', label: 'Explore' },
  { id: 'teams', label: 'Teams' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'complaints', label: 'Complaints' },
];

const QUICK_FILTERS = [
  { id: 'following', label: 'Following', appliesTo: 'all' },
  { id: 'free', label: 'Free', appliesTo: 'events' },
  { id: 'under500', label: 'Under ₹500', appliesTo: 'products' },
] as const;

function eventItem(event: ExploreEvent): ExploreItem {
  const starts = new Date(event.startsAt);
  return {
    kind: 'event',
    id: event.id,
    title: event.title,
    imageUrl: event.media[0]?.thumbnailUrl ?? event.media[0]?.url ?? '',
    organizer: event.publisher.displayName,
    dateLabel: starts.toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
    }),
    timeLabel: starts.toLocaleTimeString(undefined, {
      hour: 'numeric', minute: '2-digit',
    }),
    location: event.venueType === 'online'
      ? 'Online'
      : event.location?.name ?? event.location?.address ?? 'Location to be announced',
    price: Math.round(event.price / 100),
    spotsLeft: event.availableCapacity,
    category: event.categoryId,
    meta: {
      reviewStatus: event.reviewStatus,
      visibility: event.requestedVisibility,
      submittedBy: event.publisher.displayName,
      submittedAt: event.submittedAt ?? event.createdAt,
      reviewNote: event.reviewReason ?? undefined,
    },
  };
}

function productItem(product: Product): ExploreItem {
  return {
    kind: 'product',
    id: product.id,
    title: product.name,
    imageUrl: product.images[0]?.thumbnailUrl ?? product.images[0]?.url ?? '',
    seller: product.publisher?.displayName ?? 'Anticlock Shop',
    price: Math.round(product.price / 100),
    compareAtPrice: product.compareAtPrice == null
      ? undefined : Math.round(product.compareAtPrice / 100),
    rating: 0,
    reviewCount: 0,
    category: product.categoryId,
    meta: {
      reviewStatus: product.reviewStatus,
      visibility: product.requestedVisibility,
      submittedBy: product.publisher?.displayName ?? 'Anticlock Shop',
      submittedAt: product.createdAt,
      reviewNote: product.reviewReason ?? undefined,
    },
  };
}

export function CommunitiesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<ModeTab>('feed');
  const [teamTab, setTeamTab] = useState<TeamTab>('mine');
  const [sportTag, setSportTag] = useState<string | null>(null);
  const [filter, setFilter] = useState<HubFilter>('all');
  const [quick, setQuick] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;
  const followingOnly = quick === 'following';
  const eventQuery = useExploreEventsQuery({
    search: query.trim() || undefined,
    following: followingOnly,
    freeOnly: quick === 'free',
    viewer,
  });
  const productQuery = useExploreProductsQuery({
    search: query.trim() || undefined,
    following: followingOnly,
    maxPrice: quick === 'under500' ? 50_000 : undefined,
    viewer,
  });
  const myEventsQuery = useMyExploreEventsQuery();
  const myProductsQuery = useMyProductsQuery();

  const myTeams = useCommunityStore(useShallow(s => s.getMyTeams()));
  const discoverTeams = useCommunityStore(
    useShallow(s => s.getDiscoverTeams({ sportTag })),
  );
  const joinTeam = useCommunityStore(s => s.joinTeam);
  const isMember = useCommunityStore(s => s.isMember);
  const joinRequests = useCommunityStore(s => s.joinRequests);
  const challenges = useCommunityStore(s => s.challenges);
  const getEligibleTeamsForChallenge = useCommunityStore(
    s => s.getEligibleTeamsForChallenge,
  );

  const quickPills = useMemo(
    () =>
      QUICK_FILTERS.filter(
        q => q.appliesTo === 'all' || q.appliesTo === filter,
      ),
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
    navigation.navigate('ExploreSubmissionDetail', {
      itemId: item.id,
      kind: item.kind,
    });
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

  const events = useMemo(
    () => filter === 'products' ? [] : (eventQuery.data?.events ?? []).map(eventItem),
    [eventQuery.data?.events, filter],
  );
  const products = useMemo(
    () => filter === 'events' ? [] : (productQuery.data?.products ?? []).map(productItem),
    [productQuery.data?.products, filter],
  );
  const searchResults = useMemo(() => [...events, ...products], [events, products]);
  const mine = useMemo(() => [
    ...(filter === 'products' ? [] : (myEventsQuery.data?.events ?? []).map(eventItem)),
    ...(filter === 'events' ? [] : (myProductsQuery.data?.products ?? []).map(productItem)),
  ], [filter, myEventsQuery.data?.events, myProductsQuery.data?.products]);
  const feedLoading = eventQuery.isLoading || productQuery.isLoading;
  const feedError = eventQuery.error ?? productQuery.error;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View
          style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}
        >
          <AppHeader title="Nexus" />

          <View style={styles.modeRow}>
            {MODE_TABS.map(t => {
              const active = t.id === mode;
              return (
                <PressableScale
                  key={t.id}
                  onPress={() => setMode(t.id)}
                  accessibilityLabel={t.label}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.modeTab,
                    {
                      backgroundColor: active
                        ? theme.colors.primarySoft
                        : theme.colors.surface,
                      borderColor: active
                        ? theme.colors.primary
                        : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}
                >
                  <Text
                    style={[
                      theme.typography.caption,
                      {
                        color: active
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {t.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        {mode === 'complaints' ? <ComplaintsPanel /> : null}

        {mode === 'teams' ? (
          <View
            style={[
              styles.padded,
              { gap: 14, marginTop: 12, paddingBottom: 24 },
            ]}
          >
            <View style={styles.teamTabRow}>
              {(['mine', 'discover'] as TeamTab[]).map(tab => {
                const active = teamTab === tab;
                return (
                  <PressableScale
                    key={tab}
                    onPress={() => setTeamTab(tab)}
                    style={[
                      styles.teamTab,
                      {
                        backgroundColor: active
                          ? theme.colors.surface
                          : 'transparent',
                        borderColor: active
                          ? theme.colors.border
                          : 'transparent',
                        borderRadius: theme.radius.md,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        theme.typography.caption,
                        {
                          color: active
                            ? theme.colors.textPrimary
                            : theme.colors.textSecondary,
                          fontWeight: '700',
                        },
                      ]}
                    >
                      {tab === 'mine' ? 'My Teams' : 'Discover'}
                    </Text>
                  </PressableScale>
                );
              })}
              <View style={{ flex: 1 }} />
              <Button
                title="Create Team"
                icon="plus"
                onPress={() => navigation.navigate('CreateTeam')}
              />
            </View>

            {teamTab === 'mine' ? (
              myTeams.length === 0 ? (
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  You are not on any teams yet. Discover squads or create your
                  own.
                </Text>
              ) : (
                myTeams.map(team => (
                  <TeamCard
                    key={team.id}
                    team={team}
                    onPress={() =>
                      navigation.navigate('TeamDetail', { teamId: team.id })
                    }
                  />
                ))
              )
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {[...SPORT_TAGS, 'More'].map(tag => {
                    const active =
                      sportTag === tag ||
                      (tag === 'More' && sportTag === 'More');
                    return (
                      <PressableScale
                        key={tag}
                        onPress={() => setSportTag(active ? null : tag)}
                        style={[
                          styles.sportChip,
                          {
                            backgroundColor: active
                              ? theme.colors.primary
                              : theme.colors.surfaceMuted,
                            borderRadius: theme.radius.pill,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? '#fff' : theme.colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {tag}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>

                {discoverTeams.length === 0 ? (
                  <Text
                    style={[
                      theme.typography.body,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    No teams match this filter.
                  </Text>
                ) : (
                  discoverTeams.map(team => {
                    const pending = joinRequests.some(
                      r =>
                        r.teamId === team.id &&
                        r.userId === CURRENT_USER_ID &&
                        r.status === 'pending',
                    );
                    const member = isMember(team.id);
                    return (
                      <DiscoverTeamCard
                        key={team.id}
                        team={team}
                        onView={() =>
                          navigation.navigate('TeamDetail', { teamId: team.id })
                        }
                        onJoin={() => {
                          const result = joinTeam(team.id);
                          if (result === 'joined') {
                            navigation.navigate('TeamDetail', {
                              teamId: team.id,
                            });
                          }
                        }}
                        joinLabel={
                          member
                            ? 'Joined'
                            : pending
                            ? 'Request pending'
                            : undefined
                        }
                        joinDisabled={member || pending}
                      />
                    );
                  })
                )}
              </>
            )}
          </View>
        ) : null}

        {mode === 'challenges' ? (
          <View
            style={[
              styles.padded,
              { gap: 14, marginTop: 12, paddingBottom: 24 },
            ]}
          >
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary },
              ]}
            >
              Join challenges with your team. Select an eligible squad to
              participate.
            </Text>
            {challenges.map(challenge => {
              const eligible = getEligibleTeamsForChallenge(challenge.id)[0];
              return (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  eligibleTeam={eligible}
                  onPress={() =>
                    navigation.navigate('ChallengeDetail', {
                      challengeId: challenge.id,
                    })
                  }
                />
              );
            })}
          </View>
        ) : null}

        {mode === 'feed' ? (
          <View style={{ gap: 20, marginTop: 12, paddingBottom: 24 }}>
            <View style={[styles.padded, { gap: 12 }]}>
              <View style={styles.eventsHeading}>
                <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>Events</Text>
                <PressableScale accessibilityLabel="Create event" testID="nexus-create-event" onPress={() => navigation.navigate('CreateExploreEvent')} style={[styles.createEvent, { backgroundColor: theme.colors.primary }]}>
                  <AppIcon name="plus" size={24} color="#fff" />
                </PressableScale>
              </View>
              <View
                style={[
                  styles.search,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radius.lg,
                  },
                ]}
              >
                <AppIcon
                  name="search"
                  size={18}
                  color={theme.colors.textTertiary}
                />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search events, products..."
                  placeholderTextColor={theme.colors.textTertiary}
                  style={[
                    styles.searchInput,
                    { color: theme.colors.textPrimary },
                  ]}
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

              {filter !== 'events' ? <Button title="Create product" icon="plus" variant="ghost" onPress={() => navigation.navigate('CreateExploreProduct')} /> : null}

              {quickPills.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8 }}
                >
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
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? '#fff' : theme.colors.textSecondary,
                            fontSize: 12,
                            fontWeight: '700',
                          }}
                        >
                          {q.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>

            {feedLoading ? (
              <View style={[styles.padded, { gap: 12 }]}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>Loading Explore…</Text>
              </View>
            ) : feedError ? (
              <View style={[styles.padded, { gap: 12 }]}>
                <Text style={[theme.typography.bodySmall, { color: theme.colors.error }]}>Could not load Explore.</Text>
                <Button title="Retry" variant="secondary" onPress={() => {
                  void eventQuery.refetch();
                  void productQuery.refetch();
                }} />
              </View>
            ) : query.trim() ? (
              <View style={[styles.padded, { gap: 12 }]}>
                <SectionHeader title="Search results" />
                {searchResults.length === 0 ? (
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
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
                      contentContainerStyle={styles.hRow}
                    >
                      {mine.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {events.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader title={followingOnly ? 'Events from people you follow' : 'Upcoming Events'} />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}
                    >
                      {events.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {products.length > 0 ? (
                  <View style={{ gap: 12 }}>
                    <View style={styles.padded}>
                      <SectionHeader title={followingOnly ? 'Products from people you follow' : 'Products'} />
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.hRow}
                    >
                      {products.map(item => renderItem(item, true))}
                    </ScrollView>
                  </View>
                ) : null}

                {events.length === 0 && products.length === 0 ? (
                  <View style={[styles.padded, { gap: 8 }]}>
                    <SectionHeader title="Nothing here yet" />
                    <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>Try another filter, or create the first listing.</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>
        ) : null}
      </ScreenContainer>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: 16 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeTab: {
    flex: 1,
    minWidth: 72,
    alignItems: 'center',
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  teamTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  teamTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sportChip: { paddingHorizontal: 12, paddingVertical: 8 },
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
  eventsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  createEvent: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
