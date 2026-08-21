import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

export function PartnerLogoRow({ names }: { names: string[] }) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {names.map(name => (
        <View
          key={name}
          style={[
            styles.chip,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
            },
          ]}>
          <Text style={[styles.text, { color: theme.colors.navy }]}>{name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 110,
    alignItems: 'center',
  },
  text: {
    fontWeight: '700',
    fontSize: 12,
  },
});
