import React, { useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
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
import { softFill } from '@/shared/theme/colors';

export function ServiceTreeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceTree'>>();
  const treeId = route.params.treeId as ServiceTreeId;
  const tree = getTree(treeId);
  const categories = getCategoriesByTree(treeId);

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

  return (
    <ScreenContainer scrollable tabAware={false}>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: softFill(tree.accent, 0.14),
            borderColor: softFill(tree.accent, 0.22),
            borderRadius: theme.radius['2xl'],
          },
        ]}>
        <Text style={[theme.typography.title, { color: theme.colors.textPrimary }]}>
          {tree.name === 'Health'
            ? 'Your health, made simpler.'
            : tree.description}
        </Text>
        <SoftIllustration variant="hero" accent={tree.accent} width={180} height={88} />
        <Text style={[theme.typography.caption, { color: tree.accent, fontWeight: '700' }]}>
          {tree.serviceCount} services to explore
        </Text>
      </View>

      <SearchBar placeholder={`Search ${tree.name.toLowerCase()} services`} />

      <SectionHeader title={`Explore ${tree.name}`} />
      <ServiceCategoryGrid categories={categories} treeId={tree.id} compact />
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
});
