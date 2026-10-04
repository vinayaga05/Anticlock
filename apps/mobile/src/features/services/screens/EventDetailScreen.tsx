import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { getEvent } from '@/shared/data/services';
import { useCommunityStore } from '@/shared/data/community';
import { RootStackParamList } from '@/shared/navigation/types';
import { useTripQuery, isApiEnabled } from '@/shared/api';

function formatPrice(price: number) {
  return `Rs ${(price / 100).toFixed(0)}`;
}

export function EventDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'EventDetail'>>();
  
  // Try to use API if enabled, otherwise fall back to mock
  const { data: apiTrip, isLoading, error } = useTripQuery(route.params.eventId);
  const mockEvent = getEvent(route.params.eventId);
  
  const challenge = useCommunityStore(s =>
    s.getChallengeForEvent(route.params.eventId),
  );

  const useApi = isApiEnabled && apiTrip && !error;
  const trip = useApi ? apiTrip : null;
  const event = useApi ? null : mockEvent;

  if (isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="globe" title="Loading trip..." description="Please wait" />
      </ScreenContainer>
    );
  }

  if (!trip && !event) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState 
          icon="globe" 
          title={error ? 'Error loading trip' : 'Event not found'} 
          description={error instanceof Error ? error.message : undefined}
        />
      </ScreenContainer>
    );
  }

  // Render API trip data
  if (trip) {
    const firstImage = trip.images[0]?.url;
    return (
      <ScreenContainer scrollable tabAware={false}>
        {firstImage && <Image source={{ uri: firstImage }} style={styles.hero} />}
        <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
          {trip.name}
        </Text>
        <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
          {trip.destination} · {trip.durationDays} day{trip.durationDays !== 1 ? 's' : ''}
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary, marginTop: 4 }]}>
          Max {trip.maxGroupSize} travelers · {trip.difficulty}
        </Text>
        <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
          {formatPrice(trip.basePrice)} per person
        </Text>

        <Card style={{ gap: 8, marginTop: 12 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Itinerary
          </Text>
          {trip.itinerary.map((day, idx) => (
            <View key={idx} style={{ marginBottom: 8 }}>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                Day {day.day}: {day.title}
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary, marginTop: 2 }]}>
                {day.description}
              </Text>
            </View>
          ))}
        </Card>

        {trip.inclusions.length > 0 && (
          <Card style={{ gap: 6, marginTop: 12 }}>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
              Inclusions
            </Text>
            {trip.inclusions.map((item, idx) => (
              <Text
                key={idx}
                style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                · {item}
              </Text>
            ))}
          </Card>
        )}

        <View style={{ marginTop: 16, gap: 10 }}>
          <Button
            title="Book trip"
            icon="globe"
            onPress={() =>
              Alert.alert('Booking', 'Trip booking flow to be implemented', [
                { text: 'OK' },
              ])
            }
          />
          <Button
            title="View my trips"
            variant="secondary"
            onPress={() => navigation.navigate('MyTrips')}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Render mock event data (fallback)
  return (
    <ScreenContainer scrollable tabAware={false}>
      <Image source={{ uri: event!.imageUrl }} style={styles.hero} />
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {event!.title}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {event!.destination} · {event!.duration}
      </Text>
      <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary, marginTop: 4 }]}>
        {event!.dateLabel} · {event!.slotsLeft} slots left
      </Text>
      {challenge ? (
        <PressableScale
          onPress={() =>
            navigation.navigate('ChallengeDetail', { challengeId: challenge.id })
          }
          accessibilityLabel={`Part of ${challenge.title}`}
          style={[
            styles.challengeBadge,
            { backgroundColor: theme.colors.primarySoft, marginTop: 10 },
          ]}>
          <AppIcon name="zap" size={14} color={theme.colors.primary} />
          <Text
            style={[
              theme.typography.caption,
              { color: theme.colors.primary, fontWeight: '700', flexShrink: 1 },
            ]}
            numberOfLines={1}>
            Part of: {challenge.title}
          </Text>
        </PressableScale>
      ) : null}
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        Rs {event!.price}
      </Text>

      <Card style={{ gap: 8, marginTop: 12 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Itinerary
        </Text>
        {event!.itinerary.map(item => (
          <Text
            key={item}
            style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            · {item}
          </Text>
        ))}
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary, marginTop: 8 }]}>
          Meet at {event!.meetingPoint}
        </Text>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title="Book trip"
          icon="globe"
          onPress={() =>
            Alert.alert('Trip booked', `${event!.title} is confirmed.`, [
              { text: 'My trips', onPress: () => navigation.navigate('MyTrips') },
            ])
          }
        />
        <Button
          title="View my trips"
          variant="secondary"
          onPress={() => navigation.navigate('MyTrips')}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200, borderRadius: 20, marginBottom: 16 },
  challengeBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: '100%',
  },
});
