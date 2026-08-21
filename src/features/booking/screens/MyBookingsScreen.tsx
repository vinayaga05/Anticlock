import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { bookings } from '@/shared/data/mocks';

export function MyBookingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <AppHeader title="My Bookings" />
      {bookings.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: theme.colors.textSecondary }}>No bookings yet.</Text>
        </View>
      ) : (
        bookings.map(item => (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.status, { color: theme.colors.green }]}>
              {item.status.toUpperCase()}
            </Text>
            <Text style={{ color: theme.colors.navy, fontWeight: '700', fontSize: 16 }}>
              {item.title}
            </Text>
            <Text style={{ color: '#555' }}>{item.subtitle}</Text>
            <Text style={{ color: '#555', marginTop: 6 }}>{item.when}</Text>
            <Text style={{ color: '#555' }}>{item.place}</Text>
            <Text style={{ color: theme.colors.primary, fontWeight: '700', marginTop: 8 }}>
              Paid Rs {item.amountPaid}
            </Text>
          </View>
        ))
      )}
      <Button title="Book again" onPress={() => navigation.navigate('Doctors')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: 'center' },
  card: { borderRadius: 14, padding: 14, gap: 2 },
  status: { fontWeight: '700', marginBottom: 4 },
});
