import React, { useLayoutEffect, useMemo } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { HealthScreenShell } from '@/shared/components/HealthScreenShell';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { SearchBar } from '@/shared/components/SearchBar';
import { EmptyState } from '@/shared/components/EmptyState';
import { useCmsBannersQuery } from '@/shared/api/hooks';
import { SoftIllustration } from '@/shared/components/illustrations/SoftIllustration';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { useTheme } from '@/shared/hooks/useTheme';
import { useSearchScrollRestoration } from '@/shared/hooks/useSearchScrollRestoration';
import {
  getCategoriesByTree,
  getTree,
  ServiceTreeId,
} from '@/shared/data/services';
import { ServiceCategoryGrid } from '@/features/services/components/ServiceCategoryGrid';
import { RootStackParamList } from '@/shared/navigation/types';

export function ServiceTreeScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceTree'>>();
  const treeId = route.params.treeId as ServiceTreeId;
  const tree = getTree(treeId);
  const categories = getCategoriesByTree(treeId);
  const { searchQuery, onChangeText, scrollRef, onScroll } =
    useSearchScrollRestoration();
  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter(category =>
      [category.name, category.description].some(value =>
        value.toLowerCase().includes(query),
      ),
    );
  }, [categories, searchQuery]);
  const isHealth = treeId === 'health';
  const { data: cmsBanners = [] } = useCmsBannersQuery();
  const healthAd = cmsBanners[0];

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
        healthAd ? (
          <ImageBackground
            source={{ uri: healthAd.imageUrl! }}
            style={styles.healthAd}
            imageStyle={styles.healthAdImage}
            resizeMode="cover"
          >
            <View style={styles.healthAdShade} />
            <Text style={styles.healthAdTitle} numberOfLines={2}>
              {healthAd.title}
            </Text>
          </ImageBackground>
        ) : null
      ) : (
        <View
          style={[
            styles.hero,
            {
              backgroundColor: `${tree.accent}22`,
              borderColor: `${tree.accent}38`,
              borderRadius: theme.radius['2xl'],
            },
          ]}
        >
          <Text
            style={[
              theme.typography.title,
              { color: theme.colors.textPrimary },
            ]}
          >
            {tree.description}
          </Text>
          <SoftIllustration
            variant="hero"
            accent={tree.accent}
            width={180}
            height={88}
          />
        </View>
      )}

      <SearchBar
        placeholder={`Search ${tree.name.toLowerCase()} services`}
        value={searchQuery}
        onChangeText={onChangeText}
      />
      <SectionHeader
        title={
          searchQuery.trim()
            ? `Results in ${tree.name}`
            : `Explore ${tree.name}`
        }
      />
      {filteredCategories.length ? (
        <ServiceCategoryGrid
          categories={filteredCategories}
          treeId={tree.id}
          compact
        />
      ) : (
        <EmptyState
          icon="search"
          title="No services found"
          description={`No ${tree.name.toLowerCase()} services match “${searchQuery.trim()}”.`}
        />
      )}
    </>
  );

  if (isHealth) {
    return (
      <HealthScreenShell
        scrollable
        tabAware={false}
        scrollRef={scrollRef}
        onScroll={onScroll}
      >
        {content}
      </HealthScreenShell>
    );
  }

  return (
    <ScreenContainer
      scrollable
      tabAware={false}
      scrollRef={scrollRef}
      onScroll={onScroll}
    >
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
  healthAd: {
    height: 170,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  healthAdImage: {
    width: '100%',
    height: '100%',
  },
  healthAdShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  healthAdTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    padding: 16,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
