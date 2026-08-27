import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { LocationBar } from '@/shared/components/LocationBar';
import { PartnerLogoRow } from '@/shared/components/PartnerLogoRow';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { labTests, labs, partners } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function LabListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LabList'>>();
  const test = labTests.find(t => t.id === route.params?.testId) ?? labTests[0];

  return (
    <ScreenContainer scrollable tabAware={false}>
      <SearchBar placeholder="Search labs" />
      <LocationBar />
      <PartnerLogoRow names={partners} />

      <View style={styles.toggleRow}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.primary, fontWeight: '700' }]}>
            Health check up
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center', backgroundColor: theme.colors.primarySoft }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.primary, fontWeight: '700' }]}>
            Lab test
          </Text>
        </Card>
      </View>

      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Popular tests
      </Text>
      {labTests.map(item => (
        <Card key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              {item.name}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              From Rs {item.priceFrom} · {item.reportHours}
            </Text>
          </View>
          <Button
            title="Book"
            onPress={() =>
              navigation.navigate('LabDetail', {
                labId: labs[1].id,
                testId: item.id,
              })
            }
          />
        </Card>
      ))}

      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Nearby for {test.name}
      </Text>
      {labs.map(lab => (
        <Card
          key={lab.id}
          onPress={() =>
            navigation.navigate('LabDetail', { labId: lab.id, testId: test.id })
          }
          style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              {lab.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {lab.location} · {lab.distanceKm} km
            </Text>
          </View>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.primary, fontWeight: '700' }]}>
            Rs {test.priceFrom}
          </Text>
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', gap: 8 },
  logo: { width: 48, height: 48, borderRadius: 12 },
});
