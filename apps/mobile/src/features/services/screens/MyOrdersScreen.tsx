import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { marketplaceProducts } from '@/shared/data/services';
import { useOrdersQuery, useCancelOrderMutation, isApiEnabled } from '@/shared/api';

export function MyOrdersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const {
    data: apiData,
    isLoading,
    error,
  } = useOrdersQuery();
  const cancelMutation = useCancelOrderMutation();

  const mockOrders = marketplaceProducts.filter(p => !p.isProperty).slice(0, 3);
  const orders = isApiEnabled ? apiData?.orders ?? [] : mockOrders;

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
          title="Error loading orders"
          description={(error as Error).message}
        />
      </ScreenContainer>
    );
  }

  if (orders.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState
          icon="shopping-bag"
          title="No orders yet"
          actionLabel="Shop now"
          onAction={() => navigation.navigate('Main', { screen: 'Shop' })}
        />
      </ScreenContainer>
    );
  }

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: 'PENDING', color: theme.colors.warning },
      confirmed: { label: 'CONFIRMED', color: theme.colors.info },
      processing: { label: 'PROCESSING', color: theme.colors.info },
      shipped: { label: 'SHIPPED', color: theme.colors.success },
      delivered: { label: 'DELIVERED', color: theme.colors.success },
      cancelled: { label: 'CANCELLED', color: theme.colors.error },
    };
    return statusMap[status] || { label: status.toUpperCase(), color: theme.colors.textSecondary };
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      {isApiEnabled
        ? orders.map((order: any) => {
            const statusInfo = getStatusLabel(order.status);
            const canCancel =
              order.status === 'pending' || order.status === 'confirmed';
            
            return (
              <Card key={order.id} elevated style={{ gap: 6 }}>
                <Text
                  style={[
                    theme.typography.caption,
                    { color: statusInfo.color, fontWeight: '700' },
                  ]}
                >
                  {statusInfo.label}
                </Text>
                <Text
                  style={[
                    theme.typography.bodySmall,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Order #{order.orderNumber}
                </Text>
                {order.items.map((item: any, idx: number) => (
                  <Text
                    key={idx}
                    style={[
                      theme.typography.section,
                      { color: theme.colors.textPrimary },
                    ]}
                  >
                    {item.productName} × {item.quantity}
                  </Text>
                ))}
                <Text
                  style={[
                    theme.typography.body,
                    { color: theme.colors.primary, fontWeight: '700' },
                  ]}
                >
                  ₹{order.total}
                </Text>
                {canCancel && (
                  <Button
                    title="Cancel Order"
                    variant="secondary"
                    size="small"
                    disabled={cancelMutation.isPending}
                    onPress={() => {
                      cancelMutation.mutate({ orderId: order.id });
                    }}
                  />
                )}
              </Card>
            );
          })
        : mockOrders.map((item, index) => (
            <Card key={item.id} elevated style={{ gap: 6 }}>
              <Text
                style={[
                  theme.typography.caption,
                  { color: theme.colors.success, fontWeight: '700' },
                ]}
              >
                {index === 0 ? 'IN TRANSIT' : 'DELIVERED'}
              </Text>
              <Text
                style={[
                  theme.typography.section,
                  { color: theme.colors.textPrimary },
                ]}
              >
                {item.name}
              </Text>
              <Text
                style={[
                  theme.typography.bodySmall,
                  { color: theme.colors.textSecondary },
                ]}
              >
                Sold by {item.seller}
              </Text>
              <Text
                style={[
                  theme.typography.body,
                  { color: theme.colors.primary, fontWeight: '700' },
                ]}
              >
                ₹{item.price}
              </Text>
            </Card>
          ))}
      <Button
        title="Continue shopping"
        icon="shopping-bag"
        onPress={() => navigation.navigate('Main', { screen: 'Shop' })}
      />
    </ScreenContainer>
  );
}
