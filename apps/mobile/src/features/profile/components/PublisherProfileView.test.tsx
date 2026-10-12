import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { PublisherProfileView } from './PublisherProfileView';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
const mockFollowMutate = jest.fn();
const mockCreateOrGetChannel = jest.fn();
let mockFollowRefs: any[] = [];
jest.mock('@/shared/api/profileFollows', () => ({
  useProfileFollowMutation: (...refs: any[]) => {
    mockFollowRefs = refs;
    return { mutate: mockFollowMutate, isPending: false };
  },
}));
jest.mock('@/shared/api/messagesClient', () => ({ createOrGetChannel: (...args: any[]) => mockCreateOrGetChannel(...args) }));
jest.mock('@/shared/providers/StreamChatProvider', () => ({ useStreamChat: () => ({ isReady: true }) }));
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useFocusEffect: (effect: () => void) => effect(),
}));

const mockRefetch = jest.fn();
let mockProfileSummary: any = {
  publisher: { id: 'profile-1', type: 'personal', displayName: 'Me', handle: 'me' },
  counts: { posts: 0, clips: 1, flash: 0, stories: 0 },
  socialCounts: { followers: 0, following: 0, pendingRequests: 0 },
  viewerCanManage: true,
};
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({
    identities: [],
    active: { id: 'profile-1', type: 'user', name: 'Me', profileType: 'personal' },
  }),
}));
jest.mock('@/shared/api/storyHooks', () => ({
  useContentProfileQuery: () => ({
    data: mockProfileSummary,
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
    jest.useFakeTimers();
    mockNavigate.mockClear();
    mockFollowMutate.mockClear();
    mockCreateOrGetChannel.mockReset();
    mockCreateOrGetChannel.mockResolvedValue({
      channelId: 'profile-channel',
      profile: { id: 'business-2', type: 'business', displayName: 'Studio', avatarUrl: 'https://cdn.example/logo.png', verified: true },
    });
    mockFollowRefs = [];
    mockProfileSummary = {
      publisher: { id: 'profile-1', type: 'personal', displayName: 'Me', handle: 'me' },
      counts: { posts: 0, clips: 1, flash: 0, stories: 0 },
      socialCounts: { followers: 0, following: 0, pendingRequests: 0 },
      viewerCanManage: true,
    };
  });

  afterEach(() => {
    ReactTestRenderer.act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
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

  it.each([
    ['personal', 'person-2'],
    ['business', 'business-2'],
  ] as const)('shows real Follow state for a public %s profile', (type, id) => {
    mockProfileSummary = {
      publisher: { id, type, displayName: type === 'business' ? 'Studio' : 'Bala', handle: null },
      counts: { posts: 0, clips: 0, flash: 0, stories: 0 },
      socialCounts: { followers: 4, following: 2, pendingRequests: 0 },
      viewerCanManage: false,
      relationship: {
        canFollow: true,
        followStatus: 'not_following',
        isFollowing: false,
        isRequested: false,
        isBlocked: false,
        canViewContent: true,
      },
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <PublisherProfileView profileType={type} profileId={id} />,
      );
    });
    const follow = renderer.root.find(
      node => node.props.accessibilityLabel === 'Follow',
    );
    ReactTestRenderer.act(() => follow.props.onPress());
    expect(mockFollowMutate.mock.calls.at(-1)?.[0]).toBe('follow');
    expect(mockFollowRefs).toEqual([
      { id: 'profile-1', type: 'personal' },
      { id, type },
    ]);
  });

  it('opens chat addressed to the displayed business profile using the active viewer profile', async () => {
    mockProfileSummary = {
      publisher: { id: 'business-2', type: 'business', displayName: 'Studio', avatarUrl: 'https://cdn.example/logo.png', verified: true },
      counts: { posts: 0, clips: 0, flash: 0, stories: 0 },
      viewerCanManage: false,
      relationship: { canFollow: true, followStatus: 'not_following', isFollowing: false, isRequested: false, isBlocked: false, canViewContent: true },
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<PublisherProfileView profileType="business" profileId="business-2" />);
    });
    const message = renderer.root.find(node => node.props.accessibilityLabel === 'Message profile');
    await ReactTestRenderer.act(async () => message.props.onPress());
    expect(mockCreateOrGetChannel).toHaveBeenCalledWith(
      { id: 'business-2', type: 'business' },
      { id: 'profile-1', type: 'personal' },
    );
    expect(mockNavigate).toHaveBeenCalledWith('Thread', expect.objectContaining({
      conversationId: 'profile-channel',
      channelId: 'profile-channel',
      profile: expect.objectContaining({ displayName: 'Studio', type: 'business' }),
    }));
  });

  it('offers Unfollow for Following and Cancel request for Requested', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockProfileSummary = {
      publisher: { id: 'person-2', type: 'personal', displayName: 'Bala', handle: null },
      counts: { posts: 0, clips: 0, flash: 0, stories: 0 },
      socialCounts: { followers: 4, following: 2, pendingRequests: 0 },
      viewerCanManage: false,
      relationship: {
        canFollow: true,
        followStatus: 'following',
        isFollowing: true,
        isRequested: false,
        isBlocked: false,
        canViewContent: true,
      },
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<PublisherProfileView profileId="person-2" />);
    });
    ReactTestRenderer.act(() =>
      renderer.root.find(node => node.props.accessibilityLabel === 'Following').props.onPress(),
    );
    const followingActions = alert.mock.calls.at(-1)?.[2] as any[];
    expect(followingActions.map(action => action.text)).toEqual(['Unfollow', 'Cancel']);
    ReactTestRenderer.act(() => followingActions[0].onPress());
    expect(mockFollowMutate.mock.calls.at(-1)?.[0]).toBe('unfollow');

    mockProfileSummary = {
      ...mockProfileSummary,
      relationship: {
        ...mockProfileSummary.relationship,
        followStatus: 'requested',
        isFollowing: false,
        isRequested: true,
        canViewContent: false,
      },
    };
    ReactTestRenderer.act(() => renderer.update(<PublisherProfileView profileId="person-2" />));
    ReactTestRenderer.act(() =>
      renderer.root.find(node => node.props.accessibilityLabel === 'Requested').props.onPress(),
    );
    const requestedActions = alert.mock.calls.at(-1)?.[2] as any[];
    expect(requestedActions.map(action => action.text)).toEqual(['Cancel request', 'Cancel']);
    alert.mockRestore();
  });

  it('updates Follow optimistically and rolls back on API failure', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockProfileSummary = {
      publisher: { id: 'private-2', type: 'personal', displayName: 'Private', handle: null },
      counts: { posts: 0, clips: 0, flash: 0, stories: 0 },
      socialCounts: { followers: 4, following: 2, pendingRequests: 0 },
      isPrivate: true,
      viewerCanManage: false,
      relationship: {
        canFollow: true,
        followStatus: 'not_following',
        isFollowing: false,
        isRequested: false,
        isBlocked: false,
        canViewContent: false,
      },
    };
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<PublisherProfileView profileId="private-2" />);
    });
    ReactTestRenderer.act(() =>
      renderer.root.find(node => node.props.accessibilityLabel === 'Follow').props.onPress(),
    );
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Requested').length).toBeGreaterThan(0);
    expect(mockFollowMutate.mock.calls[0][0]).toBe('follow');
    expect(mockFollowMutate.mock.calls[0][1]).toEqual(
      expect.objectContaining({ onError: expect.any(Function), onSuccess: expect.any(Function) }),
    );
    ReactTestRenderer.act(() => mockFollowMutate.mock.calls[0][1].onError());
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Follow').length).toBeGreaterThan(0);
    expect(alert).toHaveBeenCalledWith(
      'Couldn’t update follow',
      'Please try again.',
      expect.any(Array),
    );
    alert.mockRestore();
  });

  it('does not render social actions for owned profiles and disables them for blocked profiles', () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<PublisherProfileView />);
    });
    expect(renderer.root.findAll(node => ['Follow', 'Requested', 'Following'].includes(node.props.accessibilityLabel))).toHaveLength(0);

    mockProfileSummary = {
      ...mockProfileSummary,
      viewerCanManage: false,
      relationship: {
        canFollow: false,
        followStatus: 'blocked',
        isFollowing: false,
        isRequested: false,
        isBlocked: true,
        canViewContent: false,
      },
    };
    ReactTestRenderer.act(() => renderer.update(<PublisherProfileView profileId="blocked" />));
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Follow').length).toBeGreaterThan(0);
    expect(renderer.root.find(node => node.props.accessibilityLabel === 'Follow').props.disabled).toBe(true);
    expect(renderer.root.find(node => node.props.accessibilityLabel === 'Message profile').props.disabled).toBe(true);
  });
});
