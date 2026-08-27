import React from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { getProduct } from '@/shared/data/services';
import { useCartStore } from '@/shared/store/cartStore';
import { RootStackParamList } from '@/shared/navigation/types';

export function ProductDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const product = getProduct(route.params.productId);
  const add = useCartStore(s => s.add);

  if (!product) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="shopping-bag" title="Product not found" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Image source={{ uri: product.imageUrl }} style={styles.hero} />
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        {product.name}
      </Text>
      <Text style={[theme.typography.body, { color: theme.colors.textSecondary }]}>
        {product.seller} · ★ {product.rating}
      </Text>
      <Text style={[theme.typography.title, { color: theme.colors.primary, marginTop: 8 }]}>
        {product.isProperty
          ? `Rs ${(product.price / 100000).toFixed(1)}L`
          : `Rs ${product.price}`}
      </Text>

      <Card style={{ marginTop: 12 }}>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          {product.description}
        </Text>
      </Card>

      <View style={{ marginTop: 16, gap: 10 }}>
        {product.isProperty ? (
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
              onPress={() => {
                add(1);
                Alert.alert('Added', `${product.name} added to cart.`);
              }}
            />
            <Button
              title="Buy now"
              variant="secondary"
              icon="credit-card"
              onPress={() => {
                add(1);
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
