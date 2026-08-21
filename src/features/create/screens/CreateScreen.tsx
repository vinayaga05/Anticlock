import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { useTheme } from '@/shared/hooks/useTheme';

const ACTIONS = [
  { id: 'reel', title: 'Upload Clip', subtitle: 'Share a health or fitness reel', route: 'Reels' },
  { id: 'book', title: 'Quick Book', subtitle: 'Book doctor, lab, or class', route: 'Doctors' },
  { id: 'community', title: 'Create Club', subtitle: 'Start a challenge with friends', route: 'Communities' },
];

export function CreateScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Create" />
      <Text style={[styles.lead, { color: theme.colors.textSecondary }]}>
        Add content or jump into a booking flow.
      </Text>
      {ACTIONS.map(action => (
        <Pressable
          key={action.id}
          onPress={() => {
            if (action.route === 'Reels') {
              navigation.navigate('Main', { screen: 'Reels' });
            } else {
              navigation.navigate(action.route);
            }
          }}
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
            },
          ]}>
          <Text style={[styles.title, { color: theme.colors.navy }]}>{action.title}</Text>
          <Text style={{ color: theme.colors.textSecondary }}>{action.subtitle}</Text>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: 8 },
  card: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '700' },
});
