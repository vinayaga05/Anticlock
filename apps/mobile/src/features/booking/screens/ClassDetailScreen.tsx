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
    <ScreenContainer scrollable padded={false} tabAware={false} contentStyle={{ paddingBottom: 32 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <LocationBar />
        <ModeTabs value={mode} onChange={setMode} />
      </View>

      <View style={[styles.hero, { marginTop: 8 }]}>
        <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
        <View style={styles.heroOverlay}>
          <View style={[styles.heroMeta, { borderRadius: theme.radius.md }]}>
            <Text style={[theme.typography.body, { color: '#fff', fontWeight: '700' }]}>
              {item.title}
            </Text>
            <Text style={[theme.typography.caption, { color: 'rgba(255,255,255,0.85)', marginTop: 4 }]}>
              {item.coach} · {item.schedule}
            </Text>
          </View>
          <Button
            title="Book"
            icon="calendar"
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

      <View
        style={[
          styles.stats,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}>
        <Stat value={`${item.durationMins} mins`} label="DURATION" />
        <Stat value={item.level} label="LEVEL" />
        <Stat value={item.type} label="TYPE" />
      </View>

      <View style={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            About this class
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 8 }]}>
            {item.about}
          </Text>
        </Card>

        <Card>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            What you need
          </Text>
          {item.needs.map(need => (
            <Text
              key={need}
              style={[theme.typography.body, { color: theme.colors.textSecondary, marginTop: 6 }]}>
              • {need}
            </Text>
          ))}
        </Card>

        <Card>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Routine
          </Text>
          {item.routine.map(step => (
            <View key={step.label} style={styles.routineRow}>
              <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
                {step.label}
              </Text>
              <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
                {step.mins} mins
              </Text>
            </View>
          ))}
        </Card>

        <Card style={{ gap: 8 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Coach {item.coach}
          </Text>
          <View style={styles.meta}>
            <AppIcon name="location" size={16} color={theme.colors.primary} />
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {item.location}
            </Text>
          </View>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Speaks {item.languages.join(', ')}
          </Text>
        </Card>

        <Button
          title="Book appointment"
          icon="calendar"
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
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
        {value}
      </Text>
      <Text style={[theme.typography.label, { color: theme.colors.textTertiary, marginTop: 2 }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 220 },
  heroImage: { ...StyleSheet.absoluteFill },
  heroOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.28)',
    gap: 10,
  },
  heroMeta: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 12,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  routineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
