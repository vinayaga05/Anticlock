import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
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
  const categories = getEcommerceCategories();
  const [categoryId, setCategoryId] = useState<string | null>(
    route.params?.categoryId ?? null,
  );
  const [query, setQuery] = useState(route.params?.q ?? '');

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
  } = useProductsQuery(categoryId ?? undefined);

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

    const apiProducts = apiData?.products ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return apiProducts.map(mapApiProductToCard);
    return apiProducts
      .filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q),
      )
      .map(mapApiProductToCard);
  }, [categoryId, query, apiData, isApiEnabled]);

  const selectedName =
    categories.find(c => c.id === categoryId)?.name ?? 'All products';

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Shop" />
      <SearchBar
        placeholder="Search products"
        value={query}
        onChangeText={setQuery}
      />

      <Card
        tint={softFill(theme.colors.ecommerce, 0.12)}
        style={styles.cartCard}
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

      <View style={styles.catGrid}>
        {categories.map(c => {
          const active = categoryId === c.id;
          return (
            <View key={c.id} style={styles.catCell}>
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
                <Image
                  source={shopCategoryImages[c.id]}
                  style={styles.categoryImage}
                  resizeMode="cover"
                  accessible
                  accessibilityLabel={`${c.name} product category image`}
                />
                <Text
                  style={[
                    theme.typography.caption,
                    {
                      color: theme.colors.textPrimary,
                      fontWeight: '600',
                      textAlign: 'center',
                    },
                  ]}
                  numberOfLines={2}
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

      <SectionHeader
        title={selectedName}
        subtitle={`${products.length} items`}
      />

      {isLoading && isApiEnabled ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : error && isApiEnabled ? (
        <EmptyState
          icon="alert-circle"
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
  cartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    width: '33.333%',
    padding: 6,
    position: 'relative',
  },
  catTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 118,
    borderWidth: StyleSheet.hairlineWidth,
  },
  categoryImage: {
    width: 62,
    height: 62,
    borderRadius: 16,
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
