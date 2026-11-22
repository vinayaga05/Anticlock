import React, { useEffect } from 'react';
import Renderer from 'react-test-renderer';
import { StreamChatProvider } from './StreamChatProvider';

let finishChat: () => void;
let finishVideo: () => void;
const mockChat = {
  connectUser: jest.fn(() => new Promise<void>(resolve => { finishChat = resolve; })),
  disconnectUser: jest.fn().mockResolvedValue(undefined),
};
const mockVideo = {
  connectUser: jest.fn(() => new Promise<void>(resolve => { finishVideo = resolve; })),
  disconnectUser: jest.fn().mockResolvedValue(undefined),
};
jest.mock('stream-chat', () => ({ StreamChat: { getInstance: () => mockChat } }));
jest.mock('stream-chat-react-native', () => ({
  Chat: ({ children }: any) => children,
  OverlayProvider: ({ children }: any) => children,
}));
jest.mock('@stream-io/video-react-native-sdk', () => ({
  StreamVideo: ({ children }: any) => children,
  StreamVideoClient: jest.fn(() => mockVideo),
  useCalls: () => [],
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user', displayName: 'Test' } }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
jest.mock('@/shared/api/client', () => ({
  getApiToken: () => 'token',
  apiClient: { post: jest.fn().mockResolvedValue({ apiKey: 'key', userId: 'user', token: 'token' }) },
}));
jest.mock('@/shared/navigation/rootNavigation', () => ({ rootNavigationRef: { isReady: () => false } }));
jest.mock('@/shared/hooks/useTheme', () => ({ useTheme: () => ({}) }));
jest.mock('@/features/messages/streamChatTheme', () => ({ createStreamChatTheme: () => ({}) }));

it('keeps navigation mounted while chat and calling connect independently', async () => {
  const mount = jest.fn();
  const unmount = jest.fn();
  function NavigationProbe() {
    useEffect(() => { mount(); return unmount; }, []);
    return null;
  }
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {
    tree = Renderer.create(<StreamChatProvider><NavigationProbe /></StreamChatProvider>);
  });
  expect(mount).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => finishChat());
  expect(mockVideo.connectUser).toHaveBeenCalledTimes(1);
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
  await Renderer.act(async () => finishVideo());
  expect(mount).toHaveBeenCalledTimes(1);
  expect(unmount).not.toHaveBeenCalled();
  Renderer.act(() => tree.unmount());
  expect(unmount).toHaveBeenCalledTimes(1);
});
