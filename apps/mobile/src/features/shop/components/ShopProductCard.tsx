import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { MarketplaceProduct } from '@/shared/data/services';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';

export type ShopProductCardItem = Pick<MarketplaceProduct, 'id' | 'name' | 'price'> &
  Partial<Pick<MarketplaceProduct, 'imageUrl' | 'seller' | 'description' | 'categoryId'>> & {
    compareAtPrice?: number;
    inventory?: number;
    categoryName?: string;
    isTestProduct?: boolean;
  };

const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN', {
  maximumFractionDigits: 2,
})}`;

export function ShopProductCard({ product, onPress }: {
  product: ShopProductCardItem;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [product.imageUrl]);
  const hasPrice = Number.isFinite(product.price) && product.price >= 0;
  const compareAt = product.compareAtPrice;
  const hasDiscount = hasPrice && product.price > 0 && compareAt != null &&
    Number.isFinite(compareAt) && compareAt > product.price;
  const discount = hasDiscount ? Math.floor(((compareAt! - product.price) / compareAt!) * 100) : 0;
  const outOfStock = product.inventory === 0;
  const priceLabel = hasPrice ? rupees(product.price) : 'Price unavailable';

  return (
    <PressableScale
      accessibilityLabel={`${product.name}, ${priceLabel}${outOfStock ? ', out of stock' : ''}${product.isTestProduct ? ', test item' : ''}`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.borderSoft }]}
    >
      <View style={[styles.imageFrame, { backgroundColor: theme.colors.surfaceMuted }]}>
        {product.imageUrl && !imageFailed ? (
          <Image
            testID="shop-product-image"
            source={{ uri: product.imageUrl }}
            resizeMode="contain"
            resizeMethod="resize"
            style={styles.image}
            onError={() => setImageFailed(true)}
            accessibilityLabel={product.name}
          />
        ) : (
          <View testID="shop-product-image-fallback" style={styles.fallback}>
            <AppIcon name="shopping-bag" size={36} color={theme.colors.primary} />
            <Text style={[styles.fallbackLabel, { color: theme.colors.textSecondary }]}>Image unavailable</Text>
          </View>
        )}
        {product.isTestProduct ? (
          <View style={[styles.testBadge, { backgroundColor: theme.colors.surface }]}>
            <Text style={[styles.testLabel, { color: theme.colors.textSecondary }]}>TEST ITEM</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.details}>
        {product.categoryName ? (
          <Text style={[styles.category, { color: theme.colors.textTertiary }]} numberOfLines={1}>{product.categoryName}</Text>
        ) : null}
        <Text style={[styles.name, { color: theme.colors.textPrimary }]} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={[styles.price, { color: theme.colors.textPrimary }]}>{priceLabel}</Text>
          {hasDiscount ? <Text testID="shop-product-compare-price" style={[styles.comparePrice, { color: theme.colors.textTertiary }]}>{rupees(compareAt!)}</Text> : null}
        </View>
        {discount > 0 ? <Text testID="shop-product-discount" style={[styles.discount, { color: theme.colors.success }]}>{discount}% off</Text> : null}
        {product.inventory != null && Number.isFinite(product.inventory) ? (
          <Text style={[styles.stock, { color: outOfStock ? theme.colors.error : theme.colors.textSecondary }]}>
            {outOfStock ? 'Out of stock' : product.inventory > 0 ? 'In stock' : 'Stock unavailable'}
          </Text>
        ) : null}
        <View style={[styles.footer, { borderTopColor: theme.colors.borderSoft }]}>
          <Text style={[styles.viewLabel, { color: theme.colors.primary }]}>View details</Text>
          <AppIcon name="arrow-right" size={14} color={theme.colors.primary} />
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', minHeight: 44, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  imageFrame: { width: '100%', aspectRatio: 0.95, position: 'relative' },
  image: { width: '100%', height: '100%' },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  fallbackLabel: { fontSize: 11, textAlign: 'center' },
  testBadge: { position: 'absolute', top: 10, left: 10, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 4 },
  testLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 0.7 },
  details: { padding: 12, gap: 5 },
  category: { fontSize: 10, fontWeight: '500' },
  name: { fontSize: 13, lineHeight: 19, fontWeight: '600', minHeight: 38 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  comparePrice: { fontSize: 11, textDecorationLine: 'line-through' },
  discount: { fontSize: 11, fontWeight: '700' },
  stock: { fontSize: 10, lineHeight: 15 },
  footer: { marginTop: 5, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  viewLabel: { fontSize: 11, fontWeight: '700' },
});
