import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Share, Text, StatusBar } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { BusinessProfileScreen } from './BusinessProfileScreen';
import { ApiError } from '@/shared/api/client';
import {
  businessFixture,
  BUSINESS_ID as mockBusinessId,
  CUSTOMER_ID as mockCustomerId,
} from '../businessProfileFixture';

const mockInvalidate = jest.fn();
const mockNavigate = jest.fn();
const mockBack = jest.fn();
const mockRefetch = jest.fn();
const mockSave = jest.fn();
const mockFollow = jest.fn();
const mockMessage = jest.fn();
const mockBlock = jest.fn();
const mockReport = jest.fn();
let mockRouteId = mockBusinessId;
let mockCurrentUser = mockCustomerId;
let mockActive = {
  id: mockCustomerId,
  type: 'user' as 'user' | 'provider',
  name: 'Customer',
};
let mockBusiness = businessFixture();
let mockError: Error | null = null;
let mockLoading = false;
let mockMode: 'light' | 'dark' = 'light';
let mockGuest = false;
let mockClips: any[] = [];
jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockBack,
    canGoBack: () => true,
  }),
  useRoute: () => ({ params: { providerId: mockRouteId } }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 20 }),
}));
jest.mock('@/shared/context/AuthProvider', () => ({
  useAuth: () => ({
    user: { id: mockGuest ? 'temporary-guest' : mockCurrentUser },
    logout: jest.fn(),
  }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({
    active: mockActive,
    identities: [{ id: mockCustomerId, type: 'user', name: 'Customer' }],
  }),
}));
jest.mock('@/shared/api/profileFollows', () => ({
  useProfileFollowMutation: () => ({
    mutateAsync: mockFollow,
    isPending: false,
  }),
  blockProfile: (...args: any[]) => mockBlock(...args),
}));
jest.mock('@/shared/api/messagesClient', () => ({
  createOrGetChannel: (...args: any[]) => mockMessage(...args),
}));
jest.mock('@/shared/providers/StreamChatProvider', () => ({
  useStreamChat: () => ({ isReady: true }),
}));
jest.mock('@/shared/api/hooks', () => ({
  useProfileClipReelsQuery: () => ({
    data: mockClips,
    refetch: mockRefetch,
    isLoading: false,
  }),
}));
jest.mock('../businessProfileHooks', () => ({
  useBusinessProfileQuery: () => ({
    data: mockBusiness,
    error: mockError,
    isError: !!mockError,
    isLoading: mockLoading,
    refetch: mockRefetch,
  }),
  useBusinessReviewsQuery: () => ({
    data: { pages: [{ reviews: [], eligibleBookings: [] }] },
    refetch: mockRefetch,
  }),
  useSaveBusinessMutation: () => ({ mutateAsync: mockSave }),
  useReportBusinessMutation: () => ({ mutateAsync: mockReport }),
  useCreateBusinessReviewMutation: () => ({ mutateAsync: jest.fn() }),
}));
jest.mock('@/shared/hooks/useTheme', () => ({
  useTheme: () => {
    const themes = require('@/shared/theme');
    return mockMode === 'dark' ? themes.darkTheme : themes.lightTheme;
  },
}));
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/Skeleton', () => ({
  Skeleton: (props: any) =>
    require('react').createElement('preview-skeleton', props),
}));
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));
jest.mock('react-native-maps', () => {
  const View = require('react-native').View;
  return { __esModule: true, default: View, Marker: View };
});
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Circle: View,
    Defs: View,
    LinearGradient: View,
    Path: View,
    Rect: View,
    Stop: View,
  };
});
jest.mock('../components/BusinessMediaViewer', () => ({
  BusinessMediaViewer: () => null,
}));
jest.mock('../components/BusinessReviewComposer', () => ({
  BusinessReviewComposer: () => null,
}));
jest.mock('../businessLocation', () => ({ locateBusinessViewer: jest.fn() }));

let renderer: ReactTestRenderer.ReactTestRenderer;
const render = () =>
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<BusinessProfileScreen />);
  });
const textOf = (value: any): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : Array.isArray(value)
    ? value.map(textOf).join('')
    : value?.props
    ? textOf(value.props.children)
    : '';
const renderedText = () =>
  renderer.root
    .findAllByType(Text)
    .map(node => textOf(node.props.children))
    .join(' ');
const actions = (label: string) =>
  renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === label &&
      typeof node.props.onPress === 'function',
  );
const press = async (label: string) => {
  const action = actions(label)[0];
  expect(action).toBeDefined();
  await ReactTestRenderer.act(async () => {
    await action!.props.onPress();
  });
};
beforeEach(() => {
  mockRouteId = mockBusinessId;
  mockCurrentUser = mockCustomerId;
  mockActive = { id: mockCustomerId, type: 'user', name: 'Customer' };
  mockBusiness = businessFixture();
  mockError = null;
  mockLoading = false;
  mockMode = 'light';
  mockGuest = false;
  mockClips = [];
  for (const fn of [
    mockNavigate,
    mockBack,
    mockRefetch,
    mockSave,
    mockFollow,
    mockMessage,
    mockBlock,
    mockReport,
  ])
    fn.mockReset();
  mockRefetch.mockResolvedValue({});
  mockSave.mockResolvedValue({ saved: true });
  mockFollow.mockResolvedValue({});
  mockBlock.mockResolvedValue({});
  mockMessage.mockResolvedValue({
    channelId: 'business-channel',
    profile: { id: mockBusinessId, type: 'business' },
  });
});
afterEach(() => {
  if (renderer) ReactTestRenderer.act(() => renderer.unmount());
  jest.restoreAllMocks();
});

test('customer storefront has a real contextual booking action and no owner controls', async () => {
  render();
  expect(
    renderer.root.findAllByProps({ testID: 'business-owner-controls' }),
  ).toHaveLength(0);
  await press('Book now');
  expect(mockNavigate).toHaveBeenCalledWith('BusinessBooking', {
    providerId: mockBusinessId,
    categoryId: 'yoga-service',
  });
  expect(actions('Edit profile')).toHaveLength(0);
  expect(actions('Manage services')).toHaveLength(0);
});
test('owner actions follow server capabilities and preserve the business publishing identity', async () => {
  mockBusiness = businessFixture({
    viewer: {
      ...mockBusiness.viewer,
      role: 'owner',
      isOwner: true,
      canManage: true,
      canEditServices: true,
      canViewAnalytics: true,
      canPublish: true,
    },
  });
  render();
  expect(
    renderer.root.findAllByProps({ testID: 'business-owner-controls' }).length,
  ).toBeGreaterThan(0);
  await press('Edit profile');
  expect(mockNavigate).toHaveBeenLastCalledWith('BusinessManage', {
    providerId: mockBusinessId,
    section: 'profile',
  });
  await press('Manage services');
  expect(mockNavigate).toHaveBeenLastCalledWith('BusinessManage', {
    providerId: mockBusinessId,
    section: 'services',
  });
  await press('Add Clip');
  expect(mockNavigate).toHaveBeenLastCalledWith('ClipComposer', {
    publisherProfileId: mockBusinessId,
    publisherProfileType: 'business',
  });
  await press('Add Product');
  expect(mockNavigate).toHaveBeenLastCalledWith('CreateExploreProduct', {
    publisherProfileId: mockBusinessId,
    publisherProfileType: 'business',
  });
  await press('Add Event');
  expect(mockNavigate).toHaveBeenLastCalledWith('CreateExploreEvent', {
    publisherProfileId: mockBusinessId,
    publisherProfileType: 'business',
  });
});
test('analysts cannot see publishing or edit controls', () => {
  mockBusiness = businessFixture({
    viewer: { ...mockBusiness.viewer, role: 'analyst', canViewAnalytics: true },
  });
  render();
  expect(actions('Analytics').length).toBeGreaterThan(0);
  expect(actions('Add Clip')).toHaveLength(0);
  expect(actions('Edit profile')).toHaveLength(0);
  expect(actions('Manage services')).toHaveLength(0);
});
test('approved products and events use their exact detail destinations', async () => {
  mockBusiness = businessFixture({
    products: [
      {
        id: 'product-1',
        name: 'Movement mat',
        price: 1200,
        inventory: 3,
        imageUrl: null,
      },
    ],
    events: [
      {
        id: 'event-1',
        title: 'A morning of movement',
        startsAt: '2026-11-25T03:30:00Z',
        endsAt: null,
        price: 500,
        currency: 'INR',
        imageUrl: null,
        locationLabel: 'Studio',
      },
    ],
  });
  render();
  await press('View Movement mat');
  expect(mockNavigate).toHaveBeenLastCalledWith('ProductDetail', {
    productId: 'product-1',
  });
  await press('View A morning of movement');
  expect(mockNavigate).toHaveBeenLastCalledWith('EventDetail', {
    eventId: 'event-1',
  });
});
test('Clips start with this provider and category exploration stays explicit', async () => {
  mockClips = [{ id: 'clip-1', caption: 'Practice with us', posterUrl: '' }];
  render();
  await press('Play Lotus Movement Studio Clip');
  expect(mockNavigate).toHaveBeenLastCalledWith('ProviderClips', {
    providerId: mockBusinessId,
    providerName: mockBusiness.name,
    serviceCategoryId: 'yoga-service',
    reelId: 'clip-1',
  });
  await press('Explore Clips from this service category');
  expect(mockNavigate).toHaveBeenLastCalledWith('ProviderClips', {
    providerId: mockBusinessId,
    providerName: mockBusiness.name,
    serviceCategoryId: 'yoga-service',
    exploreSimilar: true,
  });
});
test('follow, save and chat use the server and canonical business identity', async () => {
  render();
  await press('Follow');
  expect(mockFollow).toHaveBeenCalledWith('follow');
  expect(mockRefetch).toHaveBeenCalled();
  await press('Save business');
  expect(mockSave).toHaveBeenCalledWith(true);
  await press('Message');
  expect(mockMessage).toHaveBeenCalledWith(
    { id: mockBusinessId, type: 'business' },
    { id: mockCustomerId, type: 'personal' },
  );
  expect(mockNavigate).toHaveBeenLastCalledWith(
    'Thread',
    expect.objectContaining({ channelId: 'business-channel' }),
  );
});
test('failed chat keeps the viewer on the storefront and exposes an error', async () => {
  mockMessage.mockRejectedValue(new Error('Messaging unavailable'));
  render();
  await press('Message');
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(renderedText()).toContain('Messaging unavailable');
});
test('copy/share and blocking work from the more menu with this profile identity', async () => {
  const share = jest
    .spyOn(Share, 'share')
    .mockResolvedValue({ action: Share.sharedAction });
  const alert = jest.spyOn(Alert, 'alert');
  render();
  await press('Share business profile');
  expect(share).toHaveBeenCalledWith(
    expect.objectContaining({
      message: expect.stringContaining(`/business/${mockBusinessId}`),
    }),
  );
  await press('More business options');
  await press('Copy profile link');
  expect(Clipboard.setString).toHaveBeenCalledWith(
    `https://anticlock.online/business/${mockBusinessId}`,
  );
  await press('More business options');
  await press('Block business');
  const options = alert.mock.calls.at(-1)?.[2];
  await ReactTestRenderer.act(async () => {
    await options?.find(item => item.text === 'Block business')?.onPress?.();
    await Promise.resolve();
  });
  expect(mockBlock).toHaveBeenCalledWith(
    { id: mockCustomerId, type: 'personal' },
    { id: mockBusinessId, type: 'business' },
  );
  expect(mockBack).toHaveBeenCalled();
});
test('loading, missing media, empty content and dark mode have intentional states', () => {
  mockLoading = true;
  render();
  expect(
    renderer.root.findAllByProps({ testID: 'business-profile-loading' }).length,
  ).toBeGreaterThan(0);
  ReactTestRenderer.act(() => renderer.unmount());
  mockLoading = false;
  mockMode = 'dark';
  mockBusiness = businessFixture({ services: [], gallery: [] });
  render();
  const text = renderedText();
  expect(text).toContain('No services available');
  expect(text).toContain('There are no verified customer reviews yet.');
  expect(
    renderer.root.findAllByProps({ testID: 'business-logo-fallback' }).length,
  ).toBeGreaterThan(0);
});
test.each([403, 404])(
  'a %s response hides even previously cached business data',
  status => {
    mockError = new ApiError(status, 'unavailable', 'Unavailable');
    render();
    expect(
      renderer.root.findAllByProps({ testID: 'business-profile-error' }).length,
    ).toBeGreaterThan(0);
    expect(renderedText()).not.toContain('Lotus Movement Studio');
    expect(actions('Book now')).toHaveLength(0);
  },
);
test('temporarily unavailable services cannot be booked', () => {
  mockBusiness = businessFixture({
    availability: {
      ...mockBusiness.availability,
      temporarilyUnavailable: true,
      operatingStatus: 'temporarily_unavailable',
    },
  });
  render();
  expect(actions('Book now')[0].props.disabled).toBe(true);
  expect(renderedText()).toContain('Temporarily unavailable');
});

test('content creator footer opens publishing rather than a forbidden management screen', async () => {
  mockBusiness = businessFixture({
    viewer: {
      ...mockBusiness.viewer,
      role: 'content_creator',
      canPublish: true,
    },
  });
  render();
  const footer = renderer.root.findAllByProps({
    testID: 'business-booking-footer',
  })[0];
  const add = footer.findAll(
    node =>
      node.props.accessibilityLabel === 'Add Clip' &&
      typeof node.props.onPress === 'function',
  )[0];
  await ReactTestRenderer.act(async () => {
    add.props.onPress();
  });
  expect(mockNavigate).toHaveBeenLastCalledWith('ClipComposer', {
    publisherProfileId: mockBusinessId,
    publisherProfileType: 'business',
  });
});

test('a pending chat cannot navigate after the viewer profile changes', async () => {
  let confirm!: (result: any) => void;
  mockMessage.mockReturnValue(
    new Promise(resolve => {
      confirm = resolve;
    }),
  );
  render();
  ReactTestRenderer.act(() => {
    actions('Message')[0].props.onPress();
  });
  mockActive = {
    id: 'another-owned-business',
    type: 'provider',
    name: 'Other business',
  };
  ReactTestRenderer.act(() => renderer.update(<BusinessProfileScreen />));
  await ReactTestRenderer.act(async () => {
    confirm({
      channelId: 'old-channel',
      profile: { id: mockBusinessId, type: 'business' },
    });
    await Promise.resolve();
  });
  expect(mockNavigate).not.toHaveBeenCalled();
});

test('report drafts reset when a different business is opened', async () => {
  render();
  await press('More business options');
  await press('Report business');
  ReactTestRenderer.act(() => {
    renderer.root
      .findAll(
        node =>
          node.props.accessibilityLabel === 'Business report details' &&
          typeof node.props.onChangeText === 'function',
      )[0]
      .props.onChangeText('Draft belonging to the first business');
  });
  mockRouteId = 'second-business';
  mockBusiness = businessFixture({ id: mockRouteId, name: 'Second business' });
  ReactTestRenderer.act(() => renderer.update(<BusinessProfileScreen />));
  await press('More business options');
  await press('Report business');
  const details = renderer.root.findAll(
    node =>
      node.props.accessibilityLabel === 'Business report details' &&
      typeof node.props.onChangeText === 'function',
  )[0];
  expect(details.props.value).toBe('');
});

test('cover and scrolled toolbar keep navigation and status text legible', () => {
  render();
  expect(renderer.root.findByType(StatusBar).props.barStyle).toBe(
    'light-content',
  );
  const mainScroll = renderer.root.findAll(
    node => typeof node.props.onScroll === 'function',
  )[0];
  ReactTestRenderer.act(() => {
    mainScroll.props.onScroll({ nativeEvent: { contentOffset: { y: 400 } } });
  });
  expect(
    renderer.root.findAllByProps({ testID: 'business-compact-header' }).length,
  ).toBeGreaterThan(0);
  expect(renderer.root.findByType(StatusBar).props.barStyle).toBe(
    'dark-content',
  );
});
