/**
 * Shared jest module factories for component tests. Use inside factories:
 *   jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
 */
import React from 'react';
import { Pressable, View } from 'react-native';

const theme = {
  colors: new Proxy({}, { get: () => '#000000' }),
  typography: new Proxy({}, { get: () => ({}) }),
  radius: new Proxy({}, { get: () => 8 }),
  spacing: new Proxy({}, { get: () => 8 }),
  shadows: new Proxy({}, { get: () => ({}) }),
  motion: { pressScale: 0.97, fast: 120 },
  mode: 'light',
};

export const themeModule = { useTheme: () => theme };

export const appIconModule = {
  AppIcon: ({ name }: { name: string }) => <View testID={`icon-${name}`} />,
};

export const pressableScaleModule = {
  PressableScale: ({ children, onPress, testID, accessibilityLabel, disabled, accessibilityState }: any) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}>
      {children}
    </Pressable>
  ),
};

export const reanimatedModule = {
  __esModule: true,
  default: { View: ({ children, ...rest }: any) => <View {...rest}>{children}</View> },
  SlideInDown: { duration: () => ({}) },
};

export const safeAreaModule = {
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
};

/** First element carrying this testID (composite before host). */
export function byTestId(
  renderer: { root: { findAll: (predicate: (node: any) => boolean) => any[] } },
  testID: string,
) {
  const found = renderer.root.findAll(node => node.props?.testID === testID);
  if (found.length === 0) throw new Error(`No element with testID "${testID}"`);
  return found[0];
}

export function countTestId(
  renderer: { root: { findAll: (predicate: (node: any) => boolean) => any[] } },
  testID: string,
) {
  return renderer.root.findAll(node => node.props?.testID === testID).length;
}
