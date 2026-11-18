import React from 'react';
import Renderer from 'react-test-renderer';
import { StoryTray } from './StoryTray';

let mockActive: any;
const mockSetViewer = jest.fn();
const mockRefetch = jest.fn();
const mockOwn = {
  authorId: 'me',
  author: {
    id: 'me',
    name: 'Old name',
    avatarUrl: 'https://cdn.example/stale.jpg',
  },
  isOwn: true,
  hasActiveStory: true,
  items: [],
};
const mockOther = {
  authorId: 'other',
  author: {
    id: 'other',
    name: 'Other',
    avatarUrl: 'https://cdn.example/other.jpg',
  },
  isOwn: false,
  hasActiveStory: true,
  items: [],
};
const mockStoryState = {
  getTrayEntries: () => [mockOwn, mockOther],
  loadMoreTrayStories: jest.fn(),
  hasMoreTrayStories: () => false,
  setApiStories: jest.fn(),
  setViewerProfile: mockSetViewer,
};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: jest.fn(),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('@/features/flash/components/StoryRing', () => ({
  StoryRing: (props: any) => require('react').createElement('story-ring', props),
}));
jest.mock('@/shared/data/flash/storyStore', () => ({
  useStoryStore: () => mockStoryState,
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: mockActive }),
}));
jest.mock('@/shared/api/storyHooks', () => ({
  useStoriesQuery: () => ({ data: undefined, refetch: mockRefetch }),
}));
jest.mock('@/shared/api/config', () => ({ isApiEnabled: true }));
let tree: Renderer.ReactTestRenderer;
const rings = () => tree.root.findAll(n => n.type === ('story-ring' as any));
beforeEach(() => {
  mockSetViewer.mockClear();
  mockActive = {
    id: 'me',
    type: 'user',
    profileType: 'personal',
    name: 'Vinay',
    avatarUrl: null,
    publisher: { avatarUrl: 'https://cdn.example/current.jpg' },
  };
});
afterEach(() => Renderer.act(() => tree?.unmount()));

test('canonical publisher photo reaches own story placeholder and replaces stale own author snapshot', () => {
  Renderer.act(() => {
    tree = Renderer.create(<StoryTray />);
  });
  expect(mockSetViewer).toHaveBeenCalledWith(
    expect.objectContaining({ avatarUrl: 'https://cdn.example/current.jpg' }),
  );
  expect(rings()[0].props.entry.author).toEqual(
    expect.objectContaining({
      name: 'Vinay',
      avatarUrl: 'https://cdn.example/current.jpg',
    }),
  );
  expect(rings()[1].props.entry).toBe(mockOther);
});

test('an active profile avatar update refreshes Your Story and empty canonical avatar uses legacy photo', () => {
  Renderer.act(() => {
    tree = Renderer.create(<StoryTray />);
  });
  mockActive = {
    ...mockActive,
    publisher: { avatarUrl: '   ' },
    avatarUrl: 'https://cdn.example/updated.jpg',
  };
  Renderer.act(() => tree.update(<StoryTray />));
  expect(rings()[0].props.entry.author.avatarUrl).toBe(
    'https://cdn.example/updated.jpg',
  );
  expect(mockSetViewer).toHaveBeenLastCalledWith(
    expect.objectContaining({ avatarUrl: 'https://cdn.example/updated.jpg' }),
  );
});
