import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { MarketplaceProvider } from '@/shared/data/services';
import { Card } from '@/shared/components/Card';
import { Glass } from '@/shared/components/Glass';
import { AppIcon } from '@/shared/components/AppIcon';
import { Button } from '@/shared/components/Button';
import { healthTheme } from '@/shared/theme/healthTheme';

export function ProviderCard({
  provider,
  onPress,
  health = false,
}: {
  provider: MarketplaceProvider;
  onPress?: () => void;
  health?: boolean;
}) {
  const theme = useTheme();

  const content = (
    <>
      <View style={styles.row}>
        <Image source={{ uri: provider.imageUrl }} style={styles.avatar} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.nameRow}>
            <Text
              style={[
                theme.typography.body,
                {
                  color: health ? healthTheme.navy : theme.colors.textPrimary,
                  fontWeight: '700',
                  flex: 1,
                },
              ]}
              numberOfLines={1}>
              {provider.name}
            </Text>
            {provider.verified ? (
              <AppIcon
                name="check-circle"
                size={16}
                color={health ? healthTheme.sky : theme.colors.primary}
              />
            ) : null}
          </View>
          <Text
            style={[
              theme.typography.caption,
              { color: health ? healthTheme.textMuted : theme.colors.textSecondary },
            ]}>
            {provider.subtitle ?? provider.type}
          </Text>
          <View style={styles.meta}>
            <AppIcon name="star" size={13} color={theme.colors.warning} />
            <Text
              style={[
                theme.typography.caption,
                { color: health ? healthTheme.textMuted : theme.colors.textSecondary },
              ]}>
              {provider.rating} · {provider.location.area}
            </Text>
          </View>
          {provider.priceFrom != null ? (
            <Text
              style={[
                theme.typography.bodySmall,
                {
                  color: health ? healthTheme.navy : theme.colors.primary,
                  fontWeight: '700',
                },
              ]}>
              From Rs {provider.priceFrom}
            </Text>
          ) : null}
        </View>
      </View>
      {onPress ? (
        <Button
          title="View profile"
          variant={health ? 'health' : 'secondary'}
          onPress={onPress}
        />
      ) : null}
    </>
  );

  if (health) {
    return (
      <Glass
        variant="health"
        intensity="heavy"
        radius={healthTheme.radiusMd}
        elevated
        style={{ gap: 12, padding: 14 }}>
        {content}
      </Glass>
    );
  }

  return (
    <Card onPress={onPress} elevated style={{ gap: 12 }}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 18 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
