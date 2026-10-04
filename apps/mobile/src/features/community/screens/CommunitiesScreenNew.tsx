import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, RefreshControl } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  useCommunitiesQuery,
  useMyCommunitiesQuery,
  useJoinCommunityMutation,
  isApiEnabled,
} from '@/shared/api';
import type { CommunityDetail } from '@anticlock/contracts';

type ModeTab = 'discover' | 'my';

const MODE_TABS: { id: ModeTab; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'my', label: 'My Communities' },
];

export function CommunitiesScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [mode, setMode] = useState<ModeTab>('discover');
  const [query, setQuery] = useState('');

  const {
    data: discoverData,
    isLoading: isDiscoverLoading,
    error: discoverError,
    refetch: refetchDiscover,
  } = useCommunitiesQuery(query);
  const {
    data: myData,
    isLoading: isMyLoading,
    error: myError,
    refetch: refetchMy,
  } = useMyCommunitiesQuery();
  const joinMutation = useJoinCommunityMutation();

  const isLoading = mode === 'discover' ? isDiscoverLoading : isMyLoading;
  const error = mode === 'discover' ? discoverError : myError;
  const communities = mode === 'discover' ? discoverData?.communities ?? [] : myData?.communities ?? [];
  const refetch = mode === 'discover' ? refetchDiscover : refetchMy;

  const handleJoin = async (communityId: string) => {
    try {
      await joinMutation.mutateAsync(communityId);
    } catch (err) {
      console.error('Failed to join community:', err);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <ScreenContainer scrollable padded={false} contentStyle={{ gap: 0 }}>
        <View style={[styles.padded, { paddingTop: theme.spacing.sm, gap: 12 }]}>
          <AppHeader title="Communities" />

          <View style={styles.modeRow}>
            {MODE_TABS.map((t) => {
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
                      borderColor: active
                        ? theme.colors.primary
                        : theme.colors.border,
                      borderRadius: theme.radius.md,
                    },
                  ]}>
                  <Text
                    style={[
                      theme.typography.caption,
                      {
                        color: active
                          ? theme.colors.primary
                          : theme.colors.textSecondary,
                        fontWeight: '700',
                      },
                    ]}>
                    {t.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {mode === 'discover' ? (
            <View
              style={[
                styles.search,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radius.lg,
                },
              ]}>
              <AppIcon
                name="search"
                size={18}
                color={theme.colors.textTertiary}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search communities..."
                placeholderTextColor={theme.colors.textTertiary}
                style={[
                  styles.searchInput,
                  { color: theme.colors.textPrimary },
                ]}
              />
            </View>
          ) : null}

          {mode === 'my' ? (
            <Button
              title="Create Community"
              icon="plus"
              onPress={() => navigation.navigate('CreateCommunity')}
            />
          ) : null}
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.padded, { gap: 14, paddingVertical: 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
            />
          }>
          {!isApiEnabled ? (
            <View style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md }]}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                API is disabled. Using mock data.
              </Text>
            </View>
          ) : null}

          {error ? (
            <View style={[styles.notice, { backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.md }]}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.error }]}>
                Failed to load communities. Please try again.
              </Text>
            </View>
          ) : null}

          {!isLoading && communities.length === 0 ? (
            <Text
              style={[
                theme.typography.body,
                { color: theme.colors.textSecondary, textAlign: 'center', marginTop: 40 },
              ]}>
              {mode === 'my'
                ? 'You are not a member of any communities yet.'
                : 'No communities found. Try a different search.'}
            </Text>
          ) : null}

          {communities.map((community) => (
            <CommunityCard
              key={community.id}
              community={community}
              onPress={() =>
                navigation.navigate('CommunityDetail', { communityId: community.id })
              }
              onJoin={() => handleJoin(community.id)}
              isJoining={joinMutation.isPending}
            />
          ))}
        </ScrollView>
      </ScreenContainer>
    </View>
  );
}

function CommunityCard({
  community,
  onPress,
  onJoin,
  isJoining,
}: {
  community: CommunityDetail;
  onPress: () => void;
  onJoin: () => void;
  isJoining: boolean;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          ...theme.shadows.card,
        },
      ]}>
      <View style={{ gap: 8 }}>
        <Text style={[theme.typography.h3, { color: theme.colors.textPrimary }]}>
          {community.name}
        </Text>
        {community.description ? (
          <Text
            style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
            numberOfLines={2}>
            {community.description}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {community.memberCount} members · {community.postCount} posts
          </Text>
        </View>
        {community.tags.length > 0 ? (
          <View style={styles.tags}>
            {community.tags.slice(0, 3).map((tag) => (
              <View
                key={tag}
                style={[
                  styles.tag,
                  {
                    backgroundColor: theme.colors.primarySoft,
                    borderRadius: theme.radius.pill,
                  },
                ]}>
                <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '600' }}>
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {community.isMember ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm }]}>
          <Text style={{ color: theme.colors.primary, fontSize: 12, fontWeight: '700' }}>
            Joined
          </Text>
        </View>
      ) : (
        <Button
          title="Join"
          size="sm"
          onPress={(e) => {
            e.stopPropagation();
            onJoin();
          }}
          disabled={isJoining}
        />
      )}
    </PressableScale>
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 15, padding: 0 },
  notice: { padding: 12 },
  card: { padding: 16, gap: 12 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start' },
});
