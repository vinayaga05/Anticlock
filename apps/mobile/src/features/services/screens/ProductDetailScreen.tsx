import React from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';
import { RootStackParamList } from '@/shared/navigation/types';
import { useProductQuery } from '@/shared/api';

export function ProductDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const productId = route.params.productId;
  const add = useCartStore(s => s.addProduct);

  const {
    data: apiProduct,
    isLoading,
    error,
  } = useProductQuery(productId);

  const product = apiProduct;

  if (isLoading) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (error) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="alert-circle"
          title="Error loading product"
          description={(error as Error).message}
        />
      </ScreenContainer>
    );
  }

  if (!product) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="shopping-bag" title="Product not found" />
      </ScreenContainer>
    );
  }

  const imageUrl = product.images?.[0]?.url;
  const price = Math.round(product.price / 100);
  const { name, description, inventory } = product;
  const outOfStock = inventory === 0;

  return (
    <ScreenContainer scrollable tabAware={false}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.hero} /> : null}
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {name}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        ₹{price}
      </Text>

      {outOfStock && (
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.error, marginTop: 4 },
          ]}
        >
          Out of stock
        </Text>
      )}

      {description && (
        <Card style={{ marginTop: 12 }}>
          <Text
            style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}
          >
            {description}
          </Text>
        </Card>
      )}

      <View style={{ marginTop: 16, gap: 10 }}>
        <Button
          title="Add to cart"
          icon="cart"
          disabled={outOfStock}
          onPress={() => {
            add(product.id, name, price, imageUrl);
            Alert.alert('Added', `${name} added to cart.`);
          }}
        />
        <Button
          title="Buy now"
          variant="secondary"
          icon="credit-card"
          disabled={outOfStock}
          onPress={() => {
            add(product.id, name, price, imageUrl);
            navigation.navigate('Checkout');
          }}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 240, borderRadius: 20, marginBottom: 16 },
});
