import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { LocationBar } from '@/shared/components/LocationBar';
import { PartnerLogoRow } from '@/shared/components/PartnerLogoRow';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { labTests, labs, partners } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function LabListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LabList'>>();
  const test = labTests.find(t => t.id === route.params?.testId) ?? labTests[0];

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <SearchBar placeholder="Search labs" />
      <LocationBar />
      <PartnerLogoRow names={partners} />
      <View style={styles.toggleRow}>
        <View style={[styles.toggle, { backgroundColor: theme.colors.navy }]}>
          <Text style={styles.toggleText}>Health Check Up</Text>
        </View>
        <View style={[styles.toggle, { backgroundColor: theme.colors.green }]}>
          <Text style={styles.toggleText}>Lab Test</Text>
        </View>
      </View>

      <Text style={[styles.section, { color: theme.colors.orange }]}>{test.name}</Text>
      {labTests.map(item => (
        <View
          key={item.id}
          style={[styles.testCard, { backgroundColor: theme.colors.surface }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.orange, fontWeight: '700', fontSize: 16 }}>
              {item.name}
            </Text>
            <Text style={{ color: '#333', marginTop: 4 }}>
              Starting From Rs {item.priceFrom}
            </Text>
            <Text style={{ color: '#555', fontSize: 12 }}>
              Reports within {item.reportHours}
            </Text>
            <Text style={{ color: '#555', fontSize: 12 }}>
              Available At - {item.availableAt}
            </Text>
          </View>
          <Button
            title="Book Now"
            style={{ backgroundColor: theme.colors.orange, minWidth: 100 }}
            onPress={() =>
              navigation.navigate('LabDetail', {
                labId: labs[1].id,
                testId: item.id,
              })
            }
          />
        </View>
      ))}

      <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
        Nearby centers for {test.name}
      </Text>
      {labs.map(lab => (
        <Pressable
          key={lab.id}
          onPress={() =>
            navigation.navigate('LabDetail', { labId: lab.id, testId: test.id })
          }
          style={[styles.labCard, { backgroundColor: theme.colors.surface }]}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.navy, fontWeight: '700' }}>{lab.name}</Text>
            <Text style={{ color: '#666', fontSize: 12 }}>
              {lab.location} · {lab.distanceKm} km
            </Text>
            <Text style={{ color: '#666', fontSize: 12 }}>{lab.collection}</Text>
          </View>
          <View style={{ gap: 6 }}>
            <View style={[styles.price, { backgroundColor: theme.colors.primary }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Rs.{test.priceFrom}</Text>
            </View>
            <Button
              title="Book Now"
              style={{ paddingVertical: 8, minHeight: 34 }}
              onPress={() =>
                navigation.navigate('LabDetail', { labId: lab.id, testId: test.id })
              }
            />
          </View>
        </Pressable>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggle: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleText: { color: '#fff', fontWeight: '700' },
  section: { fontSize: 16, fontWeight: '700', marginTop: 4 },
  testCard: {
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labCard: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  logo: { width: 54, height: 54, borderRadius: 10 },
  price: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
});
