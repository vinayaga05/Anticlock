import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ThreadScreen } from './ThreadScreen';

const mockNavigate = jest.fn();
const mockReconnect = jest.fn();
let mockReady = true;
let mockPeerType: 'personal' | 'business' = 'business';
const peerId = 'ed3b2a59-3ab7-49bd-b557-d74294a01ed4';
const mockChannel = {
  get data() { return { profile_members: [
    { user_id: 'viewer-stream', profile_id: 'viewer-personal', profile_type: 'personal', name: 'Viewer' },
    { user_id: 'peer-stream', profile_id: peerId, profile_type: mockPeerType, name: 'Peer profile' },
  ] }; },
  watch: async () => {},
  on: () => ({ unsubscribe: jest.fn() }),
};
const mockClient = { userID: 'viewer-stream', channel: () => mockChannel };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: { conversationId: 'conversation-1' } }),
}));
jest.mock('@/shared/providers/StreamChatProvider', () => ({
  useStreamChat: () => ({ client: mockReady ? mockClient : null, isReady: mockReady, isConnecting: false, error: mockReady ? null : 'Network connection failed', retry: mockReconnect }),
  ConversationChatProvider: ({ children }: any) => children,
}));
jest.mock('stream-chat-react-native', () => ({ Channel: ({ children }: any) => children, MessageList: () => null, MessageComposer: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('@/shared/components/IconButton', () => ({ IconButton: () => null }));
jest.mock('@/shared/api/profileFollows', () => ({ blockProfile: jest.fn() }));
jest.mock('@/shared/api/messagesClient', () => ({ reportConversation: jest.fn() }));

test.each(['business', 'personal'] as const)('opens the channel peer’s %s identity from the chat header', async type => {
  mockNavigate.mockClear(); mockPeerType = type;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<ThreadScreen />); });
  const profile = renderer.root.findAll(node => node.props.accessibilityLabel === 'Open Peer profile profile' && node.props.onPress)[0];
  ReactTestRenderer.act(() => profile.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith(type === 'business' ? 'BusinessProfile' : 'Profile', type === 'business'
    ? { providerId: peerId } : { profileType: 'personal', profileId: peerId });
  ReactTestRenderer.act(() => renderer.unmount());
});

test('Try again reconnects the SDK after a connection failure and can recover the thread', async () => {
  mockReady = false;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => { renderer = ReactTestRenderer.create(<ThreadScreen />); });
  expect(renderer.root.findAllByType(Text).some(n => n.props.children === 'Network connection failed')).toBe(true);
  const retry = renderer.root.findAll(n => n.props.accessibilityLabel === 'Retry conversation' && n.props.onPress)[0];
  ReactTestRenderer.act(() => retry.props.onPress());
  expect(mockReconnect).toHaveBeenCalledTimes(1);
  mockReady = true;
  await ReactTestRenderer.act(async () => { renderer.update(<ThreadScreen />); });
  expect(renderer.root.findAll(n => n.props.accessibilityLabel === 'Open Peer profile profile').length).toBeGreaterThan(0);
  ReactTestRenderer.act(() => renderer.unmount());
});
