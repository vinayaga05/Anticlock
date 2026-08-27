import React from 'react';
import { Text } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { getUniversalBookings } from '@/shared/data/services';

export function MyTripsScreen() {
  const theme = useTheme();
  const trips = getUniversalBookings().filter(
    b => b.type === 'event_booking' || b.type === 'transport_booking',
  );

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
          <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '700' }]}>
            {trip.status.toUpperCase()}
          </Text>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {trip.title}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {trip.subtitle}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {[trip.date, trip.time].filter(Boolean).join(' · ')}
          </Text>
          {trip.place ? (
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
              {trip.place}
            </Text>
          ) : null}
        </Card>
      ))}
    </ScreenContainer>
  );
}
