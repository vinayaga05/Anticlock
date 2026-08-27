import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ServiceMode } from '@/shared/types';
import { AppIcon, IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';

const MODES: { id: ServiceMode; label: string; icon: IconName }[] = [
  { id: 'center', label: 'Clinic', icon: 'hospital' },
  { id: 'home', label: 'Home', icon: 'home-visit' },
  { id: 'online', label: 'Online', icon: 'video' },
];

type Props = {
  value: ServiceMode;
  onChange: (m: ServiceMode) => void;
};

export function ModeTabs({ value, onChange }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {MODES.map(mode => {
        const active = mode.id === value;
        return (
          <PressableScale
            key={mode.id}
            onPress={() => onChange(mode.id)}
            accessibilityLabel={mode.label}
            style={[
              styles.tab,
              {
                backgroundColor: active ? theme.colors.primarySoft : theme.colors.surface,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radius.md,
              },
            ]}>
            <AppIcon
              name={mode.icon}
              size={16}
              color={active ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text
              style={[
                theme.typography.caption,
                {
                  color: active ? theme.colors.primary : theme.colors.textSecondary,
                  fontWeight: '600',
                },
              ]}>
              {mode.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
