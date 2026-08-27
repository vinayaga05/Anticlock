import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { palette } from '@/shared/theme/colors';

type Props = {
  id: string;
};

export function PostEndDivider(_props: Props) {
  const theme = useTheme();
  const isDark = theme.colors.background === palette.black;
  const lineColor = isDark ? palette.gray[600] : palette.gray[300];

  return (
    <View
      style={[styles.line, { backgroundColor: lineColor }]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  line: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    minHeight: 1,
    marginTop: 6,
    marginBottom: 2,
  },
});
