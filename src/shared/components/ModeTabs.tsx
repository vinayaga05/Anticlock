import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ServiceMode } from '@/shared/types';

const MODES: { id: ServiceMode; label: string }[] = [
  { id: 'center', label: 'At Center/Hospital' },
  { id: 'home', label: 'At Home Visit' },
  { id: 'online', label: 'ONLINE' },
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
          <Pressable
            key={mode.id}
            onPress={() => onChange(mode.id)}
            style={[
              styles.tab,
              {
                backgroundColor: active ? theme.colors.navy : theme.colors.primarySoft,
                borderRadius: theme.radius.md,
              },
            ]}>
            <Text style={styles.label}>{mode.label}</Text>
          </Pressable>
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
    paddingHorizontal: 6,
    alignItems: 'center',
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
  },
});
