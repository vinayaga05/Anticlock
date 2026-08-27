import React, { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';

interface ScreenContainerProps extends PropsWithChildren {
  scrollable?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  edges?: Edge[];
  /** When false (stack screens with a nav header), skip top safe-area inset. */
  tabAware?: boolean;
}

export function ScreenContainer({
  children,
  scrollable = false,
  padded = true,
  contentStyle,
  edges,
  tabAware = true,
}: ScreenContainerProps) {
  const theme = useTheme();
  const bottomPad = tabAware ? 100 : theme.spacing.lg;

  // Stack screens already get top inset from the native header — don't double it.
  const resolvedEdges: Edge[] =
    edges ?? (tabAware ? ['top', 'left', 'right'] : ['left', 'right']);

  const content = (
    <View
      style={[
        styles.content,
        padded && {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: tabAware ? theme.spacing.sm : theme.spacing.md,
          gap: theme.spacing.lg,
        },
        { paddingBottom: bottomPad },
        contentStyle,
      ]}>
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={resolvedEdges}
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
  // Avoid flexGrow:1 here — it stretches horizontal ScrollViews (filter pills) into tall columns.
  scrollContent: { flexGrow: 0 },
  content: {},
});
