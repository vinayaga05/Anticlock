import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ServiceTile } from '@/shared/types';

type Props = {
  tiles: ServiceTile[];
  columns?: number;
  onPress?: (tile: ServiceTile) => void;
};

export function ServiceTileGrid({ tiles, columns = 5, onPress }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.grid}>
      {tiles.map(tile => (
        <Pressable
          key={tile.id}
          onPress={() => onPress?.(tile)}
          style={[
            styles.tile,
            {
              width: `${(100 - columns * 2) / columns}%` as `${number}%`,
              backgroundColor: theme.colors.tile,
              borderRadius: theme.radius.md,
            },
          ]}>
          <Text style={styles.icon}>{tile.icon}</Text>
          <Text style={[styles.label, { color: theme.colors.navy }]} numberOfLines={3}>
            {tile.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tile: {
    minHeight: 88,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});
