import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { DEFAULT_LOCATION } from '@/shared/constants';
import { LocationIcon } from '@/shared/components/Icons';

type LocationBarProps = {
  onBookNearby?: () => void;
};

export function LocationBar({ onBookNearby }: LocationBarProps) {
  const theme = useTheme();
  const { pincode, area, clinicsNearby } = DEFAULT_LOCATION;

  return (
    <View style={styles.row}>
      <View style={[styles.box, { backgroundColor: theme.colors.surface }]}>
        <LocationIcon color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.main, { color: theme.colors.textOnSurface }]} numberOfLines={1}>
            {DEFAULT_LOCATION.city.toLowerCase()}-{pincode}
          </Text>
          <Text style={[styles.sub, { color: theme.colors.navy }]} numberOfLines={1}>
            {area}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onBookNearby}
        style={[styles.box, styles.right, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.nearby, { color: theme.colors.navy }]}>
          {clinicsNearby} Clinics Near By You
        </Text>
        <Text style={[styles.bookLink, { color: theme.colors.primary }]}>Book Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  box: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  right: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 2,
  },
  main: {
    fontSize: 12,
    fontWeight: '700',
  },
  sub: {
    fontSize: 11,
  },
  nearby: {
    fontSize: 12,
    fontWeight: '600',
  },
  bookLink: {
    fontSize: 11,
    fontWeight: '700',
  },
});
