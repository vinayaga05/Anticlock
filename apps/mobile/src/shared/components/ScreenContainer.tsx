import React, { PropsWithChildren } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {
  SafeAreaView,
  Edge,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { healthTheme } from '@/shared/theme/healthTheme';
import { getTabBarBottomInset } from '@/shared/navigation/tabBarInset';

interface ScreenContainerProps extends PropsWithChildren {
  scrollable?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  edges?: Edge[];
  /** When false (stack screens with a nav header), skip top safe-area inset. */
  tabAware?: boolean;
  /** Clinical soft-blue backdrop for health flows. */
  variant?: 'default' | 'health';
  scrollRef?: React.Ref<ScrollView>;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function ScreenContainer({
  children,
  scrollable = false,
  padded = true,
  contentStyle,
  edges,
  tabAware = true,
  variant = 'default',
  scrollRef,
  onScroll,
}: ScreenContainerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isHealth = variant === 'health';
  const bottomPad = tabAware
    ? getTabBarBottomInset(insets.bottom)
    : theme.spacing.lg;

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
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      edges={resolvedEdges}
      style={[
        styles.safeArea,
        {
          backgroundColor: isHealth
            ? healthTheme.background
            : theme.colors.background,
        },
      ]}
    >
      {scrollable ? (
        <ScrollView
          ref={scrollRef}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
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
