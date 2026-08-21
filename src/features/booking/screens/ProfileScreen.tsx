import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import { useThemeStore } from '@/shared/store/themeStore';

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const setMode = useThemeStore(s => s.setMode);
  const mode = useThemeStore(s => s.mode);

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Profile & Settings" showActions={false} />
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.name, { color: theme.colors.navy }]}>Guest User</Text>
        <Text style={{ color: '#666' }}>Chennai · Anticlock member</Text>
      </View>

      {[
        { label: 'My Bookings', onPress: () => navigation.navigate('MyBookings') },
        { label: 'Messages (Knock)', onPress: () => navigation.navigate('Inbox') },
        { label: 'Communities', onPress: () => navigation.navigate('Communities') },
        {
          label: `Theme: ${mode}`,
          onPress: () => setMode(mode === 'dark' ? 'light' : 'dark'),
        },
      ].map(item => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          style={[styles.row, { backgroundColor: theme.colors.surface }]}>
          <Text style={{ color: theme.colors.navy, fontWeight: '600' }}>{item.label}</Text>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 14, padding: 16, gap: 4 },
  name: { fontSize: 18, fontWeight: '700' },
  row: { borderRadius: 12, padding: 14 },
});
