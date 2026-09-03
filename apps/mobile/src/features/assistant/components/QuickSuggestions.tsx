import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';

export function QuickSuggestions({
  actions,
  onSelect,
}: {
  actions: string[];
  onSelect: (action: string) => void;
}) {
  const theme = useTheme();
  if (!actions.length) return null;
  const isDark = theme.mode === 'dark';

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.row}>
      {actions.map(action => (
        <PressableScale
          key={action}
          onPress={() => onSelect(action)}
          style={[
            styles.chip,
            {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(255,255,255,0.5)',
              borderColor: isDark
                ? 'rgba(255,255,255,0.14)'
                : 'rgba(255,255,255,0.72)',
            },
          ]}>
          <Text style={[styles.label, { color: theme.colors.primary }]}>{action}</Text>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
});
