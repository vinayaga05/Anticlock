import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { IconBadge } from '@/shared/components/IconBadge';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getEcommerceCategories,
  getProductsForCategory,
  marketplaceProducts,
} from '@/shared/data/services';
import { ProductCard } from '@/features/services/components/ProductCard';
import { useCartStore } from '@/shared/store/cartStore';
import { AppIcon } from '@/shared/components/AppIcon';
import { softFill, treeColors } from '@/shared/theme/colors';
import type { MainTabParamList } from '@/shared/navigation/types';
import { useProductsQuery, isApiEnabled } from '@/shared/api';
import { useProductCategoriesQuery } from '@/shared/api/shopHooks';
import { useTabBarBottomInset } from '@/shared/navigation/tabBarInset';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import {
  getPublishedShopCategories,
  getShopCategoryArtworkKey,
  getShopCategoryColumns,
  resolveShopCategoryFilter,
  type ShopCategory,
} from './shopLayout';

const shopCategoryImages: Record<string, ImageSourcePropType> = {
  'ecom.sports': require('../../../shared/assets/categories/shop-sports-3d.png'),
  'ecom.health': require('../../../shared/assets/categories/shop-health-3d.png'),
  'ecom.fitness': require('../../../shared/assets/categories/shop-fitness-3d.png'),
  'ecom.beauty': require('../../../shared/assets/categories/shop-beauty-3d.png'),
  'ecom.garments': require('../../../shared/assets/categories/shop-garments-3d.png'),
  'ecom.property': require('../../../shared/assets/categories/shop-property-3d.png'),
  'ecom.kitchen': require('../../../shared/assets/categories/shop-kitchen-3d.png'),
  'ecom.games': require('../../../shared/assets/categories/shop-games-3d.png'),
  'ecom.electronics': require('../../../shared/assets/categories/shop-electronics-3d.png'),
};

export function ShopScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'Shop'>>();
  const { count } = useCartStore();
  const { active } = useActiveProfile();
  const businessProfile =
    active &&
    identityProfileType(active) === 'business' &&
    active.role !== 'analyst'
      ? active
      : null;
  const { width, fontScale } = useWindowDimensions();
  const bottomInset = useTabBarBottomInset();
  const categoryColumns = getShopCategoryColumns(
    width - theme.spacing.lg * 2,
    fontScale,
  );
  const categoryQuery = useProductCategoriesQuery({ enabled: isApiEnabled });
  const categories = useMemo<ShopCategory[]>(
    () =>
      isApiEnabled
        ? getPublishedShopCategories(categoryQuery.data ?? [])
        : getEcommerceCategories().map(category => ({
            id: category.id,
            name: category.name,
            artworkKey: getShopCategoryArtworkKey(category.id),
          })),
    [categoryQuery.data],
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    route.params?.categoryId ?? null,
  );
  const [query, setQuery] = useState(route.params?.q ?? '');
  const categoryFilter = resolveShopCategoryFilter(
    categoryId,
    categories,
    categoryQuery.isLoading,
  );
  const canLoadProducts =
    isApiEnabled &&
    categoryFilter.status !== 'loading' &&
    categoryFilter.status !== 'unavailable';

  useEffect(() => {
    if (route.params?.q !== undefined) setQuery(route.params.q);
    if (route.params?.categoryId !== undefined) {
      setCategoryId(route.params.categoryId);
    }
  }, [route.params?.q, route.params?.categoryId]);

  const {
    data: apiData,
    isLoading,
    error,
  } = useProductsQuery(isApiEnabled ? categoryFilter.categoryId : undefined, {
    enabled: canLoadProducts,
  });

  const products = useMemo(() => {
    if (!isApiEnabled) {
      const base = categoryId
        ? getProductsForCategory(categoryId)
        : marketplaceProducts.filter(product => !product.isProperty);
      const q = query.trim().toLowerCase();
      if (!q) return base;
      return base.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.seller?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      );
    }

    const apiProducts = canLoadProducts ? apiData?.products ?? [] : [];
    const q = query.trim().toLowerCase();
    if (!q) return apiProducts.map(mapApiProductToCard);
    return apiProducts
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      )
      .map(mapApiProductToCard);
  }, [categoryId, query, apiData, canLoadProducts]);

  const selectedName =
    categories.find(
      c => c.id === (isApiEnabled ? categoryFilter.categoryId : categoryId),
    )?.name ?? (categoryId ? 'Selected category' : 'All products');

  return (
    <ScreenContainer padded={false} contentStyle={styles.screenContent}>
      <View
        style={{
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.sm,
        }}
      >
        <AppHeader title="Shop" />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: bottomInset,
          gap: theme.spacing.lg,
        }}
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SearchBar
          placeholder="Search products"
          value={query}
          onChangeText={setQuery}
        />

        {businessProfile ? (
          <Card elevated={false} style={styles.sellerCard}>
            <View style={styles.sellerInfo}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Sell as your business
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  theme.typography.section,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {businessProfile.name}
              </Text>
            </View>
            <Button
              title="Add product"
              icon="plus"
              accessibilityLabel={`Add product for ${businessProfile.name}`}
              onPress={() =>
                navigation.navigate('CreateExploreProduct', {
                  publisherProfileId: businessProfile.id,
                  publisherProfileType: 'business',
                })
              }
              style={styles.checkoutBtn}
            />
          </Card>
        ) : null}

        <Card
          tint={theme.colors.surface}
          elevated={false}
          style={{
            ...styles.cartCard,
            borderColor: softFill(theme.colors.ecommerce, 0.28),
          }}
        >
          <View style={styles.cartLeft}>
            <IconBadge name="cart" color={theme.colors.ecommerce} size="md" />
            <View style={{ flexShrink: 1 }}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Your cart
              </Text>
              <Text
                style={[
                  theme.typography.section,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {count} items
              </Text>
            </View>
          </View>
          <Button
            title="Checkout"
            icon="credit-card"
            onPress={() => navigation.navigate('Checkout')}
            style={styles.checkoutBtn}
          />
        </Card>

        <SectionHeader title="Categories" subtitle="Browse by type" />

        {isApiEnabled && categoryQuery.isLoading ? (
          <View style={styles.categoryState}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text
              style={[
                theme.typography.caption,
                { color: theme.colors.textSecondary },
              ]}
            >
              Loading product categories…
            </Text>
          </View>
        ) : isApiEnabled && categoryQuery.error ? (
          <EmptyState
            icon="alert"
            title="Could not load categories"
            description="Please retry to browse product categories."
            actionLabel="Retry categories"
            onAction={() => {
              categoryQuery.refetch();
            }}
          />
        ) : categories.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="No categories available"
            description="Published categories will appear here. You can still browse all products below."
          />
        ) : (
          <View style={styles.catGrid}>
            {categories.map(c => {
              const active =
                (isApiEnabled ? categoryFilter.categoryId : categoryId) ===
                c.id;
              const source =
                (c.artworkKey ? shopCategoryImages[c.artworkKey] : undefined) ??
                (c.imageUrl ? { uri: c.imageUrl } : undefined);
              return (
                <View
                  key={c.id}
                  style={[
                    styles.catCell,
                    { width: `${100 / categoryColumns}%` },
                  ]}
                >
                  <PressableScale
                    accessibilityLabel={c.name}
                    onPress={() => setCategoryId(c.id)}
                    style={[
                      styles.catTile,
                      {
                        backgroundColor: active
                          ? softFill(theme.colors.ecommerce, 0.18)
                          : theme.colors.surface,
                        borderColor: active
                          ? theme.colors.ecommerce
                          : theme.colors.borderSoft,
                        borderRadius: theme.radius.lg,
                      },
                    ]}
                  >
                    {source ? (
                      <Image
                        source={source}
                        style={styles.categoryImage}
                        resizeMode="cover"
                        accessible
                        accessibilityLabel={`${c.name} product category image`}
                      />
                    ) : (
                      <View
                        style={[
                          styles.categoryImage,
                          styles.categoryFallback,
                          { backgroundColor: theme.colors.primarySoft },
                        ]}
                      >
                        <AppIcon
                          name="shopping-bag"
                          size={28}
                          color={theme.colors.primary}
                        />
                      </View>
                    )}
                    <Text
                      style={[
                        theme.typography.caption,
                        styles.categoryLabel,
                        {
                          color: theme.colors.textPrimary,
                          fontWeight: '600',
                          textAlign: 'center',
                        },
                      ]}
                      numberOfLines={3}
                    >
                      {c.name}
                    </Text>
                  </PressableScale>
                  {active ? (
                    <PressableScale
                      accessibilityLabel={`Clear ${c.name} filter`}
                      onPress={() => setCategoryId(null)}
                      style={[
                        styles.clearFilter,
                        {
                          backgroundColor: treeColors.ecommerce.deep,
                          borderColor: treeColors.ecommerce.deep,
                          borderRadius: theme.radius.pill,
                          ...(theme.shadows.soft as object),
                        },
                      ]}
                    >
                      <AppIcon name="x" size={11} color="#FFFFFF" />
                    </PressableScale>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}

        <SectionHeader
          title={selectedName}
          subtitle={`${products.length} items`}
        />

        {isApiEnabled && categoryFilter.status === 'loading' ? (
          <View style={styles.categoryState}>
            <Text
              style={[
                theme.typography.bodySmall,
                { color: theme.colors.textSecondary },
              ]}
            >
              Finding the selected category…
            </Text>
          </View>
        ) : isApiEnabled && categoryFilter.status === 'unavailable' ? (
          <EmptyState
            icon="shopping-bag"
            title="Category unavailable"
            description="This category is no longer available or cannot be matched uniquely. Choose a category above or browse all products."
            actionLabel="Show all products"
            onAction={() => setCategoryId(null)}
          />
        ) : isLoading && isApiEnabled ? (
          <View style={{ paddingVertical: 32, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        ) : error && isApiEnabled ? (
          <EmptyState
            icon="alert"
            title="Error loading products"
            description={(error as Error).message}
          />
        ) : products.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="No products"
            description="Try another category."
            illustration="empty"
          />
        ) : (
          <View style={styles.productGrid}>
            {products.map(product => (
              <View key={product.id} style={styles.productCell}>
                <ProductCard
                  product={product}
                  onPress={() =>
                    navigation.navigate('ProductDetail', {
                      productId: product.id,
                    })
                  }
                />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

function mapApiProductToCard(apiProduct: any): any {
  return {
    id: apiProduct.id,
    name: apiProduct.name,
    description: apiProduct.description || '',
    price: Math.round(apiProduct.price / 100),
    rating: 4.5,
    seller: 'Knock Shop',
    imageUrl: apiProduct.images[0]?.url || 'https://placehold.co/400x400/png',
    isProperty: false,
  };
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sellerInfo: {
    flex: 1,
    minWidth: 0,
  },
  cartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  checkoutBtn: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  catGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  catCell: {
    padding: 6,
    position: 'relative',
  },
  catTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 136,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
  },
  categoryFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  categoryLabel: {
    alignSelf: 'stretch',
    minHeight: 42,
    fontSize: 11,
    lineHeight: 14,
  },
  clearFilter: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 1,
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  productCell: {
    width: '50%',
    padding: 6,
  },
});
