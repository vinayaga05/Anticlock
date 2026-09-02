import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AppIcon } from '@/shared/components/AppIcon';

export function ToolProgressBanner({
  toolName,
  message,
}: {
  toolName: string;
  message: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.borderSoft },
      ]}>
      <AppIcon name="sparkles" size={16} color={theme.colors.primary} />
      <Text style={[styles.text, { color: theme.colors.textSecondary }]}>
        {message || `Running ${toolName}...`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    flex: 1,
  },
});
