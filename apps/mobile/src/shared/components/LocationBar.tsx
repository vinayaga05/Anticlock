import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { DEFAULT_LOCATION } from '@/shared/constants';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

type LocationBarProps = {
  onBookNearby?: () => void;
};

export function LocationBar({ onBookNearby }: LocationBarProps) {
  const theme = useTheme();
  const { pincode, area, clinicsNearby, city } = DEFAULT_LOCATION;

  return (
    <View style={styles.row}>
      <PressableScale
        accessibilityLabel="Change location"
        style={[
          styles.box,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            flex: 1.3,
          },
        ]}>
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm },
          ]}>
          <AppIcon name="location" size={16} color={theme.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
            {city} · {pincode}
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {area}
          </Text>
        </View>
      </PressableScale>
      <PressableScale
        onPress={onBookNearby}
        accessibilityLabel="Book nearby clinics"
        style={[
          styles.box,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            flex: 1,
          },
        ]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[theme.typography.caption, { color: theme.colors.textSecondary }]}>
            Nearby
          </Text>
          <Text style={[theme.typography.bodySmall, { color: theme.colors.textPrimary, fontWeight: '600' }]}>
            {clinicsNearby} clinics
          </Text>
        </View>
        <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
          Book
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
