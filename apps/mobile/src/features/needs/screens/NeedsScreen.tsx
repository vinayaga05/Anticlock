import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { PromoBannerRow } from '@/shared/components/PromoBannerRow';
import { FilterPills } from '@/shared/components/FilterPills';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessClasses, doctors } from '@/shared/data/mocks';
import { marketplaceProviders } from '@/shared/data/services';
import { NeedsShowcaseGrid } from '@/features/needs/components/NeedsShowcaseGrid';
import { ProviderCard } from '@/features/services/components/ProviderCard';
import { RootStackParamList } from '@/shared/navigation/types';
import { softFill } from '@/shared/theme/colors';

export function NeedsScreen() {
  const theme = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState('all');
  const popular = marketplaceProviders.slice(0, 3);

  return (
    <ScreenContainer scrollable padded>
      <AppHeader title="Needs" />
      <SearchBar showFilter />

      <SectionHeader title="Explore Services" />
      <NeedsShowcaseGrid />

      <PromoBannerRow
        banners={[
          {
            id: 'b1',
            title: 'Healthy groceries',
            cta: 'Shop',
            imageUrl:
              'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('Main', { screen: 'Shop' }),
          },
          {
            id: 'b2',
            title: 'Specialty Center',
            cta: 'Book',
            imageUrl:
              'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=600&h=400&q=80',
            onPress: () => navigation.navigate('FitnessFeed'),
          },
        ]}
      />

      <SectionHeader
        title="Popular near you"
        actionLabel="See all"
        onAction={() => navigation.navigate('Search')}
      />
      <FilterPills
        activeId={filter}
        onChange={id => {
          setFilter(id);
          if (id === 'bookings') navigation.navigate('MyBookings');
        }}
        pills={[
          { id: 'all', label: 'All' },
          { id: 'bookings', label: 'My Booking' },
          { id: 'online', label: 'Online' },
          { id: 'rated', label: 'Top rated' },
        ]}
      />

      {popular.map(p => (
        <ProviderCard
          key={p.id}
          provider={p}
          onPress={() =>
            navigation.navigate('UniversalDetail', {
              entityType: 'provider',
              entityId: p.id,
              categoryId: p.categoryIds[0],
            })
          }
        />
      ))}

      <SectionHeader
        title="Recommended"
        actionLabel="Doctors"
        onAction={() => navigation.navigate('Doctors')}
      />
      <Card
        onPress={() =>
          navigation.navigate('DoctorProfile', { doctorId: doctors[0].id })
        }
        style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Image
          source={{ uri: doctors[0].imageUrl }}
          style={{ width: 64, height: 64, borderRadius: 16 }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.textPrimary, fontWeight: '700' },
            ]}>
            {doctors[0].name}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {doctors[0].specialty} · ★ {doctors[0].rating}
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
      </Card>

      <Card
        onPress={() => navigation.navigate('Main', { screen: 'Community' })}
        tint={softFill(theme.colors.wellness, 0.12)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={[
            styles.communityIcon,
            {
              backgroundColor: softFill(theme.colors.wellness, 0.22),
              borderRadius: theme.radius.md,
            },
          ]}>
          <AppIcon name="community" size={22} color={theme.colors.wellness} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Communities
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Clubs, challenges, and friends
          </Text>
        </View>
        <AppIcon name="chevron-right" size={18} color={theme.colors.textTertiary} />
      </Card>

      <SectionHeader title="Trending on Anticlock" />
      <PressableScale
        onPress={() =>
          navigation.navigate('ClassDetail', { classId: fitnessClasses[0].id })
        }
        accessibilityLabel="Open featured class"
        style={[styles.featured, { borderRadius: theme.radius.xl, ...theme.shadows.card }]}>
        <Image source={{ uri: fitnessClasses[0].imageUrl }} style={styles.featuredImage} />
        <View style={styles.featuredMeta}>
          <Text style={[theme.typography.section, { color: '#fff' }]}>
            {fitnessClasses[0].title}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: 'rgba(255,255,255,0.9)' }]}>
            Coach: {fitnessClasses[0].coach} · {fitnessClasses[0].schedule}
          </Text>
        </View>
      </PressableScale>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  communityIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featured: {
    height: 180,
    overflow: 'hidden',
  },
  featuredImage: {
    ...StyleSheet.absoluteFill,
  },
  featuredMeta: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 4,
  },
});
