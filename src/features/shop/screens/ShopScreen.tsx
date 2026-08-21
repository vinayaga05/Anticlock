import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { SearchBar } from '@/shared/components/SearchBar';
import { Button } from '@/shared/components/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { shopProducts } from '@/shared/data/mocks';
import { useCartStore } from '@/shared/store/cartStore';

export function ShopScreen() {
  const theme = useTheme();
  const { count, add } = useCartStore();

  return (
    <ScreenContainer scrollable>
      <AppHeader />
      <SearchBar placeholder="Search products" />
      <View style={styles.cartBanner}>
        <Text style={{ color: theme.colors.textPrimary, fontWeight: '700' }}>
          Cart · {count} items
        </Text>
      </View>
      <View style={styles.grid}>
        {shopProducts.map(product => (
          <View
            key={product.id}
            style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <Image source={{ uri: product.imageUrl }} style={styles.image} />
            <Text style={[styles.name, { color: theme.colors.navy }]} numberOfLines={2}>
              {product.name}
            </Text>
            <Text style={{ color: theme.colors.orange, fontWeight: '700' }}>
              Rs {product.price}
            </Text>
            <Button title="Add" onPress={() => add(1)} style={{ marginTop: 8 }} />
          </View>
        ))}
      </View>
      <View style={[styles.checkout, { backgroundColor: theme.colors.green }]}>
        <Text style={styles.checkoutText}>Checkout (mock) · {count} items</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  cartBanner: { marginBottom: 4 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    borderRadius: 14,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  image: { width: '100%', height: 120 },
  name: {
    fontWeight: '700',
    fontSize: 13,
    paddingHorizontal: 10,
    marginTop: 8,
  },
  checkout: {
    marginTop: 8,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  checkoutText: { color: '#fff', fontWeight: '700' },
});

