import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Text } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { LocationBar } from '@/shared/components/LocationBar';
import { PartnerLogoRow } from '@/shared/components/PartnerLogoRow';
import { ServiceTileGrid } from '@/shared/components/ServiceTileGrid';
import { PromoBannerRow } from '@/shared/components/PromoBannerRow';
import { useTheme } from '@/shared/hooks/useTheme';
import { homeServices, partners, physioSpecialties } from '@/shared/data/mocks';

export function PhysioHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search physiotherapy" />
      <LocationBar />
      <PartnerLogoRow names={partners} />
      <ServiceTileGrid
        tiles={homeServices}
        onPress={tile => {
          if (tile.route === 'Doctors') navigation.navigate('Doctors');
          else if (tile.route === 'DiagnosticsHub') navigation.navigate('DiagnosticsHub');
          else if (tile.route === 'Shop') navigation.navigate('Main', { screen: 'Shop' });
        }}
      />
      <PromoBannerRow
        banners={[
          {
            id: 'p1',
            title: 'Sports Rehab',
            cta: 'Book Now',
            imageUrl:
              'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('FitnessFeed'),
          },
          {
            id: 'p2',
            title: 'Specialty Center',
            cta: 'Book Now',
            imageUrl:
              'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('Doctors'),
          },
        ]}
      />
      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Therapy specialists
      </Text>
      <ServiceTileGrid
        tiles={physioSpecialties}
        columns={5}
        onPress={() => navigation.navigate('Doctors')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
});
