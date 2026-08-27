import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

export function SearchBar({
  placeholder = 'Search services, doctors, products...',
  showFilter,
}: {
  placeholder?: string;
  showFilter?: boolean;
}) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <View style={styles.row}>
      <PressableScale
        onPress={() => navigation.navigate('Search')}
        accessibilityLabel="Open search"
        style={[
          styles.bar,
          {
            flex: 1,
            backgroundColor: theme.colors.surfaceSecondary,
            borderColor: theme.colors.borderSoft,
            borderRadius: theme.radius.lg,
          },
        ]}>
        <AppIcon name="search" size={20} color={theme.colors.primary} />
        <Text style={[theme.typography.body, { color: theme.colors.textTertiary, flex: 1 }]}>
          {placeholder}
        </Text>
      </PressableScale>
      {showFilter ? (
        <PressableScale
          accessibilityLabel="Filters"
          style={[
            styles.filter,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              borderRadius: theme.radius.lg,
            },
          ]}>
          <AppIcon name="settings" size={20} color={theme.colors.textSecondary} />
        </PressableScale>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bar: {
    height: 54,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filter: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
