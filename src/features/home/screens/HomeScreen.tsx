import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { LocationBar } from '@/shared/components/LocationBar';
import { PartnerLogoRow } from '@/shared/components/PartnerLogoRow';
import { ServiceTileGrid } from '@/shared/components/ServiceTileGrid';
import { PromoBannerRow } from '@/shared/components/PromoBannerRow';
import { FilterPills } from '@/shared/components/FilterPills';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  doctorSpecialties,
  fitnessClasses,
  homeServices,
  partners,
} from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceTile } from '@/shared/types';

export function HomeScreen() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState('all');

  const onService = (tile: ServiceTile) => {
    if (tile.route === 'Doctors') navigation.navigate('Doctors');
    else if (tile.route === 'DiagnosticsHub') navigation.navigate('DiagnosticsHub');
    else if (tile.route === 'PhysioHub') navigation.navigate('PhysioHub');
    else if (tile.route === 'Shop') navigation.navigate('Main', { screen: 'Shop' });
    else navigation.navigate('Search');
  };

  return (
    <ScreenContainer scrollable padded contentStyle={{ paddingBottom: 24 }}>
      <AppHeader />
      <View style={styles.searchRow}>
        <View style={{ flex: 1 }}>
          <SearchBar />
        </View>
      </View>
      <LocationBar onBookNearby={() => navigation.navigate('Doctors')} />
      <PartnerLogoRow names={partners} />
      <ServiceTileGrid tiles={homeServices} columns={5} onPress={onService} />
      <PromoBannerRow
        banners={[
          {
            id: 'b1',
            title: 'Healthy groceries',
            cta: 'Buy Now',
            imageUrl: fitnessClasses[0]
              ? 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&h=400&q=80'
              : '',
            onPress: () => navigation.navigate('Main', { screen: 'Shop' }),
          },
          {
            id: 'b2',
            title: 'Specialty Center',
            cta: 'Book Now',
            imageUrl:
              'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('FitnessFeed'),
          },
        ]}
      />
      <FilterPills
        activeId={filter}
        onChange={setFilter}
        pills={[
          { id: 'bookings', label: 'My Booking', tone: 'primary' },
          { id: 'online', label: 'Online', tone: 'success' },
          { id: 'all', label: 'All Class', tone: 'muted' },
        ]}
      />
      {filter === 'bookings' ? (
        <Pressable
          onPress={() => navigation.navigate('MyBookings')}
          style={[styles.linkCard, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.linkText}>View My Bookings</Text>
        </Pressable>
      ) : null}
      <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
        Specialists
      </Text>
      <ServiceTileGrid
        tiles={doctorSpecialties}
        columns={5}
        onPress={() => navigation.navigate('Doctors')}
      />
      <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
        Communities
      </Text>
      <Pressable
        onPress={() => navigation.navigate('Communities')}
        style={[styles.linkCard, { backgroundColor: theme.colors.accent }]}>
        <Text style={styles.linkText}>Explore Clubs & Challenges</Text>
      </Pressable>
      <Text style={[styles.section, { color: theme.colors.textPrimary }]}>
        Featured Class
      </Text>
      <Pressable
        onPress={() =>
          navigation.navigate('ClassDetail', { classId: fitnessClasses[0].id })
        }
        style={styles.featured}>
        <Image
          source={{ uri: fitnessClasses[0].imageUrl }}
          style={styles.featuredImage}
        />
        <View style={styles.featuredMeta}>
          <Text style={styles.featuredTitle}>{fitnessClasses[0].title}</Text>
          <Text style={styles.featuredSub}>
            Coach: {fitnessClasses[0].coach} · {fitnessClasses[0].schedule}
          </Text>
        </View>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  section: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  linkCard: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  linkText: {
    color: '#fff',
    fontWeight: '700',
  },
  featured: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 160,
  },
  featuredImage: {
    ...StyleSheet.absoluteFill,
  },
  featuredMeta: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  featuredTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  featuredSub: {
    color: '#eee',
    fontSize: 12,
    marginTop: 4,
  },
});
