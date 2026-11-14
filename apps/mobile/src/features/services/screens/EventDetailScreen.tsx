import React from 'react';
import { navigateToProfile } from '@/shared/navigation/businessNavigation';
import { Alert, Image, Share, StyleSheet, Text, View } from 'react-native';
import Video from 'react-native-video';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';
import {
  useEventRegistrationMutation,
  useExploreEventQuery,
  useSaveExploreEventMutation,
} from '@/shared/api/exploreHooks';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';

function money(amount: number, currency: string) {
  if (amount === 0) return 'Free';
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency, maximumFractionDigits: 0,
  }).format(amount / 100);
}

export function EventDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>();
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;
  const query = useExploreEventQuery(route.params.eventId, viewer);
  const registration = useEventRegistrationMutation(route.params.eventId, viewer);
  const save = useSaveExploreEventMutation(route.params.eventId, viewer);

  if (query.isLoading) {
    return <ScreenContainer tabAware={false}><EmptyState icon="calendar" title="Loading event…" /></ScreenContainer>;
  }
  if (query.error || !query.data) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="search"
          title="Event unavailable"
          description={query.error instanceof Error ? query.error.message : 'This event may have been removed.'}
          actionLabel="Retry"
          onAction={() => void query.refetch()}
        />
      </ScreenContainer>
    );
  }

  const event = query.data;
  const starts = new Date(event.startsAt);
  const ends = new Date(event.endsAt);
  const place = event.venueType === 'online'
    ? 'Online event'
    : event.location?.address ?? event.location?.name ?? 'Location to be announced';
  const paidCheckoutUnavailable = event.ticketType === 'paid' && !event.viewerIsRegistered;

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title="Event" showBrand={false} showActions={false} />
      {event.media[0]?.url ? event.media[0].kind === 'video' ? (
        <Video source={{ uri: event.media[0].url }} style={styles.hero} controls repeat resizeMode="cover" />
      ) : <Image source={{ uri: event.media[0].url }} style={styles.hero} /> : null}
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>{event.title}</Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>Hosted by {event.publisher.displayName}</Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        {money(event.price, event.currency)}
      </Text>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>When & where</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {starts.toLocaleString()} – {ends.toLocaleString()} ({event.timezone})
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{place}</Text>
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          {event.availableCapacity} of {event.capacity} places available
        </Text>
      </Card>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>About</Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>{event.description}</Text>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        {paidCheckoutUnavailable ? (
          <Text style={[theme.typography.bodySmall, { color: theme.colors.warning }]}>Paid registration checkout is not available yet. Contact the organizer to register.</Text>
        ) : null}
        <Button
          title={registration.isPending ? 'Updating…' : event.viewerIsRegistered ? 'Cancel registration' : 'Register'}
          disabled={registration.isPending || paidCheckoutUnavailable || (!event.viewerIsRegistered && event.availableCapacity === 0)}
          onPress={() => registration.mutate(event.viewerIsRegistered, {
            onError: error => Alert.alert('Could not update registration', error instanceof Error ? error.message : 'Please try again.'),
          })}
        />
        <Button
          title={event.viewerHasSaved ? 'Saved' : 'Save event'}
          variant="secondary"
          icon="bookmark"
          disabled={save.isPending}
          onPress={() => save.mutate(event.viewerHasSaved, {
            onError: error => Alert.alert('Could not update saved events', error instanceof Error ? error.message : 'Please try again.'),
          })}
        />
        <Button
          title="Share"
          variant="secondary"
          icon="share"
          onPress={() => void Share.share({
            title: event.title,
            message: `${event.title}\n${starts.toLocaleString()}\nanticlock://event/${event.id}`,
          })}
        />
        <Button
          title="Contact organizer"
          variant="secondary"
          icon="messages"
          onPress={() => navigateToProfile(navigation, { id: event.publisherProfileId, type: event.publisherProfileType })}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 220, borderRadius: 20, marginBottom: 16, backgroundColor: '#EEE' },
});
