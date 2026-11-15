import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { LoginScreen } from './LoginScreen';
import { ApiError } from '@/shared/api/client';

const mockSend = jest.fn();
const mockVerify = jest.fn();
let mockUser: any = null;
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({
    requestOtp: mockSend,
    loginWithOtp: mockVerify,
    user: mockUser,
  }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/shared/components/BrandLogo', () => ({ BrandLogo: () => null }));
jest.mock('@/shared/components/Button', () => ({
  Button: (props: any) => {
    const { Pressable } = require('react-native');
    return <Pressable {...props} />;
  },
}));
const mockNow = Date.parse('2026-11-14T15:00:00Z');
const result = (id = 'first') => ({
  requestId: id,
  expiresInSeconds: 300,
  expiresAt: new Date(Date.now() + 300_000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
});
let renderer: ReactTestRenderer.ReactTestRenderer;
function button(title: string) {
  return renderer.root.findAll(
    node => node.props.title === title && node.props.onPress,
  )[0];
}
function field(label: string) {
  return renderer.root
    .findAllByType(TextInput)
    .find(node => node.props.accessibilityLabel === label)!;
}
function text() {
  return renderer.root
    .findAllByType(Text)
    .map(node => node.props.children)
    .join(' ');
}
function fill(label: string, value: string) {
  ReactTestRenderer.act(() => field(label).props.onChangeText(value));
}
async function press(title: string) {
  await ReactTestRenderer.act(async () => {
    button(title).props.onPress();
  });
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(mockNow);
  mockUser = null;
  mockSend.mockReset().mockImplementation(async () => result());
  mockVerify.mockReset().mockResolvedValue(undefined);
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<LoginScreen />);
  });
});
afterEach(() => {
  ReactTestRenderer.act(() => renderer.unmount());
  jest.useRealTimers();
});

test('submits pasted E.164 input unchanged and never truncates an unsupported country number', async () => {
  fill('Mobile number', '449876543210');
  expect(button('Continue').props.disabled).toBe(true);
  await press('Continue');
  expect(mockSend).not.toHaveBeenCalled();
  fill('Mobile number', '+91 98765 43210');
  await press('Continue');
  expect(mockSend.mock.calls[0][0]).toBe('+919876543210');
  expect(text()).toContain('+91 98••••3210');
  expect(text()).not.toContain('OTP 123456');
});

test('server cooldown gates resend and a successful resend replaces the verification challenge', async () => {
  fill('Mobile number', '9876543210');
  await press('Continue');
  expect(button('Resend code in 60s').props.disabled).toBe(true);
  await press('Resend code in 60s');
  expect(mockSend).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => jest.advanceTimersByTime(60_000));
  mockSend.mockImplementationOnce(async () => result('replacement'));
  await press('Resend code');
  fill('One-time code', '765432');
  await press('Verify & sign in');
  expect(mockVerify.mock.calls[0].slice(0, 3)).toEqual([
    '+919876543210',
    '765432',
    'replacement',
  ]);
});

test('code expiry disables verification while leaving resend available', async () => {
  fill('Mobile number', '9876543210');
  await press('Continue');
  fill('One-time code', '765432');
  ReactTestRenderer.act(() => jest.advanceTimersByTime(300_000));
  expect(text()).toContain('This code has expired.');
  expect(button('Verify & sign in').props.disabled).toBe(true);
  await press('Verify & sign in');
  expect(mockVerify).not.toHaveBeenCalled();
  expect(button('Resend code').props.disabled).toBe(false);
});

test('a rejected code preserves input and server lockout timing disables verification/resend', async () => {
  fill('Mobile number', '9876543210');
  await press('Continue');
  fill('One-time code', '765432');
  mockVerify.mockRejectedValueOnce(
    new ApiError(400, 'invalid_otp', 'The code is incorrect.'),
  );
  await press('Verify & sign in');
  expect(field('One-time code').props.value).toBe('765432');
  expect(text()).toContain('The code is incorrect.');
  mockVerify.mockRejectedValueOnce(
    new ApiError(429, 'otp_locked', 'Try again in 15 minutes.', 900),
  );
  await press('Verify & sign in');
  expect(button('Verify & sign in').props.disabled).toBe(true);
  expect(button('Resend code in 900s').props.disabled).toBe(true);
});

test('an authoritative server-expired code cannot be submitted again despite the display timer', async () => {
  fill('Mobile number', '9876543210');
  await press('Continue');
  fill('One-time code', '765432');
  mockVerify.mockRejectedValueOnce(
    new ApiError(
      400,
      'otp_expired',
      'This code has expired. Request another code.',
    ),
  );
  await press('Verify & sign in');
  expect(button('Verify & sign in').props.disabled).toBe(true);
  expect(field('One-time code').props.value).toBe('');
  expect(text()).toContain('This code has expired.');
});

test('rapid repeat presses send once and changing number cancels a pending result', async () => {
  let resolve!: (value: any) => void;
  mockSend.mockReturnValue(
    new Promise(yes => {
      resolve = yes;
    }),
  );
  fill('Mobile number', '9876543210');
  await ReactTestRenderer.act(async () => {
    const send = button('Continue').props.onPress;
    send();
    send();
  });
  expect(mockSend).toHaveBeenCalledTimes(1);
  const options = mockSend.mock.calls[0][1];
  expect(options.isCurrentAttempt()).toBe(true);
  fill('Mobile number', '9000000000');
  expect(options.signal.aborted).toBe(true);
  expect(options.isCurrentAttempt()).toBe(false);
  await ReactTestRenderer.act(async () => resolve(result()));
  expect(field('Mobile number').props.value).toBe('9000000000');
  expect(
    renderer.root
      .findAllByType(TextInput)
      .some(node => node.props.accessibilityLabel === 'One-time code'),
  ).toBe(false);
});

test('change-number and unmount invalidate an in-flight verification before session persistence', async () => {
  fill('Mobile number', '9876543210');
  await press('Continue');
  fill('One-time code', '765432');
  let resolve!: () => void;
  mockVerify.mockReturnValue(
    new Promise<void>(yes => {
      resolve = yes;
    }),
  );
  await press('Verify & sign in');
  const options = mockVerify.mock.calls[0][3];
  await press('Change number');
  expect(options.isCurrentAttempt()).toBe(false);
  expect(options.signal.aborted).toBe(true);
  await ReactTestRenderer.act(async () => resolve());
  expect(field('Mobile number').props.value).toBe('9876543210');
});

test('a send failure restores controls and uses the server retry interval', async () => {
  mockSend.mockRejectedValueOnce(
    new ApiError(
      429,
      'rate_limit_exceeded',
      'Please wait before trying again.',
      45,
    ),
  );
  fill('Mobile number', '9876543210');
  await press('Continue');
  expect(text()).toContain('Please wait before trying again.');
  expect(button('Try again in 45s').props.loading).toBe(false);
  expect(button('Try again in 45s').props.disabled).toBe(true);
  ReactTestRenderer.act(() => jest.advanceTimersByTime(45_000));
  expect(button('Continue').props.disabled).toBe(false);
});
