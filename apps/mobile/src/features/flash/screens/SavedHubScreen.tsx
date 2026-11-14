import React, { useMemo, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { FilterPills } from '@/shared/components/FilterPills';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { SavedContentKind } from '@/shared/data/flash/types';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { useSavedExploreEventsQuery } from '@/shared/api/exploreHooks';
import { useSavedProductsQuery } from '@/shared/api/shopHooks';
import { apiRequest } from '@/shared/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SavedContent } from '@/shared/data/flash/types';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useSavedBusinessesQuery, useUnsaveBusinessMutation } from '@/features/business-profile/businessSavedHooks';

type SavedHubKind = SavedContentKind | 'business';
type SavedHubItem = Omit<SavedContent, 'kind'> & { kind: SavedHubKind };

const BUCKETS: { id: SavedHubKind | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'flash', label: 'Flash Posts' },
  { id: 'clip', label: 'Clips' },
  { id: 'service', label: 'Services' },
  { id: 'business', label: 'Businesses' },
  { id: 'product', label: 'Products' },
  { id: 'course', label: 'Courses' },
  { id: 'event', label: 'Events' },
];

export function SavedHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const saved = useEngagementStore(s => s.saved);
  const unsaveContent = useEngagementStore(s => s.unsaveContent);
  const [bucket, setBucket] = useState<SavedHubKind | 'all'>('all');
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;
  const eventsQuery = useSavedExploreEventsQuery(viewer);
  const productsQuery = useSavedProductsQuery(viewer);
  const businessesQuery = useSavedBusinessesQuery(viewer);
  const removeBusiness = useUnsaveBusinessMutation(viewer);
  const queryClient = useQueryClient();
  const removeExplore = useMutation({
    mutationFn: async (input: { kind: 'event' | 'product'; id: string }) => {
      const params = new URLSearchParams();
      if (viewer) {
        params.set('viewerProfileId', viewer.id);
        params.set('viewerProfileType', viewer.type);
      }
      const base = input.kind === 'event' ? '/v1/explore/events' : '/v1/shop/products';
      await apiRequest(`${base}/${input.id}/save${params.toString() ? `?${params}` : ''}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['explore', 'events', 'saved'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'saved'] });
    },
  });

  const serverSaved = useMemo<SavedHubItem[]>(() => [
    ...(eventsQuery.data?.events ?? []).map(event => ({
      id: `server-event-${event.id}`,
      kind: 'event' as const,
      title: event.title,
      subtitle: event.publisher.displayName,
      imageUrl: event.media[0]?.thumbnailUrl ?? event.media[0]?.url,
      refId: event.id,
      savedAt: event.updatedAt,
    })),
    ...(productsQuery.data?.products ?? []).map(product => ({
      id: `server-product-${product.id}`,
      kind: 'product' as const,
      title: product.name,
      subtitle: product.publisher?.displayName ?? 'Anticlock Shop',
      imageUrl: product.images[0]?.thumbnailUrl ?? product.images[0]?.url,
      refId: product.id,
      savedAt: product.updatedAt,
    })),
    ...(businessesQuery.data?.pages.flatMap(page => page.businesses) ?? []).map(business => ({
      id: `server-business-${business.id}`,
      kind: 'business' as const,
      title: business.name,
      subtitle: [business.categoryLabel, [business.area, business.city].filter(Boolean).join(', ')].filter(Boolean).join(' · '),
      imageUrl: business.avatarUrl ?? business.coverUrl ?? undefined,
      refId: business.id,
      savedAt: business.savedAt,
    })),
  ], [eventsQuery.data?.events, productsQuery.data?.products, businessesQuery.data?.pages]);

  const items = useMemo(
    () => {
      const legacy = saved.filter(item => item.kind !== 'event' && item.kind !== 'product');
      const all = [...serverSaved, ...legacy];
      return bucket === 'all' ? all : all.filter(item => item.kind === bucket);
    },
    [saved, serverSaved, bucket],
  );

  const openItem = (kind: SavedHubKind, refId: string) => {
    switch (kind) {
      case 'flash':
        navigation.navigate('Main', { screen: 'Flash' });
        break;
      case 'clip':
        navigation.navigate('Main', { screen: 'PlayFeed' });
        break;
      case 'product':
        navigation.navigate('ProductDetail', { productId: refId });
        break;
      case 'course':
        navigation.navigate('CourseDetail', { courseId: refId });
        break;
      case 'event':
        navigation.navigate('EventDetail', { eventId: refId });
        break;
      case 'service':
        navigation.navigate('Main', { screen: 'Needs' });
        break;
      case 'business':
        navigation.navigate('BusinessProfile', { providerId: refId });
        break;
    }
  };
  const showBusinesses = bucket === 'all' || bucket === 'business';
  const loading = bucket === 'business' ? businessesQuery.isLoading : eventsQuery.isLoading || productsQuery.isLoading || businessesQuery.isLoading;
  const loadError = bucket === 'business' ? businessesQuery.error : eventsQuery.error || productsQuery.error || businessesQuery.error;
  const refresh = () => {
    void eventsQuery.refetch();
    void productsQuery.refetch();
    void businessesQuery.refetch();
  };

  return (
    <ScreenContainer scrollable={false} tabAware={false} padded={false}>
      <View style={{ paddingHorizontal: theme.spacing.lg, gap: theme.spacing.md, flex: 1 }}>
        <FilterPills
          activeId={bucket}
          onChange={id => setBucket(id as SavedHubKind | 'all')}
          pills={BUCKETS}
        />
        {removeBusiness.error ? <Text accessibilityRole="alert" style={{ color: theme.colors.error }}>This business could not be removed. Try Remove again.</Text> : null}
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 40 }}
          refreshing={Boolean(eventsQuery.isRefetching || productsQuery.isRefetching || businessesQuery.isRefetching)}
          onRefresh={refresh}
          ListFooterComponent={showBusinesses ? <View style={{ gap: 10, paddingTop: 10 }}>
            {businessesQuery.isError ? <Button title="Retry saved businesses" variant="secondary" onPress={() => { void businessesQuery.refetch(); }} disabled={businessesQuery.isFetching} /> : businessesQuery.hasNextPage ? <Button title="More saved businesses" variant="secondary" loading={businessesQuery.isFetchingNextPage} disabled={businessesQuery.isFetching} onPress={() => { if (!businessesQuery.isFetching) void businessesQuery.fetchNextPage({ cancelRefetch: false }); }} /> : null}
          </View> : null}
          ListEmptyComponent={
            <EmptyState
              icon="save"
              title={loading ? 'Loading saved items…' : 'Nothing saved yet'}
              description={loadError
                ? 'Some saved items could not be loaded. Pull down to retry.'
                : bucket === 'business' ? 'Save an approved business from its profile to find it here.' : 'Save businesses, Flash posts, Play videos, and marketplace items to find them here.'}
            />
          }
          renderItem={({ item }) => (
            <Card
              onPress={() => openItem(item.kind, item.refId)}
              style={styles.row}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.textPrimary, fontWeight: '700' },
                  ]}
                  numberOfLines={2}>
                  {item.title}
                </Text>
                <Text
                  style={[theme.typography.caption, { color: theme.colors.textSecondary }]}
                  numberOfLines={1}>
                  {item.kind}
                  {item.subtitle ? ` · ${item.subtitle}` : ''}
                </Text>
              </View>
              <PressableScale
                accessibilityLabel={`Remove ${item.title}`}
                disabled={item.kind === 'business' && removeBusiness.isPending}
                onPress={() => item.kind === 'business'
                  ? removeBusiness.mutate(item.refId)
                  : item.id.startsWith('server-')
                    ? removeExplore.mutate({ kind: item.kind as 'event' | 'product', id: item.refId })
                    : unsaveContent(item.id)}
                style={{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }}>
                <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>Remove</Text>
              </PressableScale>
            </Card>
          )}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
});
