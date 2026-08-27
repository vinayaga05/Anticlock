import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { labs, labTests } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceMode } from '@/shared/types';

export function LabDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'LabDetail'>>();
  const lab = labs.find(l => l.id === route.params.labId) ?? labs[1];
  const test = labTests.find(t => t.id === route.params.testId) ?? labTests[0];
  const [mode, setMode] = useState<ServiceMode>('center');

  return (
    <ScreenContainer scrollable tabAware={false}>
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />

      <View style={styles.hero}>
        <Card style={{ flex: 1, gap: 8 }}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {lab.name}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Tests you can trust · {lab.experienceYears} years
          </Text>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <AppIcon name="check-circle" size={28} color={theme.colors.yellow} />
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
            Accredited
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Next: Mon 5–10pm
          </Text>
        </Card>
      </View>

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {lab.name}
        </Text>
        <View style={styles.meta}>
          <AppIcon name="location" size={16} color={theme.colors.primary} />
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            {lab.location}
          </Text>
        </View>
        <View style={styles.meta}>
          <AppIcon name="flask" size={16} color={theme.colors.primary} />
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Test: {test.name}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.iconBtn}>
            <AppIcon name="messages" size={18} color={theme.colors.primary} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Call</Text>
          </View>
          <View style={styles.iconBtn}>
            <AppIcon name="location" size={18} color={theme.colors.primary} />
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Map</Text>
          </View>
        </View>
      </Card>

      <Button
        title="Book appointment"
        icon="calendar"
        onPress={() =>
          navigation.navigate('Schedule', {
            kind: 'lab',
            id: lab.id,
            title: `${test.name} · ${lab.name}`,
            fee: test.priceFrom,
          })
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 20, marginTop: 6 },
  iconBtn: { alignItems: 'center', gap: 4 },
});
