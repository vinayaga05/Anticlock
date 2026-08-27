import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Card } from '@/shared/components/Card';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { IconBadge } from '@/shared/components/IconBadge';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  fitnessTracking,
  healthMetrics,
  liveTracking,
  reportTiles,
} from '@/shared/data/mocks';
import { getCategoriesByTree } from '@/shared/data/services';
import { ServiceCategoryGrid } from '@/features/services/components/ServiceCategoryGrid';
import { softFill } from '@/shared/theme/colors';

type HealthTab = 'my' | 'services';

const METRIC_COLORS = ['#F97066', '#818CF8', '#84CC16', '#38BDF8', '#F59E0B', '#F472B6'];

export function HealthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const [tab, setTab] = useState<HealthTab>('my');
  const healthCategories = getCategoriesByTree('health');

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Health" />
      <View style={styles.tabs}>
        {(['my', 'services'] as HealthTab[]).map(key => {
          const active = tab === key;
          return (
            <Card
              key={key}
              onPress={() => setTab(key)}
              elevated={active}
              tint={active ? theme.colors.primarySoft : theme.colors.surface}
              style={{ flex: 1 }}>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {
                    color: active ? theme.colors.primaryMuted : theme.colors.textSecondary,
                    fontWeight: '700',
                    textAlign: 'center',
                  },
                ]}>
                {key === 'my' ? 'My Health' : 'Health Services'}
              </Text>
            </Card>
          );
        })}
      </View>

      {tab === 'services' ? (
        <>
          <SectionHeader
            title="Book care"
            subtitle="Clinicians, labs, and more near you"
          />
          <ServiceCategoryGrid categories={healthCategories} treeId="health" />
          <Card
            onPress={() => navigation.navigate('ServiceTree', { treeId: 'health' })}
            tint={softFill(theme.colors.health, 0.12)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBadge name="health" color={theme.colors.health} size="sm" />
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, flex: 1, fontWeight: '600' }]}>
              Open full Health tree
            </Text>
            <AppIcon name="chevron-right" size={16} color={theme.colors.textTertiary} />
          </Card>
        </>
      ) : (
        <>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Your daily overview
          </Text>

          <View style={styles.metricsGrid}>
            {healthMetrics.map((metric, i) => {
              const color = METRIC_COLORS[i % METRIC_COLORS.length];
              return (
                <Card
                  key={metric.id}
                  style={{ width: '48%', gap: 10 }}
                  tint={softFill(color, 0.1)}
                  elevated>
                  <IconBadge name={metric.icon as IconName} color={color} size="sm" />
                  <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                    {metric.label}
                  </Text>
                  <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
                    {metric.value}
                    <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
                      {' '}
                      {metric.unit}
                    </Text>
                  </Text>
                </Card>
              );
            })}
          </View>

          <SectionHeader title="Live tracking" />
          <Card>
            <View style={styles.trackRow}>
              {liveTracking.map((item, i) => {
                const color = METRIC_COLORS[i % METRIC_COLORS.length];
                return (
                  <View key={item.id} style={styles.trackItem}>
                    <IconBadge name={item.icon as IconName} color={color} size="sm" shape="circle" />
                    <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        theme.typography.bodySmall,
                        { color: theme.colors.textPrimary, fontWeight: '700' },
                      ]}>
                      {item.value}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <SectionHeader title="Fitness tracking" />
          <View style={styles.fitGrid}>
            {fitnessTracking.map((item, i) => {
              const color = METRIC_COLORS[i % METRIC_COLORS.length];
              return (
                <Card key={item.id} style={styles.fitCard} padded={false} tint={softFill(color, 0.12)}>
                  <View style={{ padding: 12, alignItems: 'center', gap: 8 }}>
                    <AppIcon name={item.icon as IconName} size={20} color={color} />
                    <Text
                      style={[
                        theme.typography.caption,
                        { color: theme.colors.textSecondary, textAlign: 'center' },
                      ]}
                      numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                </Card>
              );
            })}
          </View>

          <SectionHeader title="Reports" />
          <View style={styles.reportGrid}>
            {reportTiles.map((tile, i) => {
              const color = METRIC_COLORS[i % METRIC_COLORS.length];
              return (
                <Card key={tile.id} style={{ width: '31.5%', gap: 8 }} tint={softFill(color, 0.1)} padded>
                  <AppIcon
                    name={(tile.icon as IconName) || 'activity'}
                    size={18}
                    color={color}
                  />
                  <Text
                    style={[
                      theme.typography.bodySmall,
                      { color: theme.colors.textPrimary, fontWeight: '700' },
                    ]}>
                    {tile.title}
                  </Text>
                  <Text
                    style={[theme.typography.caption, { color: theme.colors.textTertiary }]}
                    numberOfLines={2}>
                    {tile.items[0]}
                  </Text>
                </Card>
              );
            })}
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 10 },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trackRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trackItem: { alignItems: 'center', width: '18%', gap: 6 },
  fitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fitCard: {
    width: '18.5%',
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
