import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { MarketplaceEvent } from '@/shared/data/services';
import { Card } from '@/shared/components/Card';
import { AppIcon } from '@/shared/components/AppIcon';

export function EventCard({
  event,
  onPress,
}: {
  event: MarketplaceEvent;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Card onPress={onPress} padded={false} elevated>
      <Image source={{ uri: event.imageUrl }} style={styles.image} />
      <View style={{ padding: 14, gap: 6 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          {event.title}
        </Text>
        <View style={styles.row}>
          <AppIcon name="map-pin" size={14} color={theme.colors.primary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {event.destination} · {event.duration}
          </Text>
        </View>
        <View style={styles.row}>
          <AppIcon name="calendar" size={14} color={theme.colors.textTertiary} />
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            {event.dateLabel}
          </Text>
          <Text
            style={[
              theme.typography.bodySmall,
              { color: theme.colors.primary, fontWeight: '700', marginLeft: 'auto' },
            ]}>
            Rs {event.price}
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 140 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
