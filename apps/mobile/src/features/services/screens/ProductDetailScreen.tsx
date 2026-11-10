import React from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import Video from 'react-native-video';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';
import { RootStackParamList } from '@/shared/navigation/types';
import { useProductQuery, useSaveProductMutation } from '@/shared/api';
import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';

export function ProductDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ProductDetail'>>();
  const productId = route.params.productId;
  const add = useCartStore(s => s.addProduct);
  const { active } = useActiveProfile();
  const viewer = active ? { id: active.id, type: identityProfileType(active) } : undefined;

  const {
    data: apiProduct,
    isLoading,
    error,
  } = useProductQuery(productId, viewer);
  const save = useSaveProductMutation(productId, viewer);

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
          icon="search"
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
  const mediaKind = product.images?.[0]?.kind;
  const price = Math.round(product.price / 100);
  const { name, description, inventory } = product;
  const outOfStock = inventory === 0;
  const canPurchase = product.status === 'published' && product.reviewStatus === 'approved';

  return (
    <ScreenContainer scrollable tabAware={false}>
      {imageUrl ? mediaKind === 'video' ? (
        <Video source={{ uri: imageUrl }} style={styles.hero} controls repeat resizeMode="cover" />
      ) : <Image source={{ uri: imageUrl }} style={styles.hero} /> : null}
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
      {!canPurchase ? (
        <Text style={[theme.typography.bodySmall, { color: theme.colors.warning, marginTop: 4 }]}>
          This followers-only listing is awaiting public approval. Contact the seller for details.
        </Text>
      ) : null}

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
          title={product.viewerHasSaved ? 'Saved' : 'Save product'}
          variant="secondary"
          icon="bookmark"
          disabled={save.isPending}
          onPress={() => save.mutate(product.viewerHasSaved, {
            onError: caught => Alert.alert('Could not update saved products', caught instanceof Error ? caught.message : 'Please try again.'),
          })}
        />
        <Button
          title="Add to cart"
          icon="cart"
          disabled={outOfStock || !canPurchase}
          onPress={() => {
            add(product.id, name, price, imageUrl);
            Alert.alert('Added', `${name} added to cart.`);
          }}
        />
        <Button
          title="Buy now"
          variant="secondary"
          icon="credit-card"
          disabled={outOfStock || !canPurchase}
          onPress={() => {
            add(product.id, name, price, imageUrl);
            navigation.navigate('Checkout');
          }}
        />
        {product.publisherProfileId && product.publisherProfileType ? (
          <Button
            title="Contact seller"
            variant="secondary"
            icon="messages"
            onPress={() => navigation.navigate('Profile', {
              profileId: product.publisherProfileId,
              profileType: product.publisherProfileType,
            })}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 240, borderRadius: 20, marginBottom: 16 },
});
