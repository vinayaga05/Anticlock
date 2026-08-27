import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';

type Banner = {
  id: string;
  title: string;
  cta: string;
  imageUrl: string;
  onPress?: () => void;
};

export function PromoBannerRow({ banners }: { banners: Banner[] }) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {banners.map(banner => (
        <PressableScale
          key={banner.id}
          onPress={banner.onPress}
          accessibilityLabel={banner.title}
          style={[
            styles.card,
            {
              borderRadius: theme.radius.xl,
              ...theme.shadows.card,
            },
          ]}>
          <Image source={{ uri: banner.imageUrl }} style={styles.image} />
          <View style={styles.overlay}>
            <Text style={[theme.typography.bodySmall, styles.title]} numberOfLines={2}>
              {banner.title}
            </Text>
            <View
              style={[
                styles.cta,
                {
                  backgroundColor: theme.colors.primary,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <Text style={[theme.typography.caption, { color: '#042F2E', fontWeight: '700' }]}>
                {banner.cta}
              </Text>
            </View>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    height: 140,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
  },
  title: {
    color: '#fff',
    fontWeight: '600',
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
