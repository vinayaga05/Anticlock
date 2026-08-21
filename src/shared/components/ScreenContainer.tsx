import React, { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';

interface ScreenContainerProps extends PropsWithChildren {
  scrollable?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  edges?: ('top' | 'right' | 'bottom' | 'left')[];
}

export function ScreenContainer({
  children,
  scrollable = false,
  padded = true,
  contentStyle,
  edges = ['top', 'left', 'right'],
}: ScreenContainerProps) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        styles.content,
        padded && { padding: theme.spacing.lg, gap: theme.spacing.md },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  content: { flexGrow: 1 },
});
