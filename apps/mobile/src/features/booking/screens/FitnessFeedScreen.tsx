import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessClasses } from '@/shared/data/mocks';
import { PressableScale } from '@/shared/components/PressableScale';

export function FitnessFeedScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('all');

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search classes" />
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'bookings', label: 'My Booking' },
          { id: 'online', label: 'Online' },
          { id: 'all', label: 'All Class' },
        ]}
      />
      {fitnessClasses.map(item => (
        <PressableScale
          key={item.id}
          onPress={() => navigation.navigate('ClassDetail', { classId: item.id })}
          accessibilityLabel={item.title}
          style={[styles.card, { borderRadius: theme.radius.xl, ...theme.shadows.card }]}>
          <Image source={{ uri: item.imageUrl }} style={styles.image} />
          <View style={styles.overlay}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[theme.typography.section, { color: '#fff' }]}>{item.title}</Text>
              <Text style={[theme.typography.bodySmall, { color: 'rgba(255,255,255,0.85)', marginTop: 4 }]}>
                Coach: {item.coach} · {item.schedule}
              </Text>
            </View>
            <View
              style={[
                styles.cta,
                { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill },
              ]}>
              <Text style={{ color: '#042F2E', fontWeight: '700', fontSize: 12 }}>Book</Text>
            </View>
          </View>
        </PressableScale>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { height: 180, overflow: 'hidden' },
  image: { ...StyleSheet.absoluteFill },
  overlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  cta: { paddingHorizontal: 14, paddingVertical: 8 },
});
