import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { FilterPills } from '@/shared/components/FilterPills';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { doctors } from '@/shared/data/mocks';

export function DoctorsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState('all');

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search doctors" />
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'bookings', label: 'My Booking' },
          { id: 'online', label: 'Online' },
          { id: 'all', label: 'All' },
        ]}
      />
      {doctors.map(doc => (
        <Card key={doc.id} elevated style={{ gap: 12 }}>
          <View style={styles.row}>
            <Image source={{ uri: doc.imageUrl }} style={styles.avatar} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                {doc.name}
              </Text>
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                {doc.qualification} · {doc.specialty}
              </Text>
              <View style={styles.meta}>
                <AppIcon name="activity" size={14} color={theme.colors.primary} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {doc.experienceYears} yrs
                </Text>
                <AppIcon name="heart" size={14} color={theme.colors.yellow} />
                <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                  {doc.rating}
                </Text>
                {doc.online ? (
                  <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '700' }]}>
                    Online
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <Button
              title="Profile"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => navigation.navigate('DoctorProfile', { doctorId: doc.id })}
            />
            <Button
              title="Book"
              icon="calendar"
              style={{ flex: 1 }}
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
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8 },
});
