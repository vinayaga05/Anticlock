import React from 'react';
import { Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { marketplaceProducts } from '@/shared/data/services';

export function MyOrdersScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const orders = marketplaceProducts.filter(p => !p.isProperty).slice(0, 3);

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

  return (
    <ScreenContainer scrollable tabAware={false}>
      {orders.map((item, index) => (
        <Card key={item.id} elevated style={{ gap: 6 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.success, fontWeight: '700' }]}>
            {index === 0 ? 'IN TRANSIT' : 'DELIVERED'}
          </Text>
          <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
            {item.name}
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
            Sold by {item.seller}
          </Text>
          <Text style={[theme.typography.body, { color: theme.colors.primary, fontWeight: '700' }]}>
            Rs {item.price}
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
