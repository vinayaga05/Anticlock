import React from 'react';
import Renderer from 'react-test-renderer';
import { Image } from 'react-native';
import { FlashComposerBar } from './FlashComposerBar';
let mockUser = {
  displayName: 'Vinay',
  avatarUrl: 'https://cdn.example/me.jpg',
};
let mockActive: any = {
  name: 'Vinay',
  type: 'personal',
  avatarUrl: 'https://cdn.example/stale.jpg',
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('@/shared/components/PressableScale', () => ({
  PressableScale: require('react-native').View,
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({ user: mockUser }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: mockActive }),
}));
jest.mock('@/shared/publishing/publisherSelection', () => ({
  identityProfileType: (p: any) => p.type,
}));
it('tracks personal photo edits and business profile switches with a failure fallback', () => {
  let view!: Renderer.ReactTestRenderer;
  Renderer.act(() => {
    view = Renderer.create(<FlashComposerBar />);
  });
  expect(view.root.findByType(Image).props.source.uri).toBe(mockUser.avatarUrl);
  mockUser = { ...mockUser, avatarUrl: 'https://cdn.example/new.jpg' };
  Renderer.act(() => view.update(<FlashComposerBar />));
  expect(view.root.findByType(Image).props.source.uri).toBe(mockUser.avatarUrl);
  mockActive = {
    type: 'business',
    name: 'Team',
    publisher: { avatarUrl: 'https://cdn.example/team.jpg' },
  };
  Renderer.act(() => view.update(<FlashComposerBar />));
  expect(view.root.findByType(Image).props.source.uri).toBe(
    mockActive.publisher.avatarUrl,
  );
  Renderer.act(() => view.root.findByType(Image).props.onError());
  expect(view.root.findAllByType(Image)).toHaveLength(0);
  Renderer.act(() => view.unmount());
});
