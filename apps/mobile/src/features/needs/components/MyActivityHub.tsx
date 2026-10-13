import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { fitnessTracking, liveTracking } from '@/shared/data/mocks';

type ActivityItem = {
  id: string;
  label: string;
  icon: IconName | string;
  value?: string;
};

const healthTracking: ActivityItem[] = [
  { id: 'sleep', label: 'Sleep', icon: 'sleep' },
  { id: 'dee', label: 'DEE', icon: 'activity' },
  { id: 'water', label: 'Water', icon: 'water' },
  { id: 'vitals', label: 'Vitals', icon: 'heart-pulse' },
  { id: 'body', label: 'Body', icon: 'weight' },
];

function ActivityTool({ item, tone = 'mint' }: { item: ActivityItem; tone?: 'mint' | 'rose' }) {
  const theme = useTheme();
  const isRose = tone === 'rose';
  const backgroundColor = isRose ? '#F9EDF2' : '#EAF8F4';
  const iconColor = isRose ? '#B04472' : theme.colors.primary;

  return (
    <PressableScale
      accessibilityLabel={`Track ${item.label}`}
      style={styles.tool}
    >
      <View style={[styles.icon, { backgroundColor }]}>
        <AppIcon name={item.icon} size={23} color={iconColor} strokeWidth={2} />
      </View>
      <Text
        numberOfLines={1}
        style={[theme.typography.caption, styles.toolLabel, { color: theme.colors.textPrimary }]}
      >
        {item.label}
      </Text>
      {item.value ? (
        <Text style={[theme.typography.caption, styles.value, { color: theme.colors.textSecondary }]}>
          {item.value}
        </Text>
      ) : null}
    </PressableScale>
  );
}

function ActivitySection({
  title,
  items,
  tone,
}: {
  title: string;
  items: ActivityItem[];
  tone: 'mint' | 'rose';
}) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { borderColor: theme.colors.borderSoft, backgroundColor: theme.colors.surface }]}>
      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>{title}</Text>
      <View style={styles.toolRow}>
        {items.map(item => <ActivityTool key={item.id} item={item} tone={tone} />)}
      </View>
    </View>
  );
}

/** Compact activity shortcuts displayed in the Needs tab. */
export function MyActivityHub() {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <View>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>My Activity</Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>Track movement, fitness, and wellness</Text>
        </View>
        <AppIcon name="activity" size={22} color={theme.colors.primary} />
      </View>
      <ActivitySection title="Live tracking" items={liveTracking} tone="mint" />
      <ActivitySection title="Fitness tracking" items={fitnessTracking.slice(0, 5)} tone="rose" />
      <ActivitySection title="Health tracking" items={healthTracking} tone="mint" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  section: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 14, gap: 12 },
  toolRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 },
  tool: { flex: 1, minWidth: 0, alignItems: 'center', gap: 5 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  toolLabel: { fontWeight: '700', textAlign: 'center' },
  value: { textAlign: 'center', fontSize: 10 },
});
