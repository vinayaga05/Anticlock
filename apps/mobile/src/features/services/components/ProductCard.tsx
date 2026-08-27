import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { MarketplaceProduct } from '@/shared/data/services';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';

export function ProductCard({
  product,
  onPress,
}: {
  product: MarketplaceProduct;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} padded={false} style={styles.card} elevated>
      <Image source={{ uri: product.imageUrl }} style={styles.image} />
      <View style={styles.body}>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.meta}>
          <AppIcon name="star" size={12} color={theme.colors.warning} />
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {product.rating}
          </Text>
        </View>
        <View style={styles.priceRow}>
          <Text
            style={[
              theme.typography.body,
              { color: theme.colors.primary, fontWeight: '700', flex: 1 },
            ]}
            numberOfLines={1}>
            {product.isProperty
              ? `Rs ${(product.price / 100000).toFixed(1)}L`
              : `Rs ${product.price}`}
          </Text>
          <AppIcon name="heart" size={16} color={theme.colors.like} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: '#EEE',
  },
  body: {
    padding: 12,
    gap: 6,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
