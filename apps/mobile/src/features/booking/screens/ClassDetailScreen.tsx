import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessClasses } from '@/shared/data/mocks';
import { RootStackParamList } from '@/shared/navigation/types';

export function ClassDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ClassDetail'>>();
  const item =
    fitnessClasses.find(c => c.id === route.params.classId) ?? fitnessClasses[0];

  return (
    <ScreenContainer scrollable padded={false} tabAware={false} contentStyle={{ paddingBottom: 32 }}>
      <View style={styles.hero}>
        <Image source={{ uri: item.imageUrl }} style={styles.heroImage} />
        <PressableScale
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          style={styles.backBtn}>
          <AppIcon name="chevron-left" size={22} color="#0F172A" />
        </PressableScale>
        <View style={styles.heroFooter}>
          <View style={styles.heroMeta}>
            <Text style={styles.heroTitle}>{item.title}</Text>
            <Text style={styles.heroSub}>
              Coach: {item.coach} · {item.schedule}
            </Text>
          </View>
          <PressableScale
            onPress={() =>
              navigation.navigate('Schedule', {
                kind: 'fitness',
                id: item.id,
                title: item.title,
                fee: item.fee,
              })
            }
            accessibilityLabel="Book now">
            <View style={styles.heroCta}>
              <Text style={styles.heroCtaText}>Book Now</Text>
            </View>
          </PressableScale>
        </View>
      </View>

      <View style={[styles.stats, { backgroundColor: theme.colors.surface }]}>
        <Stat value={`${item.durationMins} mins`} label="DURATION" />
        <View style={styles.statDivider} />
        <Stat value={item.level} label="LEVEL" />
        <View style={styles.statDivider} />
        <Stat value={item.type} label="TYPE" />
      </View>

      <View style={styles.content}>
        <Section title="About this class">
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>{item.about}</Text>
        </Section>

        <Section title="What you need for this class">
          {item.needs.map(need => (
            <View key={need} style={styles.bulletRow}>
              <View style={styles.bullet} />
              <Text style={[styles.body, { color: theme.colors.textSecondary, flex: 1 }]}>
                {need}
              </Text>
            </View>
          ))}
        </Section>

        <Section title="Routine">
          {item.routine.map(step => (
            <View key={step.label} style={styles.routineRow}>
              <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
                {step.label}
              </Text>
              <Text style={styles.routineMins}>{step.mins} Mins</Text>
            </View>
          ))}
        </Section>

        <View style={[styles.coachCard, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>
            Coach {item.coach}
          </Text>
          <View style={styles.metaRow}>
            <AppIcon name="location" size={16} color={theme.colors.primary} />
            <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
              {item.location}
            </Text>
          </View>
          <Text style={[styles.body, { color: theme.colors.textSecondary }]}>
            Speaks {item.languages.join(', ')}
          </Text>
        </View>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 280,
    backgroundColor: '#0F172A',
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  heroMeta: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 14,
    padding: 12,
    gap: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 12,
    fontWeight: '500',
  },
  heroCta: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  heroCtaText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  content: {
    padding: 16,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  routineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routineMins: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  coachCard: {
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
