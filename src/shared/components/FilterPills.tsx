import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

type Pill = { id: string; label: string; tone?: 'primary' | 'success' | 'muted' };

type FilterPillsProps = {
  pills: Pill[];
  activeId: string;
  onChange: (id: string) => void;
};

export function FilterPills({ pills, activeId, onChange }: FilterPillsProps) {
  const theme = useTheme();

  const toneColor = (tone?: Pill['tone'], active?: boolean) => {
    if (!active) return theme.colors.primarySoft;
    if (tone === 'success') return theme.colors.green;
    if (tone === 'muted') return theme.colors.navy;
    return theme.colors.primary;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {pills.map(pill => {
        const active = pill.id === activeId;
        return (
          <Pressable
            key={pill.id}
            onPress={() => onChange(pill.id)}
            style={[
              styles.pill,
              {
                backgroundColor: toneColor(pill.tone, active),
                opacity: active ? 1 : 0.75,
              },
            ]}>
            <Text style={styles.label}>{pill.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  label: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
});
