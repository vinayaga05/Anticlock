import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { bookings } from '@/shared/data/mocks';
import { getUniversalBookings } from '@/shared/data/services';

export function MyBookingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('all');

  const items = useMemo(() => {
    const legacy = bookings.map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle,
      when: b.when,
      place: b.place,
      status: b.status,
      amount: b.amountPaid,
    }));
    const universal = getUniversalBookings().map(b => ({
      id: b.id,
      title: b.title,
      subtitle: b.subtitle ?? '',
      when: [b.time, b.date].filter(Boolean).join(' · '),
      place: b.place ?? '',
      status: b.status,
      amount: b.price ?? 0,
    }));
    const all = [...legacy, ...universal];
    if (filter === 'all') return all;
    return all.filter(item => item.status === filter || (filter === 'upcoming' && item.status === 'confirmed'));
  }, [filter]);

  return (
    <ScreenContainer scrollable tabAware={false}>
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'all', label: 'All' },
          { id: 'upcoming', label: 'Upcoming' },
          { id: 'completed', label: 'Completed' },
          { id: 'cancelled', label: 'Cancelled' },
        ]}
      />
      {items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="No bookings yet"
          description="Book a doctor, lab test, or fitness class to get started."
          actionLabel="Find doctors"
          onAction={() => navigation.navigate('Doctors')}
        />
      ) : (
        items.map(item => (
          <Card key={item.id} elevated style={{ gap: 6 }}>
            <Text
              style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '700' }]}>
              {item.status.toUpperCase()}
            </Text>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
              {item.title}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {item.subtitle}
            </Text>
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.textSecondary, marginTop: 4 },
              ]}>
              {item.when}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {item.place}
            </Text>
            {item.amount ? (
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.primary, fontWeight: '700', marginTop: 6 },
                ]}>
                Paid Rs {item.amount}
              </Text>
            ) : null}
          </Card>
        ))
      )}
      <Button title="Book again" icon="calendar" onPress={() => navigation.navigate('Doctors')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({});
