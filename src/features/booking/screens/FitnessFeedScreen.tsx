import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessClasses } from '@/shared/data/mocks';

export function FitnessFeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('all');

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <SearchBar placeholder="Search classes" />
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'bookings', label: 'My Booking' },
          { id: 'online', label: 'Online' },
          { id: 'all', label: 'All Class', tone: 'success' },
        ]}
      />
      {fitnessClasses.map(item => (
        <Pressable
          key={item.id}
          onPress={() => navigation.navigate('ClassDetail', { classId: item.id })}
          style={styles.card}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <View style={styles.overlay}>
            <View style={styles.meta}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>
                Coach: {item.coach} · {item.schedule}
              </Text>
            </View>
            <View style={styles.cta}>
              <Text style={[styles.ctaText, { color: theme.colors.green }]}>Book Now</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
  },
  image: { ...StyleSheet.absoluteFill },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  meta: { flex: 1, paddingRight: 8 },
  title: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sub: { color: '#eee', marginTop: 4, fontSize: 12 },
  cta: {
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ctaText: { fontWeight: '700', fontSize: 12 },
});
