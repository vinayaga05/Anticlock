import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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
import { IconName } from '@/shared/components/AppIcon';
import { softFill } from '@/shared/theme/colors';

export function ShopScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { count } = useCartStore();
  const categories = getEcommerceCategories();
  const [categoryId, setCategoryId] = useState('all');

  const products = useMemo(() => {
    if (categoryId === 'all') {
      return marketplaceProducts.filter(p => !p.isProperty);
    }
    return getProductsForCategory(categoryId);
  }, [categoryId]);

  const selectedName =
    categoryId === 'all'
      ? 'All products'
      : categories.find(c => c.id === categoryId)?.name ?? 'Products';

  return (
    <ScreenContainer scrollable>
      <AppHeader title="Shop" />
      <SearchBar placeholder="Search products" />

      <Card tint={softFill(theme.colors.ecommerce, 0.12)} style={styles.cartCard}>
        <View style={styles.cartLeft}>
          <IconBadge name="cart" color={theme.colors.ecommerce} size="md" />
          <View style={{ flexShrink: 1 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
              Your cart
            </Text>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
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
        <View style={styles.catCell}>
          <PressableScale
            accessibilityLabel="All categories"
            onPress={() => setCategoryId('all')}
            style={[
              styles.catTile,
              {
                backgroundColor:
                  categoryId === 'all'
                    ? softFill(theme.colors.ecommerce, 0.18)
                    : theme.colors.surface,
                borderColor:
                  categoryId === 'all'
                    ? theme.colors.ecommerce
                    : theme.colors.borderSoft,
                borderRadius: theme.radius.lg,
              },
            ]}>
            <IconBadge name="shopping-bag" color={theme.colors.ecommerce} size="md" />
            <Text
              style={[
                theme.typography.caption,
                {
                  color: theme.colors.textPrimary,
                  fontWeight: '600',
                  textAlign: 'center',
                },
              ]}
              numberOfLines={2}>
              All
            </Text>
          </PressableScale>
        </View>

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
                ]}>
                <IconBadge
                  name={c.icon as IconName}
                  color={theme.colors.ecommerce}
                  size="md"
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
                  numberOfLines={2}>
                  {c.name}
                </Text>
              </PressableScale>
            </View>
          );
        })}
      </View>

      <SectionHeader title={selectedName} subtitle={`${products.length} items`} />

      {products.length === 0 ? (
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
                  navigation.navigate('ProductDetail', { productId: product.id })
                }
              />
            </View>
          ))}
        </View>
      )}
    </ScreenContainer>
  );
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
  },
  catTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
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
