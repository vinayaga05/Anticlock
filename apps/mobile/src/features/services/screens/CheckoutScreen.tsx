import React, { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCartStore } from '@/shared/store/cartStore';
import { useCreateOrderMutation, isApiEnabled } from '@/shared/api';

const FLAT_SHIPPING_RATE = 5;
const FREE_SHIPPING_THRESHOLD = 500;
const TAX_RATE = 0.18;

export function CheckoutScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const { count, items, clear, getTotal } = useCartStore();
  const createOrderMutation = useCreateOrderMutation();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

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

  const subtotal = isApiEnabled ? getTotal() : count * 499;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + shipping + tax;

  const handlePlaceOrder = async () => {
    if (!isApiEnabled) {
      clear();
      Alert.alert('Order placed', 'Track it under My Orders.', [
        { text: 'My orders', onPress: () => navigation.replace('MyOrders') },
      ]);
      return;
    }

    if (
      !fullName ||
      !phone ||
      !addressLine1 ||
      !city ||
      !state ||
      !postalCode
    ) {
      Alert.alert('Missing information', 'Please fill in all required fields.');
      return;
    }

    try {
      await createOrderMutation.mutateAsync({
        items: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        shippingAddress: {
          fullName,
          phone,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country: 'India',
        },
      });

      clear();
      Alert.alert('Order placed', 'Track it under My Orders.', [
        { text: 'My orders', onPress: () => navigation.replace('MyOrders') },
      ]);
    } catch (error) {
      Alert.alert('Order failed', (error as Error).message);
    }
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Order Summary
        </Text>
        {isApiEnabled ? (
          items.map(item => (
            <View key={item.productId} style={{ flexDirection: 'row', gap: 8 }}>
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.textPrimary, flex: 1 },
                ]}
              >
                {item.name} × {item.quantity}
              </Text>
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.textPrimary },
                ]}
              >
                ₹{item.price * item.quantity}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[theme.typography.body, { color: theme.colors.textPrimary }]}>
            {count} item{count === 1 ? '' : 's'} in cart
          </Text>
        )}
        <View style={{ borderTopWidth: 1, borderColor: theme.colors.borderSoft, paddingTop: 8, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Subtotal
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
              ₹{subtotal}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Shipping
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
              {shipping === 0 ? 'FREE' : `₹${shipping}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              Tax (18%)
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary }]}>
              ₹{tax}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={[theme.typography.body, { color: theme.colors.textPrimary, fontWeight: '700' }]}>
              Total
            </Text>
            <Text style={[theme.typography.title, { color: theme.colors.primary }]}>
              ₹{total}
            </Text>
          </View>
        </View>
      </Card>

      {isApiEnabled && (
        <Card style={{ gap: 8 }}>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            Shipping Address
          </Text>
          <TextInput
            placeholder="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            style={[
              theme.typography.body,
              {
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                padding: 12,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholderTextColor={theme.colors.textTertiary}
          />
          <TextInput
            placeholder="Phone *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={[
              theme.typography.body,
              {
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                padding: 12,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholderTextColor={theme.colors.textTertiary}
          />
          <TextInput
            placeholder="Address Line 1 *"
            value={addressLine1}
            onChangeText={setAddressLine1}
            style={[
              theme.typography.body,
              {
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                padding: 12,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholderTextColor={theme.colors.textTertiary}
          />
          <TextInput
            placeholder="Address Line 2"
            value={addressLine2}
            onChangeText={setAddressLine2}
            style={[
              theme.typography.body,
              {
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                padding: 12,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholderTextColor={theme.colors.textTertiary}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              placeholder="City *"
              value={city}
              onChangeText={setCity}
              style={[
                theme.typography.body,
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.colors.borderSoft,
                  borderRadius: theme.radius.md,
                  padding: 12,
                  color: theme.colors.textPrimary,
                },
              ]}
              placeholderTextColor={theme.colors.textTertiary}
            />
            <TextInput
              placeholder="State *"
              value={state}
              onChangeText={setState}
              style={[
                theme.typography.body,
                {
                  flex: 1,
                  borderWidth: 1,
                  borderColor: theme.colors.borderSoft,
                  borderRadius: theme.radius.md,
                  padding: 12,
                  color: theme.colors.textPrimary,
                },
              ]}
              placeholderTextColor={theme.colors.textTertiary}
            />
          </View>
          <TextInput
            placeholder="Postal Code *"
            value={postalCode}
            onChangeText={setPostalCode}
            keyboardType="number-pad"
            style={[
              theme.typography.body,
              {
                borderWidth: 1,
                borderColor: theme.colors.borderSoft,
                borderRadius: theme.radius.md,
                padding: 12,
                color: theme.colors.textPrimary,
              },
            ]}
            placeholderTextColor={theme.colors.textTertiary}
          />
        </Card>
      )}

      <View style={{ gap: 10, marginTop: 8 }}>
        <Button
          title={createOrderMutation.isPending ? 'Placing order...' : 'Place order'}
          icon="credit-card"
          disabled={createOrderMutation.isPending}
          onPress={handlePlaceOrder}
        />
        {createOrderMutation.isPending && (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        )}
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
