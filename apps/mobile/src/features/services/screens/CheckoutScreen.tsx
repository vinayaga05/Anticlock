import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';

export function CheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { count, clear } = useCartStore();

  if (count === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="cart"
          title="Cart is empty"
          description="Add products from Shop to checkout."
          actionLabel="Browse shop"
          onAction={() => navigation.navigate('Main', { screen: 'Shop' })}
        />
      </ScreenContainer>
    );
  }

  const subtotal = count * 499;

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
          {count} item{count === 1 ? '' : 's'} in cart
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          Estimated subtotal
        </Text>
        <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
          Rs {subtotal}
        </Text>
      </Card>
      <Card style={{ gap: 6 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Delivery
        </Text>
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          12 Anna Nagar, Chennai · 2–4 days
        </Text>
      </Card>
      <View style={{ gap: 10, marginTop: 8 }}>
        <Button
          title="Place order"
          icon="credit-card"
          onPress={() => {
            clear();
            Alert.alert('Order placed', 'Track it under My Orders.', [
              { text: 'My orders', onPress: () => navigation.replace('MyOrders') },
            ]);
          }}
        />
        <Button
          title="Continue shopping"
          variant="secondary"
          onPress={() => navigation.navigate('Main', { screen: 'Shop' })}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({});
