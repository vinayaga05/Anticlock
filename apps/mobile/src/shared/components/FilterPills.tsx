import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { PressableScale } from '@/shared/components/PressableScale';

type Pill = { id: string; label: string; tone?: 'primary' | 'success' | 'muted' };

type FilterPillsProps = {
  pills: Pill[];
  activeId: string;
  onChange: (id: string) => void;
  accent?: string;
};

export function FilterPills({ pills, activeId, onChange, accent }: FilterPillsProps) {
  const theme = useTheme();
  const tint = accent ?? theme.colors.primary;
  const isDark = theme.mode === 'dark';

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.row}>
        {pills.map(pill => {
          const active = pill.id === activeId;
          return (
            <PressableScale
              key={pill.id}
              onPress={() => onChange(pill.id)}
              accessibilityLabel={pill.label}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? tint : theme.colors.surface,
                  borderColor: active ? tint : theme.colors.border,
                  borderRadius: theme.radius.pill,
                },
              ]}>
              <Text
                style={[
                  theme.typography.bodySmall,
                  {
                    color: active
                      ? isDark
                        ? '#042F2E'
                        : '#FFFFFF'
                      : theme.colors.textSecondary,
                    fontWeight: '600',
                  },
                ]}>
                {pill.label}
              </Text>
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'stretch',
  },
  scroll: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'center',
  },
});
