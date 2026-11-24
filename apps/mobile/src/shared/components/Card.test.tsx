import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { Glass } from './Glass';

jest.mock('@/shared/hooks/useTheme', () => ({ useTheme: () => ({
  mode: 'light', colors: { surface: '#FFFFFF', borderSoft: '#eeeeee' },
  radius: { xl: 24 }, spacing: { lg: 16 },
  shadows: { soft: { elevation: 2 }, healthSoft: { elevation: 3 } },
  glass: { medium: { background: 'rgba(255,255,255,0.72)' }, blurAmount: 20 },
  healthGlass: { medium: { background: 'rgba(255,255,255,0.62)' } },
}) }));
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('@react-native-community/blur', () => ({ BlurView: () => null }));
const originalOS = Platform.OS;
beforeEach(() => { Platform.OS = 'android'; });
afterEach(() => { Platform.OS = originalOS; });

function render(element: React.ReactElement) {
  let result!: Renderer.ReactTestRenderer;
  act(() => { result = Renderer.create(element); });
  return result;
}

test.each([false, true])('tinted Card has an opaque elevation surface, pressable=%s', pressable => {
  const onPress = jest.fn();
  const tree = render(<Card tint="rgba(167,139,250,0.12)" onPress={pressable ? onPress : undefined}><Text>Communities</Text></Card>);
  const surface = tree.root.findAllByType(View).map(n => StyleSheet.flatten(n.props.style)).find(s => s?.elevation === 2);
  expect(surface).toMatchObject({ backgroundColor: 'rgb(244, 241, 254)', padding: 16, borderRadius: 24 });
  if (pressable) {
    act(() => tree.root.findAll(n => n.props.onPress === onPress)[0].props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  }
  act(() => tree.unmount());
});

test('resolves style overrides after tint while retaining grid sizing', () => {
  const tree = render(<Card onPress={() => {}} style={[{ width: 160 }, { backgroundColor: '#A78BFA33' }]}><Text>Category</Text></Card>);
  const surface = tree.root.findAllByType(View).map(n => StyleSheet.flatten(n.props.style)).find(s => s?.elevation === 2);
  expect(surface).toMatchObject({ width: 160, backgroundColor: 'rgb(237, 232, 254)' });
  act(() => tree.unmount());
});

test('health Glass panels use the same opaque elevation treatment', () => {
  const tree = render(<Glass variant="health" elevated><Text>Health</Text></Glass>);
  const surface = tree.root.findAllByType(View).map(n => StyleSheet.flatten(n.props.style)).find(s => s?.elevation === 3);
  expect(surface.backgroundColor).toBe('rgb(255, 255, 255)');
  act(() => tree.unmount());
});

test('real blur stays transparent without Android elevation', () => {
  const tree = render(<Glass variant="health" elevated blur><Text>Health</Text></Glass>);
  const surface = StyleSheet.flatten(tree.root.findAllByType(View)[0].props.style);
  expect(surface).toMatchObject({ elevation: 0, backgroundColor: 'transparent' });
  act(() => tree.unmount());
});
