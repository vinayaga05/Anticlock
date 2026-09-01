import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';

const SECTIONS = [
  'Profile',
  'Services',
  'Availability',
  'Bookings',
  'Earnings',
  'Customer requests',
];

export function ProviderDashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer tabAware={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          Provider dashboard
        </Text>
        <Text style={{ color: theme.colors.textSecondary }}>
          Manage your provider profile, services, and bookings. Full tooling arrives in
          upcoming releases.
        </Text>
        {SECTIONS.map(section => (
          <View
            key={section}
            style={[styles.card, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: '600' }}>
              {section}
            </Text>
            <Text style={{ color: theme.colors.textSecondary }}>Coming soon</Text>
          </View>
        ))}
        <Button title="Back to menu" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
});
