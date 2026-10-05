import React from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { getProduct } from '@/shared/data/services';
import { useCartStore } from '@/shared/store/cartStore';
import { RootStackParamList } from '@/shared/navigation/types';
import { useProductQuery, isApiEnabled } from '@/shared/api';

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

  const mockProduct = !isApiEnabled ? getProduct(productId) : null;
  const product = isApiEnabled ? apiProduct : mockProduct;

  if (isLoading && isApiEnabled) {
    return (
      <ScreenContainer tabAware={false}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  if (error && isApiEnabled) {
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

  const imageUrl = isApiEnabled
    ? (apiProduct?.images?.[0]?.url ?? 'https://placehold.co/400x400/png')
    : (mockProduct?.imageUrl ?? 'https://placehold.co/400x400/png');

  const price = isApiEnabled
    ? Math.round((apiProduct?.price ?? 0) / 100)
    : (mockProduct?.price ?? 0);

  const name = product.name;
  const description = isApiEnabled
    ? apiProduct?.description
    : mockProduct?.description;
  const seller = isApiEnabled ? 'Anticlock Shop' : mockProduct?.seller ?? 'Seller';
  const rating = isApiEnabled ? '4.5' : String(mockProduct?.rating ?? '4.5');
  const isProperty = !isApiEnabled && mockProduct?.isProperty;

  const inventory = isApiEnabled ? (apiProduct?.inventory ?? 0) : 100;
  const outOfStock = inventory === 0;

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Image source={{ uri: imageUrl }} style={styles.hero} />
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {name}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {seller} · ★ {rating}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        {isProperty ? `Rs ${(price / 100000).toFixed(1)}L` : `₹${price}`}
      </Text>

      {outOfStock && isApiEnabled && (
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
        {isProperty ? (
          <Button
            title="Contact seller"
            icon="messages"
            onPress={() =>
              Alert.alert('Enquiry sent', 'The property seller will reach out soon.')
            }
          />
        ) : (
          <>
            <Button
              title="Add to cart"
              icon="cart"
              disabled={outOfStock}
              onPress={() => {
                if (isApiEnabled && apiProduct) {
                  add(apiProduct.id, apiProduct.name, price, imageUrl);
                } else {
                  add('mock', name, price, imageUrl);
                }
                Alert.alert('Added', `${name} added to cart.`);
              }}
            />
            <Button
              title="Buy now"
              variant="secondary"
              icon="credit-card"
              disabled={outOfStock}
              onPress={() => {
                if (isApiEnabled && apiProduct) {
                  add(apiProduct.id, apiProduct.name, price, imageUrl);
                } else {
                  add('mock', name, price, imageUrl);
                }
                navigation.navigate('Checkout');
              }}
            />
          </>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 240, borderRadius: 20, marginBottom: 16 },
});
