import React from 'react';
import Renderer from 'react-test-renderer';
import { Image, Text } from 'react-native';
import { StoryRing } from './StoryRing';
import type { StoryTrayEntry } from '@/shared/data/flash/storyTypes';

jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/data/flash/storyStore', () => ({
  getStoryAuthorName: (author: any) => author.name || 'User',
}));
const entry = (avatarUrl = '', authorId = 'owner'): StoryTrayEntry => ({
  authorId,
  author: { id: authorId, name: 'Vinay', avatarUrl },
  items: [],
  isOwn: true,
  hasActiveStory: false,
  hasUnread: false,
});
let tree: Renderer.ReactTestRenderer;
const render = (item: StoryTrayEntry) =>
  Renderer.act(() => {
    tree = Renderer.create(<StoryRing entry={item} onPress={jest.fn()} />);
  });
afterEach(() => Renderer.act(() => tree?.unmount()));

test('missing or whitespace avatars show an initial instead of an empty image', () => {
  render(entry('   '));
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(
    tree.root.findAllByType(Text).some(n => n.props.children === 'V'),
  ).toBe(true);
  expect(
    tree.root.findAll(n => n.props.accessibilityLabel === 'Add story').length,
  ).toBeGreaterThan(0);
});

test('failed image switches to fallback and a changed URI is retried', () => {
  render(entry('https://cdn.example/first.jpg'));
  Renderer.act(() => tree.root.findByType(Image).props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  Renderer.act(() =>
    tree.update(
      <StoryRing
        entry={entry('https://cdn.example/new.jpg')}
        onPress={jest.fn()}
      />,
    ),
  );
  expect(tree.root.findByType(Image).props.source).toEqual({
    uri: 'https://cdn.example/new.jpg',
  });
});

test('a delayed error from a recycled avatar does not hide the new avatar', () => {
  render(entry('https://cdn.example/old.jpg'));
  const oldError = tree.root.findByType(Image).props.onError;
  Renderer.act(() =>
    tree.update(
      <StoryRing
        entry={entry('https://cdn.example/new.jpg', 'other')}
        onPress={jest.fn()}
      />,
    ),
  );
  Renderer.act(() => oldError());
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'https://cdn.example/new.jpg',
  );
});

test('returning to a previously failed URI gets a fresh load attempt', () => {
  render(entry('https://cdn.example/first.jpg'));
  Renderer.act(() => tree.root.findByType(Image).props.onError());
  Renderer.act(() =>
    tree.update(
      <StoryRing
        entry={entry('https://cdn.example/new.jpg')}
        onPress={jest.fn()}
      />,
    ),
  );
  Renderer.act(() =>
    tree.update(
      <StoryRing
        entry={entry('https://cdn.example/first.jpg')}
        onPress={jest.fn()}
      />,
    ),
  );
  expect(tree.root.findByType(Image).props.source.uri).toBe(
    'https://cdn.example/first.jpg',
  );
});
