import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { MarketplaceProvider } from '@/shared/data/services';
import { Card } from '@/shared/components/Card';
import { Glass } from '@/shared/components/Glass';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { ProviderCardMedia } from './ProviderCardMedia';
import { healthTheme } from '@/shared/theme/healthTheme';

export function ProviderCard({
  provider,
  onPress,
  health = false,
  previewActive = false,
  onPreviewReady,
  onPreviewFailed,
}: {
  provider: MarketplaceProvider;
  onPress?: () => void;
  health?: boolean;
  previewActive?: boolean;
  onPreviewReady?: (id: string) => void;
  onPreviewFailed?: (id: string, url: string) => void;
}) {
  const theme = useTheme();
  const handlePreviewReady = useCallback(
    () => onPreviewReady?.(provider.id),
    [onPreviewReady, provider.id],
  );
  const handlePreviewFailed = useCallback(
    (url: string) => onPreviewFailed?.(provider.id, url),
    [onPreviewFailed, provider.id],
  );

  const content = (
    <>
      <View style={styles.row}>
        <ProviderCardMedia
          key={`${provider.id}:${provider.introVideoUrl}:${provider.imageUrl}:${provider.fallbackImageUrl}`}
          imageUrl={provider.imageUrl}
          fallbackImageUrl={provider.fallbackImageUrl}
          videoUrl={provider.introVideoUrl}
          active={previewActive}
          name={provider.name}
          onPreviewReady={handlePreviewReady}
          onPreviewFailed={handlePreviewFailed}
        />
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
              numberOfLines={1}
            >
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
              {
                color: health
                  ? healthTheme.textMuted
                  : theme.colors.textSecondary,
              },
            ]}
          >
            {provider.subtitle ?? provider.type}
          </Text>
          <View style={styles.meta}>
            <AppIcon name="star" size={13} color={theme.colors.warning} />
            <Text
              style={[
                theme.typography.caption,
                {
                  color: health
                    ? healthTheme.textMuted
                    : theme.colors.textSecondary,
                },
              ]}
            >
              {provider.reviewCount > 0 ? provider.rating : 'New'}
              {provider.location.area || provider.location.city
                ? ` · ${provider.location.area || provider.location.city}`
                : ''}
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
              ]}
            >
              From Rs {provider.priceFrom}
            </Text>
          ) : null}
        </View>
      </View>
    </>
  );

  if (health) {
    const surface = (
      <Glass
        variant="health"
        intensity="heavy"
        radius={healthTheme.radiusMd}
        elevated
        style={{ gap: 12, padding: 14 }}
      >
        {content}
      </Glass>
    );
    return onPress ? (
      <PressableScale
        onPress={onPress}
        accessibilityLabel={`Open ${provider.name} profile`}
      >
        {surface}
      </PressableScale>
    ) : (
      surface
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
