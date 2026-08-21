import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SearchIcon } from '@/shared/components/Icons';

export function SearchBar({ placeholder = 'Search' }: { placeholder?: string }) {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  return (
    <Pressable
      onPress={() => navigation.navigate('Search')}
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
        },
      ]}>
      <Text style={[styles.placeholder, { color: theme.colors.textSecondary }]}>
        {placeholder}
      </Text>
      <SearchIcon color={theme.colors.textSecondary} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 42,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholder: {
    fontSize: 15,
  },
});
