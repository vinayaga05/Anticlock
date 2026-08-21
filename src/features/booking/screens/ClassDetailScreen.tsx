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
import { fitnessClasses } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';
import { ServiceMode } from '@/shared/types';

export function ClassDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
  const item =
    fitnessClasses.find(c => c.id === route.params.classId) ?? fitnessClasses[0];
  const [mode, setMode] = useState<ServiceMode>('center');

  return (
    <ScreenContainer scrollable padded={false} contentStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <AppHeader />
        <LocationBar />
        <ModeTabs value={mode} onChange={setMode} />
      </View>

      <View style={styles.hero}>
        <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
        <View style={styles.heroOverlay}>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle}>
              {item.title} Coach: {item.coach}
            </Text>
            <Text style={styles.heroSub}>{item.schedule}</Text>
          </View>
          <Button
            title="Book Now"
            variant="success"
            style={{ paddingVertical: 8, minHeight: 36 }}
            onPress={() =>
              navigation.navigate('Schedule', {
                kind: 'fitness',
                id: item.id,
                title: item.title,
                fee: item.fee,
              })
            }
          />
        </View>
      </View>

      <View style={styles.stats}>
        <Stat value={`${item.durationMins} mins`} label="DURATION" />
        <Stat value={item.level} label="LEVEL" />
        <Stat value={item.type} label="TYPE" />
      </View>

      <View style={styles.body}>
        <Text style={styles.h2}>About this class</Text>
        <Text style={styles.p}>{item.about}</Text>
        <Text style={styles.h2}>What you need for this class</Text>
        {item.needs.map(need => (
          <Text key={need} style={styles.p}>
            • {need}
          </Text>
        ))}
        <Text style={styles.h2}>Routine</Text>
        {item.routine.map(step => (
          <View key={step.label} style={styles.routineRow}>
            <Text style={styles.p}>{step.label}</Text>
            <Text style={[styles.p, { fontWeight: '700' }]}>{step.mins} Mins</Text>
          </View>
        ))}

        <View style={[styles.provider, { borderColor: theme.colors.primary }]}>
          <Text style={{ color: theme.colors.navy, fontWeight: '700' }}>
            Coach - {item.coach.toUpperCase()} - {item.gym}
          </Text>
          <Text style={{ color: '#555' }}>{item.location}</Text>
          <View style={styles.row}>
            <View style={styles.iconBtn}>
              <CallIcon color={theme.colors.navy} />
              <Text style={{ fontSize: 12, color: theme.colors.navy }}>call</Text>
            </View>
            <View style={styles.iconBtn}>
              <LocationIcon color={theme.colors.navy} />
              <Text style={{ fontSize: 12, color: theme.colors.navy }}>Location</Text>
            </View>
          </View>
          <Text style={{ color: '#333', fontWeight: '700' }}>I Can Speak</Text>
          <Text style={{ color: '#555' }}>{item.languages.join(', ')}</Text>
        </View>

        <Button
          title="Book Now"
          onPress={() =>
            navigation.navigate('Schedule', {
              kind: 'fitness',
              id: item.id,
              title: item.title,
              fee: item.fee,
            })
          }
        />
      </View>
    </ScreenContainer>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220, marginTop: 8 },
  heroImage: { ...StyleSheet.absoluteFill },
  heroOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 8,
  },
  heroMeta: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 10,
    padding: 10,
  },
  heroTitle: { color: '#fff', fontWeight: '700' },
  heroSub: { color: '#ddd', marginTop: 4, fontSize: 12 },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#ccc',
  },
  statValue: { fontWeight: '700', color: '#111' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  body: {
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  h2: { fontWeight: '700', color: '#111', marginTop: 8, fontSize: 16 },
  p: { color: '#333', lineHeight: 20 },
  routineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  provider: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginTop: 8,
  },
  row: { flexDirection: 'row', gap: 16 },
  iconBtn: { alignItems: 'center', gap: 2 },
});
