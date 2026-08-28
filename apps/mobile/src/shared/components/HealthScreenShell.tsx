import React, { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { healthTheme } from '@/shared/theme/healthTheme';

type HealthScreenShellProps = PropsWithChildren<{
  scrollable?: boolean;
  padded?: boolean;
  contentStyle?: ViewStyle;
  tabAware?: boolean;
}>;

/** Soft clinical backdrop for health booking and service flows. */
export function HealthScreenShell({
  children,
  scrollable = false,
  padded = true,
  contentStyle,
  tabAware = false,
}: HealthScreenShellProps) {
  return (
    <View style={styles.root}>
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobRight]} />
      <ScreenContainer
        scrollable={scrollable}
        padded={padded}
        contentStyle={contentStyle}
        tabAware={tabAware}
        variant="health">
        {children}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: healthTheme.background,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: healthTheme.skySoft,
  },
  blobTop: {
    width: 280,
    height: 280,
    top: -80,
    left: -60,
    opacity: 0.55,
  },
  blobRight: {
    width: 200,
    height: 200,
    top: 120,
    right: -70,
    opacity: 0.35,
  },
});
