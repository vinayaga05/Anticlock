import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { PublisherProfileView } from './PublisherProfileView';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => effect(),
}));

const mockRefetch = jest.fn();
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({
    identities: [],
    active: { id: 'profile-1', type: 'user', name: 'Me', profileType: 'personal' },
  }),
}));
jest.mock('@/shared/api/storyHooks', () => ({
  useContentProfileQuery: () => ({
    data: {
      publisher: { id: 'profile-1', type: 'personal', displayName: 'Me', handle: 'me' },
      counts: { posts: 0, clips: 1, flash: 0, stories: 0 },
      viewerCanManage: true,
    },
    refetch: mockRefetch,
  }),
  useContentProfilePostsQuery: (_type: string, _id: string, format: string) => ({
    data:
      format === 'clip'
        ? [
            {
              id: 'clip-42',
              format: 'clip',
              mediaType: 'video',
              caption: 'My clip',
              posterUrl: 'https://cdn.example/clip.jpg',
              media: [],
            },
          ]
        : [],
    isLoading: false,
    isRefetching: false,
    refetch: mockRefetch,
  }),
  useMyContentQuery: () => ({ data: [], refetch: mockRefetch }),
}));

describe('PublisherProfileView', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  it('shows Clips first and opens a published profile clip in the player', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<PublisherProfileView />);
    });

    const tabLabels = [
      ...new Set(
        renderer.root
          .findAll(node => ['Clips', 'Posts'].includes(node.props.accessibilityLabel))
          .map(node => node.props.accessibilityLabel),
      ),
    ];
    expect(tabLabels).toEqual(['Clips', 'Posts']);

    const clip = renderer.root.findAll(
      node => node.props.accessibilityLabel === 'Open clip',
    )[0] as ReactTestRenderer.ReactTestInstance;
    expect(clip).toBeDefined();
    ReactTestRenderer.act(() => clip.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('Main', {
      screen: 'PlayFeed',
      params: {
        reelId: 'clip-42',
        profileType: 'personal',
        profileId: 'profile-1',
      },
    });
  });
});
