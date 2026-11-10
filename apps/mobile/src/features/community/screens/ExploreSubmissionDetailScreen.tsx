import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { ExploreEvent, Product } from '@anticlock/contracts';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { reviewStatusLabel, visibilityLabel } from '@/shared/data/explore';
import { RootStackParamList } from '@/shared/navigation/types';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import {
  useExploreEventQuery,
  useManageExploreEventMutation,
} from '@/shared/api/exploreHooks';
import {
  useManageUserProductMutation,
  useProductQuery,
} from '@/shared/api/shopHooks';

type Item = ExploreEvent | Product;

function SubmissionView({ item, kind, busy, onEdit, onArchive, onDelete }: {
  item: Item;
  kind: 'event' | 'product';
  busy: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const isEvent = kind === 'event';
  const event = isEvent ? item as ExploreEvent : null;
  const product = isEvent ? null : item as Product;
  const imageUrl = event?.media[0]?.url ?? product?.images[0]?.url;
  const title = event?.title ?? product!.name;
  const description = event?.description ?? product?.description;
  const editable = ['draft', 'changes_requested', 'rejected'].includes(item.reviewStatus);
  const canArchive = ['approved', 'suspended'].includes(item.reviewStatus);

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title={isEvent ? 'My Event' : 'My Product'} showBrand={false} showActions={false} />
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.hero} /> : null}
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {description ? <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>{description}</Text> : null}

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {reviewStatusLabel(item.reviewStatus)}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {visibilityLabel(item.requestedVisibility)}
        </Text>
        {item.reviewReason ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.warning }]}>Reason: {item.reviewReason}</Text>
        ) : null}
      </Card>

      {event ? (
        <Card style={{ gap: 6, marginTop: 8 }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{new Date(event.startsAt).toLocaleString()}</Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{event.availableCapacity} places available</Text>
        </Card>
      ) : (
        <Card style={{ gap: 6, marginTop: 8 }}>
          <Text style={[theme.typography.title, { color: theme.colors.primary }]}>₹{Math.round(product!.price / 100)}</Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{product!.inventory} in stock</Text>
        </Card>
      )}

      <View style={{ marginTop: 16, gap: 10 }}>
        {editable ? <Button title="Edit" icon="wrench" disabled={busy} onPress={onEdit} /> : null}
        {canArchive ? <Button title="Archive" variant="secondary" disabled={busy} onPress={onArchive} /> : null}
        {!canArchive && item.reviewStatus !== 'archived' ? (
          <Button title="Delete" variant="secondary" disabled={busy} onPress={onDelete} />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function EventSubmission({ id }: { id: string }) {
  const navigation = useNavigation<any>();
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;
  const query = useExploreEventQuery(id, viewer);
  const manage = useManageExploreEventMutation();
  if (query.isLoading) return <ScreenContainer tabAware={false}><EmptyState title="Loading event…" /></ScreenContainer>;
  if (!query.data) return <ScreenContainer tabAware={false}><EmptyState title="Event unavailable" description={query.error instanceof Error ? query.error.message : undefined} /></ScreenContainer>;
  const run = (action: 'archive' | 'delete') => manage.mutate({ id, action }, {
    onSuccess: () => action === 'delete' ? navigation.goBack() : void query.refetch(),
    onError: error => Alert.alert('Could not update event', error instanceof Error ? error.message : 'Please try again.'),
  });
  return <SubmissionView item={query.data} kind="event" busy={manage.isPending}
    onEdit={() => navigation.navigate('CreateExploreEvent', { itemId: id })}
    onArchive={() => run('archive')}
    onDelete={() => Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run('delete') },
    ])} />;
}

function ProductSubmission({ id }: { id: string }) {
  const navigation = useNavigation<any>();
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;
  const query = useProductQuery(id, viewer);
  const manage = useManageUserProductMutation();
  if (query.isLoading) return <ScreenContainer tabAware={false}><EmptyState title="Loading product…" /></ScreenContainer>;
  if (!query.data) return <ScreenContainer tabAware={false}><EmptyState title="Product unavailable" description={query.error instanceof Error ? query.error.message : undefined} /></ScreenContainer>;
  const run = (action: 'archive' | 'delete') => manage.mutate({ id, action }, {
    onSuccess: () => action === 'delete' ? navigation.goBack() : void query.refetch(),
    onError: error => Alert.alert('Could not update product', error instanceof Error ? error.message : 'Please try again.'),
  });
  return <SubmissionView item={query.data} kind="product" busy={manage.isPending}
    onEdit={() => navigation.navigate('CreateExploreProduct', { itemId: id })}
    onArchive={() => run('archive')}
    onDelete={() => Alert.alert('Delete product?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run('delete') },
    ])} />;
}

export function ExploreSubmissionDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ExploreSubmissionDetail'>>();
  return route.params.kind === 'event'
    ? <EventSubmission id={route.params.itemId} />
    : <ProductSubmission id={route.params.itemId} />;
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220, borderRadius: 16, backgroundColor: '#EEE', marginBottom: 12 },
});
