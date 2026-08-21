import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { FilterPills } from '@/shared/components/FilterPills';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors } from '@/shared/data/mocks';

export function DoctorsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = React.useState('all');

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <SearchBar placeholder="Search doctors" />
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'bookings', label: 'My Booking' },
          { id: 'online', label: 'Online', tone: 'success' },
          { id: 'all', label: 'All Class' },
        ]}
      />
      {doctors.map(doc => (
        <Pressable
          key={doc.id}
          onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}
          style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Image source={{ uri: doc.imageUrl }} style={styles.avatar} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.name, { color: theme.colors.navy }]}>
              {doc.name} {doc.qualification}
            </Text>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>
              {doc.specialty} · {doc.languages.join(', ')}
            </Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.badgeText}>{doc.experienceYears} YEARS</Text>
              </View>
              <Text>⭐⭐</Text>
              {doc.online ? (
                <Text style={{ color: theme.colors.green, fontWeight: '700' }}>ON</Text>
              ) : null}
            </View>
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
              {doc.nextSlot}
            </Text>
          </View>
          <View style={styles.actions}>
            <Button
              title="Consultation"
              style={{ paddingVertical: 8, minHeight: 36 }}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}
            />
            <Button
              title="Join Now"
              variant="success"
              style={{ paddingVertical: 8, minHeight: 36 }}
              onPress={() =>
                navigation.navigate('Schedule', {
                  kind: 'doctor',
                  id: doc.id,
                  title: doc.name,
                  fee: doc.fee,
                })
              }
            />
          </View>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  name: { fontWeight: '700', fontSize: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  actions: { width: '100%', flexDirection: 'row', gap: 8 },
});
