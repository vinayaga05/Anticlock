import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

export function SearchBar({
  placeholder = 'Search services, doctors, products...',
  showFilter,
  emphasized = true,
  showVoiceControls = true,
  compact = true,
  value,
  onChangeText,
}: {
  placeholder?: string;
  showFilter?: boolean;
  /** Teal outlined treatment used on the Knock bookings screen. */
  emphasized?: boolean;
  showVoiceControls?: boolean;
  compact?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
}) {
  const theme = useTheme();
  const [uncontrolledValue, setUncontrolledValue] = useState('');
  const searchValue = value ?? uncontrolledValue;

  const updateValue = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChangeText?.(nextValue);
  };

  return (
    <View style={styles.row}>
      <View
        accessibilityLabel="Search"
        style={[
          styles.bar,
          compact && styles.barCompact,
          {
            flex: 1,
            backgroundColor: emphasized
              ? theme.colors.surface
              : theme.colors.surfaceSecondary,
            borderColor: emphasized
              ? theme.colors.primary
              : theme.colors.borderSoft,
            borderRadius: theme.radius.lg,
            borderWidth: emphasized ? 1.5 : StyleSheet.hairlineWidth,
            ...(emphasized ? theme.shadows.glowTeal : {}),
          },
        ]}
      >
        <AppIcon name="search" size={20} color={theme.colors.primary} />
        <TextInput
          value={searchValue}
          onChangeText={updateValue}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={placeholder}
          style={[
            theme.typography.body,
            styles.input,
            { color: theme.colors.textPrimary },
          ]}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {showVoiceControls ? (
          <View style={styles.voiceControls}>
            {searchValue ? (
              <PressableScale
                accessibilityLabel="Clear search"
                onPress={() => updateValue('')}
                style={styles.clearButton}
              >
                <AppIcon name="x" size={18} color={theme.colors.textTertiary} />
              </PressableScale>
            ) : null}
            <View
              style={[styles.divider, { backgroundColor: theme.colors.border }]}
            />
            <AppIcon name="mic" size={19} color={theme.colors.primary} />
          </View>
        ) : null}
      </View>
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
          ]}
        >
          <AppIcon
            name="settings"
            size={20}
            color={theme.colors.textSecondary}
          />
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
  barCompact: {
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  filter: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  voiceControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 0,
  },
  clearButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
  },
});
