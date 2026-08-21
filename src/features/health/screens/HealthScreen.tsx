import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  fitnessTracking,
  liveTracking,
  reportTiles,
} from '@/shared/data/mocks';

export function HealthScreen() {
  const theme = useTheme();

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <Text style={[styles.heading, { color: theme.colors.textPrimary }]}>Reports</Text>
      <View style={styles.grid}>
        {reportTiles.map(tile => (
          <View
            key={tile.id}
            style={[styles.reportCard, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.reportTitle, { color: theme.colors.navy }]}>{tile.title}</Text>
            {tile.items.map(item => (
              <Text key={item} style={{ color: theme.colors.textSecondary, fontSize: 11 }}>
                {item}
              </Text>
            ))}
          </View>
        ))}
      </View>

      <View style={[styles.trackBar, { backgroundColor: theme.colors.accent }]}>
        <Text style={styles.trackTitle}>Live Tracking</Text>
        <View style={styles.trackRow}>
          {liveTracking.map(item => (
            <View key={item.id} style={styles.trackItem}>
              <View style={styles.circle}>
                <Text>{item.icon}</Text>
              </View>
              <Text style={styles.trackLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.trackBar, { backgroundColor: theme.colors.accent }]}>
        <Text style={styles.trackTitle}>Fitness Tracking</Text>
        <View style={styles.trackRow}>
          {fitnessTracking.slice(0, 5).map(item => (
            <View key={item.id} style={styles.trackItem}>
              <View style={styles.circle}>
                <Text>{item.icon}</Text>
              </View>
              <Text style={styles.trackLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.trackRow, { marginTop: 10 }]}>
          {fitnessTracking.slice(5).map(item => (
            <View key={item.id} style={styles.trackItem}>
              <View style={styles.circle}>
                <Text>{item.icon}</Text>
              </View>
              <Text style={styles.trackLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reportCard: {
    width: '31.5%',
    borderRadius: 12,
    padding: 10,
    gap: 4,
    minHeight: 96,
  },
  reportTitle: { fontWeight: '700', fontSize: 12, marginBottom: 4 },
  trackBar: {
    borderRadius: 16,
    padding: 14,
  },
  trackTitle: {
    color: '#fff',
    fontWeight: '700',
    marginBottom: 12,
  },
  trackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackItem: { alignItems: 'center', width: '18%' },
  circle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 6,
    textAlign: 'center',
  },
});
