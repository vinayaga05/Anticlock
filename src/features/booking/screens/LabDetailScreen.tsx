import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { LocationBar } from '@/shared/components/LocationBar';
import { ModeTabs } from '@/shared/components/ModeTabs';
import { Button } from '@/shared/components/Button';
import { CallIcon, LocationIcon } from '@/shared/components/Icons';
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
    <ScreenContainer scrollable>
      <AppHeader />
      <LocationBar />
      <ModeTabs value={mode} onChange={setMode} />

      <View style={styles.hero}>
        <View style={[styles.left, { backgroundColor: '#fff' }]}>
          <Image source={{ uri: lab.imageUrl }} style={styles.logo} />
          <Text style={{ color: theme.colors.navy, fontWeight: '700' }}>{lab.name}</Text>
          <Text style={{ color: '#666', fontSize: 12 }}>Tests you can trust</Text>
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 11 }}>
              {lab.experienceYears} Years
            </Text>
          </View>
        </View>
        <View style={[styles.right, { backgroundColor: theme.colors.primary }]}>
          <Text style={{ fontSize: 28 }}>🏅</Text>
          <Text style={{ color: '#fff', fontWeight: '700' }}>TSMC 18193</Text>
          <Text style={{ color: '#fff' }}>Kandhavel</Text>
          <Text style={{ color: '#dff' }}>General Manager</Text>
        </View>
      </View>
      <View style={[styles.next, { backgroundColor: theme.colors.green }]}>
        <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
          Next Available AT Monday 5pm-10pm
        </Text>
      </View>

      <View style={[styles.card, { borderColor: theme.colors.navy }]}>
        <Text style={{ color: theme.colors.navy, fontWeight: '700', fontSize: 15 }}>
          {lab.name.toUpperCase()}
        </Text>
        <Text style={{ color: '#444' }}>{lab.location}</Text>
        <Text style={{ color: '#444' }}>Test: {test.name}</Text>
        <View style={styles.row}>
          <View style={styles.iconBtn}>
            <CallIcon color={theme.colors.navy} />
            <Text style={{ color: theme.colors.navy, fontSize: 12 }}>call</Text>
          </View>
          <View style={styles.iconBtn}>
            <LocationIcon color={theme.colors.navy} />
            <Text style={{ color: theme.colors.navy, fontSize: 12 }}>Location</Text>
          </View>
        </View>
        <Text style={{ color: '#333', fontWeight: '700' }}>I Can Speak</Text>
        <Text style={{ color: '#555' }}>Tamil, English, Telugu, Malayalam</Text>
      </View>

      <Button
        title="Book Now"
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
  hero: { flexDirection: 'row', gap: 8 },
  left: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  right: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  logo: { width: 48, height: 48, borderRadius: 8 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  next: {
    borderRadius: 10,
    padding: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  row: { flexDirection: 'row', gap: 16, marginVertical: 6 },
  iconBtn: { alignItems: 'center', gap: 2 },
});
