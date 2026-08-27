import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ServiceTile } from '@/shared/types';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

type Props = {
  tiles: ServiceTile[];
  columns?: number;
  onPress?: (tile: ServiceTile) => void;
};

export function ServiceTileGrid({ tiles, columns = 5, onPress }: Props) {
  const theme = useTheme();
  const widthPercent = `${(100 - columns * 1.6) / columns}%` as `${number}%`;

  return (
    <View style={styles.grid}>
      {tiles.map(tile => (
        <PressableScale
          key={tile.id}
          onPress={() => onPress?.(tile)}
          accessibilityLabel={tile.label}
          style={[
            styles.tile,
            {
              width: widthPercent,
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.md,
            },
          ]}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: theme.colors.primarySoft,
                borderRadius: theme.radius.sm,
              },
            ]}>
            <AppIcon
              name={(tile.icon as IconName) || 'activity'}
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <Text
            style={[theme.typography.caption, { color: theme.colors.textSecondary, textAlign: 'center' }]}
            numberOfLines={3}>
            {tile.label}
          </Text>
        </PressableScale>
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
    minHeight: 92,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
