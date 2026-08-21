import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

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
        <Pressable
          key={banner.id}
          onPress={banner.onPress}
          style={[styles.card, { borderRadius: theme.radius.lg }]}>
          <Image source={{ uri: banner.imageUrl }} style={styles.image} />
          <View style={styles.overlay}>
            <Text style={styles.title} numberOfLines={2}>
              {banner.title}
            </Text>
            <View style={[styles.cta, { backgroundColor: theme.colors.primary }]}>
              <Text style={styles.ctaText}>{banner.cta}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    height: 120,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 6,
  },
  title: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ctaText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
