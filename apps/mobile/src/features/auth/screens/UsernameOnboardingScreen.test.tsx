import React from 'react';
import TestRenderer from 'react-test-renderer';
import { KeyboardAvoidingView, Platform, Text, TextInput } from 'react-native';
import { UsernameOnboardingScreen } from './UsernameOnboardingScreen';

const mockClaim = jest.fn(), mockRequest = jest.fn(), mockLogout = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ claimUsername: mockClaim, logout: mockLogout }) }));
jest.mock('@/shared/api/client', () => ({ apiRequest: (...args: any[]) => mockRequest(...args) }));
jest.mock('@/shared/hooks/useTheme', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) }));
jest.mock('@/shared/components/PressableScale', () => ({ PressableScale: ({ children, ...props }: any) => { const { Pressable } = require('react-native'); return <Pressable {...props}>{children}</Pressable>; } }));
jest.mock('@/shared/components/Button', () => ({ Button: ({ title, ...props }: any) => { const { Pressable, Text } = require('react-native'); return <Pressable accessibilityLabel={title} {...props}><Text>{title}</Text></Pressable>; } }));
let renderer: TestRenderer.ReactTestRenderer;
const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
beforeEach(() => { jest.useFakeTimers(); mockClaim.mockReset(); mockRequest.mockReset(); });
afterEach(() => { TestRenderer.act(() => renderer.unmount()); Object.defineProperty(Platform, 'OS', platformDescriptor); jest.useRealTimers(); });
const button = () => renderer.root.findAll(node => node.props.accessibilityLabel === 'Continue' && node.props.onPress)[0];
async function enter(value: string) {
  TestRenderer.act(() => renderer.root.findByType(TextInput).props.onChangeText(value));
  await TestRenderer.act(async () => jest.advanceTimersByTime(300));
}
test.each(['ios', 'android'])('%s gates continuation, handles claim races and keeps the input', async platform => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  TestRenderer.act(() => { renderer = TestRenderer.create(<UsernameOnboardingScreen />); });
  expect(renderer.root.findByType(KeyboardAvoidingView).props.behavior).toBe(platform === 'ios' ? 'padding' : undefined);
  expect(button().props.disabled).toBe(true);
  mockRequest.mockResolvedValue({ username: 'arun.fit', status: 'available', suggestions: [] });
  await enter(' @Arun.Fit '); expect(button().props.disabled).toBe(false);
  mockClaim.mockRejectedValueOnce(new Error('This username is already taken.'));
  mockRequest.mockResolvedValue({ username: 'arun.fit', status: 'taken', suggestions: ['arun.fit_1'] });
  await TestRenderer.act(async () => { button().props.onPress(); button().props.onPress(); });
  expect(mockClaim).toHaveBeenCalledTimes(1); expect(mockClaim).toHaveBeenCalledWith('arun.fit');
  await TestRenderer.act(async () => jest.advanceTimersByTime(300));
  expect(button().props.disabled).toBe(true);
  expect(renderer.root.findByType(TextInput).props.value).toBe('arun.fit');
  const suggestion = renderer.root.findAll(node => node.props.accessibilityLabel === 'Use @arun.fit_1' && node.props.onPress)[0];
  TestRenderer.act(() => suggestion.props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe('arun.fit_1');
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'This username is already taken.')).toBe(false);
});
