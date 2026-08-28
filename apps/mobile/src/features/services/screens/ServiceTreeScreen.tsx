import React, { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { Glass } from '@/shared/components/Glass';
import { SoftIllustration } from '@/shared/components/illustrations/SoftIllustration';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getCategoriesByTree,
  getTree,
  ServiceTreeId,
} from '@/shared/data/services';
import { ServiceCategoryGrid } from '@/features/services/components/ServiceCategoryGrid';
import { RootStackParamList } from '@/shared/navigation/types';
import { healthTheme } from '@/shared/theme/healthTheme';

export function ServiceTreeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceTree'>>();
  const treeId = route.params.treeId as ServiceTreeId;
  const tree = getTree(treeId);
  const categories = getCategoriesByTree(treeId);
  const isHealth = treeId === 'health';

  useLayoutEffect(() => {
    if (tree) navigation.setOptions({ title: tree.name });
  }, [navigation, tree]);

  if (!tree) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Tree not found" />
      </ScreenContainer>
    );
  }

  const content = (
    <>
      {isHealth ? (
        <Glass variant="health" intensity="heavy" radius={healthTheme.radius} elevated style={styles.healthHero}>
          <Text style={[theme.typography.title, { color: healthTheme.navy, fontWeight: '800' }]}>
            Your health, made simpler.
          </Text>
          <Text style={[theme.typography.body, { color: healthTheme.textMuted }]}>
            Book doctors, labs, and diagnostics with a calm clinical experience.
          </Text>
          <SoftIllustration variant="hero" accent={tree.accent} width={180} height={72} />
        </Glass>
      ) : (
        <View
          style={[
            styles.hero,
            {
              backgroundColor: `${tree.accent}22`,
              borderColor: `${tree.accent}38`,
              borderRadius: theme.radius['2xl'],
            },
          ]}>
          <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
            {tree.description}
          </Text>
          <SoftIllustration variant="hero" accent={tree.accent} width={180} height={88} />
        </View>
      )}

      <SearchBar placeholder={`Search ${tree.name.toLowerCase()} services`} />
      <SectionHeader title={`Explore ${tree.name}`} />
      <ServiceCategoryGrid categories={categories} treeId={tree.id} compact={!isHealth} />
    </>
  );

  if (isHealth) {
    return (
      <HealthScreenShell scrollable tabAware={false}>
        {content}
      </HealthScreenShell>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      {content}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
    overflow: 'hidden',
  },
  healthHero: {
    padding: 20,
    gap: 10,
    overflow: 'hidden',
  },
});
