import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { Glass } from '@/shared/components/Glass';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';
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
    <HealthScreenShell scrollable tabAware={false}>
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />

      <View style={styles.hero}>
        <Glass variant="health" intensity="heavy" radius={healthTheme.radiusMd} elevated style={{ flex: 1, gap: 8, padding: 14 }}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <Text style={[theme.typography.section, { color: healthTheme.navy }]}>
            {lab.name}
          </Text>
          <Text style={[theme.typography.caption, { color: healthTheme.textMuted }]}>
            Tests you can trust · {lab.experienceYears} years
          </Text>
        </Glass>
        <Glass variant="health" intensity="medium" radius={healthTheme.radiusMd} elevated style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 14 }}>
          <AppIcon name="check-circle" size={28} color={healthTheme.sky} />
          <Text style={[theme.typography.bodySmall, { color: healthTheme.navy, fontWeight: '700' }]}>
            Accredited
          </Text>
          <Text style={[theme.typography.caption, { color: healthTheme.textMuted }]}>
            Next: Mon 5–10pm
          </Text>
        </Glass>
      </View>

      <Glass variant="health" intensity="heavy" radius={healthTheme.radiusMd} elevated style={{ gap: 8, padding: 16 }}>
        <Text style={[theme.typography.section, { color: healthTheme.navy }]}>
          {lab.name}
        </Text>
        <View style={styles.meta}>
          <AppIcon name="location" size={16} color={healthTheme.navy} />
          <Text style={[theme.typography.bodySmall, { color: healthTheme.textMuted }]}>
            {lab.location}
          </Text>
        </View>
        <View style={styles.meta}>
          <AppIcon name="flask" size={16} color={healthTheme.navy} />
          <Text style={[theme.typography.bodySmall, { color: healthTheme.textMuted }]}>
            Test: {test.name}
          </Text>
        </View>
        <View style={styles.row}>
          <View style={styles.iconBtn}>
            <Glass variant="health" intensity="medium" radius={999} style={styles.actionCircle}>
              <AppIcon name="messages" size={18} color={healthTheme.navy} />
            </Glass>
            <Text style={[theme.typography.caption, { color: healthTheme.textMuted }]}>Call</Text>
          </View>
          <View style={styles.iconBtn}>
            <Glass variant="health" intensity="medium" radius={999} style={styles.actionCircle}>
              <AppIcon name="location" size={18} color={healthTheme.navy} />
            </Glass>
            <Text style={[theme.typography.caption, { color: healthTheme.textMuted }]}>Map</Text>
          </View>
        </View>
      </Glass>

      <Button
        title="Book appointment"
        variant="health"
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
    </HealthScreenShell>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 10 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  row: { flexDirection: 'row', gap: 20, marginTop: 6 },
  iconBtn: { alignItems: 'center', gap: 4 },
  actionCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
