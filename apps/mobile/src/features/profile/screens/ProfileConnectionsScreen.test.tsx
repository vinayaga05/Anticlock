import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, FlatList, Text } from 'react-native';
import { ProfileConnectionsScreen } from './ProfileConnectionsScreen';

const mockNavigate = jest.fn(),
  mockGoBack = jest.fn(),
  mockRefetch = jest.fn(),
  mockMore = jest.fn(),
  mockFollow = jest.fn(),
  mockUnfollow = jest.fn(),
  mockReset = jest.fn(),
  mockRemove = jest.fn(),
  mockRequest = jest.fn(),
  mockRequestsRefresh = jest.fn();
let mockParams = {
  profileId: 'owner',
  profileType: 'personal',
  direction: 'followers',
  displayName: 'Owner',
};
let mockList: any, mockRequests: any;
const mockViewer = { id: 'viewer', type: 'user', name: 'Viewer' };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    canGoBack: () => true,
    goBack: mockGoBack,
  }),
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: () => {},
}));
jest.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: mockViewer }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('@/shared/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: any) => children,
}));
jest.mock('@/shared/components/AppHeader', () => ({
  AppHeader: ({ title }: any) => {
    const { Text: Label } = require('react-native');
    return <Label>{title}</Label>;
  },
}));
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/Button', () => ({
  Button: ({ title, ...props }: any) => {
    const { Pressable, Text: NativeText } = require('react-native');
    return (
      <Pressable {...props} accessibilityLabel={title}>
        <NativeText>{title}</NativeText>
      </Pressable>
    );
  },
}));
jest.mock('@/shared/api/profileFollows', () => ({
  useProfileConnections: jest.fn(() => mockList),
  usePagedFollowRequests: () => mockRequests,
  followProfile: (...args: any[]) => mockFollow(...args),
  unfollowProfile: (...args: any[]) => mockUnfollow(...args),
  reconcileSocialState: () => mockReset(),
  useRemoveFollower: () => ({ mutateAsync: mockRemove }),
  useFollowRequestAction: () => ({ mutateAsync: mockRequest }),
}));
const connection = (id = 'peer') => ({
  profile: {
    id,
    type: 'personal',
    displayName: id,
    handle: `${id}_name`,
    avatarUrl: null,
    verified: false,
    businessCategory: null,
  },
  relationship: {
    canFollow: true,
    isFollowing: false,
    isRequested: false,
    canMessage: false,
  },
  canRemove: false,
});
let tree: Renderer.ReactTestRenderer;
const press = (label: string) =>
  tree.root
    .findAll(n => n.props.accessibilityLabel === label && n.props.onPress)
    .slice(-1)[0];
const render = () =>
  act(() => {
    tree = Renderer.create(<ProfileConnectionsScreen />);
  });
beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {
    profileId: 'owner',
    profileType: 'personal',
    direction: 'followers',
    displayName: 'Owner',
  };
  mockList = {
    data: {
      pages: [{ items: [connection()], nextCursor: null, isOwner: false }],
    },
    refetch: mockRefetch,
    fetchNextPage: mockMore,
    hasNextPage: false,
    isFetching: false,
    isRefetching: false,
    isLoading: false,
    isError: false,
  };
  mockRequests = {
    data: { pages: [{ items: [] }] },
    refetch: mockRequestsRefresh,
  };
  for (const fn of [
    mockFollow,
    mockUnfollow,
    mockReset,
    mockRemove,
    mockRequest,
  ])
    fn.mockResolvedValue({});
});
afterEach(() => {
  act(() => tree?.unmount());
});
test('shows the selected account, name and username; row opens that exact profile', () => {
  render();
  expect(
    tree.root.findAllByType(Text).some(n => n.props.children === '@peer_name'),
  ).toBe(true);
  act(() => press('Open peer profile').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('Profile', {
    profileId: 'peer',
    profileType: 'personal',
  });
  const hooks = require('@/shared/api/profileFollows');
  expect(hooks.useProfileConnections).toHaveBeenCalledWith(
    { id: 'owner', type: 'personal' },
    { id: 'viewer', type: 'personal' },
    'followers',
  );
  act(() => press('Following').props.onPress());
  expect(hooks.useProfileConnections).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    'following',
  );
});
test.each(['Follow', 'Following', 'Requested'])(
  '%s uses the correct follow or cancel/unfollow action',
  async label => {
    const row = connection();
    row.relationship.isFollowing = label === 'Following';
    row.relationship.isRequested = label === 'Requested';
    mockList.data.pages[0].items = [row];
    render();
    await act(async () => press(label).props.onPress());
    expect(label === 'Follow' ? mockFollow : mockUnfollow).toHaveBeenCalledWith(
      { id: 'viewer', type: 'personal' },
      row.profile,
    );
    expect(mockReset).toHaveBeenCalled();
  },
);
test('deduplicates overlapping pages and supports pagination and refresh', () => {
  mockList.data.pages.push({ items: [connection(), connection('second')] });
  mockList.hasNextPage = true;
  render();
  const list = tree.root.findByType(FlatList);
  expect(list.props.data).toHaveLength(2);
  act(() => list.props.onEndReached());
  expect(mockMore).toHaveBeenCalledTimes(1);
  act(() => list.props.onRefresh());
  expect(mockRefetch).toHaveBeenCalled();
});
test('owner can accept/decline requests and confirm removal without following the requester', async () => {
  mockList.data.pages[0].isOwner = true;
  mockList.data.pages[0].items[0].canRemove = true;
  mockRequests.data = {
    pages: [
      {
        items: [{ id: 'request-1', follower: connection('requester').profile }],
      },
    ],
  };
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render();
  await act(async () => press('Accept').props.onPress());
  expect(mockRequest).toHaveBeenCalledWith({
    action: 'accept',
    follower: mockRequests.data.pages[0].items[0].follower,
  });
  await act(async () => press('Decline').props.onPress());
  expect(mockRequest).toHaveBeenCalledWith({
    action: 'reject',
    follower: mockRequests.data.pages[0].items[0].follower,
  });
  act(() => press('Remove').props.onPress());
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => buttons.find(b => b.text === 'Remove')!.onPress!());
  expect(mockRemove).toHaveBeenCalledWith(connection().profile);
  expect(mockFollow).not.toHaveBeenCalled();
  alert.mockRestore();
});
test('error or privacy rejection hides cached rows and provides retry', () => {
  mockList.isError = true;
  mockList.error = new Error('This account’s connections are private');
  render();
  expect(press('Open peer profile')).toBeUndefined();
  act(() => press('Retry').props.onPress());
  expect(mockRefetch).toHaveBeenCalled();
});
test('empty lists give a useful state', () => {
  mockList.data.pages[0].items = [];
  render();
  expect(
    tree.root
      .findAllByType(Text)
      .some(n => n.props.children === 'No followers yet.'),
  ).toBe(true);
});
test('rapid repeated taps run only one mutation for a row', async () => {
  let finish!: () => void;
  mockFollow.mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  render();
  let first!: Promise<void>;
  act(() => {
    first = press('Follow').props.onPress();
    press('Follow').props.onPress();
  });
  expect(mockFollow).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await first;
  });
});

test('provides an explicit way back to the profile', () => {
  render();
  act(() => press('Back').props.onPress());
  expect(mockGoBack).toHaveBeenCalledTimes(1);
});
