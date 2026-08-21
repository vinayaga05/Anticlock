import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { LocationBar } from '@/shared/components/LocationBar';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { RootStackParamList } from '@/shared/navigation/types';

export function BookingConfirmScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'BookingConfirm'>>();
  const { title, subtitle, when, place, fee, patientName } = route.params;

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <LocationBar />
      <View style={[styles.confirmed, { backgroundColor: theme.colors.green }]}>
        <Text style={styles.confirmedText}>Booking Confirmed</Text>
      </View>
      <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
        Consultation Booked For
      </Text>
      <View style={[styles.patient, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            {(patientName ?? 'U').slice(0, 1)}
          </Text>
        </View>
        <View>
          <Text style={{ color: theme.colors.navy, fontWeight: '700' }}>
            {patientName ?? 'Guest User'}
          </Text>
          <Text style={{ color: '#666' }}>Age-42</Text>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Row label="Provider" value={title} />
        <Row label="Specialist" value={subtitle} />
        <Row label="Appointment IN" value={place} />
        <Row label="Appointment Time" value={when} />
        <View style={[styles.paid, { backgroundColor: theme.colors.green }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>
            Amount Paid Rs {fee}
          </Text>
        </View>
      </View>

      <Button
        title="My Bookings"
        onPress={() => navigation.navigate('MyBookings')}
      />
      <Button
        title="Back to Home"
        variant="outline"
        onPress={() => navigation.navigate('Main', { screen: 'Home' })}
      />
    </ScreenContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ color: '#888', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#1A3A5C', fontWeight: '700', fontSize: 15 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  confirmed: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  confirmedText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  label: { textAlign: 'center', fontWeight: '600' },
  patient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: 14,
    padding: 16,
  },
  paid: {
    marginTop: 8,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: 'center',
  },
});
