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
import { diagnosticTests, homeServices, partners } from '@/shared/data/mocks';

export function DiagnosticsHubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar />
      <LocationBar onBookNearby={() => navigation.navigate('LabList', {})} />
      <PartnerLogoRow names={partners} />
      <ServiceTileGrid
        tiles={homeServices}
        onPress={tile => {
          if (tile.route === 'Doctors') navigation.navigate('Doctors');
          else if (tile.route === 'PhysioHub') navigation.navigate('PhysioHub');
          else if (tile.route === 'Shop') navigation.navigate('Main', { screen: 'Shop' });
        }}
      />
      <PromoBannerRow
        banners={[
          {
            id: 'd1',
            title: 'Health Check Up',
            cta: 'Book Now',
            imageUrl:
              'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('LabList', { testId: 'test-b12' }),
          },
          {
            id: 'd2',
            title: 'Lab Test',
            cta: 'Book Now',
            imageUrl:
              'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('LabList', {}),
          },
        ]}
      />
      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Diagnostic tests
      </Text>
      <ServiceTileGrid
        tiles={diagnosticTests}
        columns={5}
        onPress={() => navigation.navigate('LabList', { testId: 'test-b12' })}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: '700' },
});
