import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { KeyboardAvoidingView, Text, TextInput } from 'react-native';
import { CreateComplaintScreen } from './CreateComplaintScreen';

jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 64 }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/ScreenContainer', () => ({ ScreenContainer: ({ children }: any) => children }));
jest.mock('@/shared/components/Button', () => ({ Button: (props: any) => { const { Pressable } = require('react-native'); return <Pressable {...props} />; } }));
const mockGoBack = jest.fn();
const mockLogout = jest.fn();
let mockUser: any = { id: 'user-1' };
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ goBack: mockGoBack }) }));
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser, logout: mockLogout }) }));
const mockCreate = jest.fn();
jest.mock('@/shared/api/complaintHooks', () => ({ useCreateComplaintMutation: () => ({ mutateAsync: mockCreate }) }));

function button(renderer: ReactTestRenderer.ReactTestRenderer, title = 'Post complaint') {
  return renderer.root.findAll(node => node.props.title === title && node.props.onPress)[0];
}
function field(renderer: ReactTestRenderer.ReactTestRenderer, label: string) {
  return renderer.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!;
}
function fill(renderer: ReactTestRenderer.ReactTestRenderer, title = '  Broken lights  ', description = '  The lights near the main entrance do not work.  ') {
  ReactTestRenderer.act(() => {
    field(renderer, 'Complaint title').props.onChangeText(title);
    field(renderer, 'Complaint description').props.onChangeText(description);
  });
}
function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CreateComplaintScreen />); });
  return renderer;
}
async function post(renderer: ReactTestRenderer.ReactTestRenderer) {
  await ReactTestRenderer.act(async () => { button(renderer).props.onPress(); });
}
beforeEach(() => {
  mockUser = { id: 'user-1' }; mockGoBack.mockReset(); mockLogout.mockReset();
  mockCreate.mockReset().mockResolvedValue({ id: 'complaint-1' });
});
afterEach(() => jest.restoreAllMocks());

test('validates trimmed required title and description before any request', async () => {
  const renderer = render();
  await post(renderer);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Text).some(node => String(node.props.children).includes('3 and 120'))).toBe(true);
  fill(renderer, 'A valid title', '   short   ');
  await post(renderer);
  expect(mockCreate).not.toHaveBeenCalled();
  expect(renderer.root.findAllByType(Text).some(node => String(node.props.children).includes('10 to 3,000'))).toBe(true);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('posts trimmed text with a retry identifier and returns only after server confirmation', async () => {
  let resolve!: (value: unknown) => void;
  mockCreate.mockReturnValue(new Promise(yes => { resolve = yes; }));
  const renderer = render(); fill(renderer);
  await post(renderer);
  expect(mockCreate).toHaveBeenCalledWith({ title: 'Broken lights', description: 'The lights near the main entrance do not work.', clientRequestId: expect.any(String) });
  expect(mockGoBack).not.toHaveBeenCalled();
  expect(button(renderer).props.loading).toBe(true);
  expect(field(renderer, 'Complaint title').props.editable).toBe(false);
  await ReactTestRenderer.act(async () => { resolve({ id: 'complaint-1' }); });
  expect(mockGoBack).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('rapid repeat presses cannot send two posts', async () => {
  let resolve!: (value: unknown) => void;
  mockCreate.mockReturnValue(new Promise(yes => { resolve = yes; }));
  const renderer = render(); fill(renderer);
  await ReactTestRenderer.act(async () => { const action = button(renderer).props.onPress; action(); action(); });
  expect(mockCreate).toHaveBeenCalledTimes(1);
  await ReactTestRenderer.act(async () => { resolve({ id: 'complaint-1' }); });
  ReactTestRenderer.act(() => renderer.unmount());
});

test('failure retains draft and retry reuses its identifier; changed text gets a new identifier', async () => {
  mockCreate.mockRejectedValue(new Error('network unavailable'));
  const renderer = render(); fill(renderer);
  await post(renderer); const first = mockCreate.mock.calls[0][0];
  expect(mockGoBack).not.toHaveBeenCalled();
  expect(field(renderer, 'Complaint title').props.value).toBe('  Broken lights  ');
  expect(button(renderer).props.disabled).toBe(false);
  await post(renderer);
  expect(mockCreate.mock.calls[1][0].clientRequestId).toBe(first.clientRequestId);
  fill(renderer, 'Broken entrance lights'); await post(renderer);
  expect(mockCreate.mock.calls[2][0].clientRequestId).not.toBe(first.clientRequestId);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('guest cannot enter or post complaints and can return to sign-in', () => {
  mockUser = { id: 'temporary-guest' };
  const renderer = render();
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  ReactTestRenderer.act(() => button(renderer, 'Sign in').props.onPress());
  expect(mockLogout).toHaveBeenCalledTimes(1); expect(mockCreate).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => renderer.unmount());
});

test('account changes clear the draft and ignore a previous account response', async () => {
  let resolve!: (value: unknown) => void;
  mockCreate.mockReturnValue(new Promise(yes => { resolve = yes; }));
  const renderer = render(); fill(renderer); await post(renderer);
  mockUser = { id: 'user-2' };
  ReactTestRenderer.act(() => renderer.update(<CreateComplaintScreen />));
  expect(field(renderer, 'Complaint title').props.value).toBe('');
  await ReactTestRenderer.act(async () => { resolve({ id: 'old-account-post' }); });
  expect(mockGoBack).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => renderer.unmount());
});


test('form avoids the keyboard below its native navigation header', () => {
  const renderer = render();
  expect(renderer.root.findByType(KeyboardAvoidingView).props.keyboardVerticalOffset).toBe(64);
  ReactTestRenderer.act(() => renderer.unmount());
});
