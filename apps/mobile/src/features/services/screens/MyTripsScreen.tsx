import React from 'react';
import { Text } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useTripBookingsQuery } from '@/shared/api';

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getStatusColor(status: string, theme: any) {
  switch (status) {
    case 'confirmed':
      return theme.colors.success;
    case 'pending':
      return theme.colors.warning;
    case 'completed':
      return theme.colors.textTertiary;
    case 'cancelled':
      return theme.colors.error;
    default:
      return theme.colors.textSecondary;
  }
}

export function MyTripsScreen() {
  const theme = useTheme();
  const { data: apiData, isLoading, error } = useTripBookingsQuery();
  
  const trips = apiData?.bookings ?? [];

  if (isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="globe" title="Loading trips..." description="Please wait" />
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState 
          icon="alert-circle" 
          title="Error loading trips" 
          description={error instanceof Error ? error.message : 'Failed to load trips'} 
        />
      </ScreenContainer>
    );
  }

  if (trips.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="globe" title="No trips yet" description="Book a tour or event to see it here." />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      {trips.map(trip => (
        <Card key={trip.id} elevated style={{ gap: 6 }}>
          <Text style={[theme.typography.caption, { color: getStatusColor(trip.status, theme), fontWeight: '700' }]}>
            {trip.status.toUpperCase()}
          </Text>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {trip.tripName}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {trip.tripDestination}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {formatDate(trip.startDate)} · {trip.numberOfTravelers} traveler{trip.numberOfTravelers !== 1 ? 's' : ''}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
            Booking: {trip.bookingNumber}
          </Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}
