import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { Glass } from '@/shared/components/Glass';
import { healthTheme } from '@/shared/theme/healthTheme';
import { SearchBar } from '@/shared/components/SearchBar';
import { LocationBar } from '@/shared/components/LocationBar';
import { PartnerLogoRow } from '@/shared/components/PartnerLogoRow';
import { Button } from '@/shared/components/Button';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { labTests, labs, partners } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function LabListScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LabList'>>();
  const test = labTests.find(t => t.id === route.params?.testId) ?? labTests[0];

  return (
    <HealthScreenShell scrollable tabAware={false}>
      <SearchBar placeholder="Search labs" />
      <LocationBar />
      <PartnerLogoRow names={partners} />

      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Popular tests
      </Text>
      {labTests.map(item => (
        <Glass key={item.id} variant="health" intensity="medium" radius={healthTheme.radiusMd} elevated style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
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
            variant="health"
            onPress={() =>
              navigation.navigate('LabDetail', {
                labId: labs[1].id,
                testId: item.id,
              })
            }
          />
        </Glass>
      ))}

      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Nearby for {test.name}
      </Text>
      {labs.map(lab => (
        <PressableScale
          key={lab.id}
          onPress={() =>
            navigation.navigate('LabDetail', { labId: lab.id, testId: test.id })
          }>
          <Glass
            variant="health"
            intensity="medium"
            radius={healthTheme.radiusMd}
            elevated
            style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12 }}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
              {lab.name}
            </Text>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              {lab.location} · {lab.distanceKm} km
            </Text>
          </View>
          <Text style={[theme.typography.bodySmall, { color: healthTheme.navy, fontWeight: '700' }]}>
            Rs {test.priceFrom}
          </Text>
        </Glass>
        </PressableScale>
      ))}
    </HealthScreenShell>
  );
}

const styles = StyleSheet.create({
  logo: { width: 48, height: 48, borderRadius: 12 },
});
