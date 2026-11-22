import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { StyleSheet, Text, TextInput } from 'react-native';
import { CommunitiesScreen } from './CommunitiesScreen';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/ScreenContainer', () => ({ ScreenContainer: ({ children }: any) => children }));
jest.mock('@/shared/components/AppHeader', () => ({ AppHeader: () => null }));
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => ({ PressableScale: ({ children, ...props }: any) => { const { Pressable } = require('react-native'); return <Pressable {...props}>{children}</Pressable>; } }));
jest.mock('@/shared/components/Button', () => ({ Button: (props: any) => { const { Pressable } = require('react-native'); return <Pressable {...props} />; } }));
jest.mock('@/shared/components/SectionHeader', () => ({ SectionHeader: ({ title }: any) => { const { Text } = require('react-native'); return <Text>{title}</Text>; } }));
jest.mock('@/features/community/components/ExploreCards', () => {
  const { Pressable, Text } = require('react-native');
  const card = (kind: string) => ({ item, onPress }: any) => <Pressable testID={`${kind}-${item.id}`} onPress={onPress}><Text>{item.title}</Text></Pressable>;
  return { ExploreEventCard: card('event'), ExploreProductCard: card('product') };
});
jest.mock('@/features/community/components/ClubChallengeCards', () => ({ ChallengeCard: () => null, DiscoverTeamCard: () => null, TeamCard: () => null }));
jest.mock('@/features/community/components/ComplaintsPanel', () => ({ ComplaintsPanel: () => { const { Text } = require('react-native'); return <Text>Shared complaints panel</Text>; } }));
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('@/shared/publishing/useActiveProfile', () => ({ useActiveProfile: () => ({ active: { id: 'user-1', type: 'user', name: 'Person' } }) }));
jest.mock('@/shared/data/community', () => ({
  useCommunityStore: (selector: any) => selector({ getMyTeams: () => [], getDiscoverTeams: () => [], joinTeam: jest.fn(), isMember: jest.fn(), joinRequests: [], challenges: [], getEligibleTeamsForChallenge: () => [] }),
  SPORT_TAGS: [], CURRENT_USER_ID: 'user-1',
}));
let mockEventQuery: any; let mockProductQuery: any;
jest.mock('@/shared/api/exploreHooks', () => ({ useExploreEventsQuery: () => mockEventQuery, useMyExploreEventsQuery: () => ({ data: { events: [] } }) }));
jest.mock('@/shared/api/shopHooks', () => ({ useExploreProductsQuery: () => mockProductQuery, useMyProductsQuery: () => ({ data: { products: [] } }) }));
function render() { let renderer!: ReactTestRenderer.ReactTestRenderer; ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<CommunitiesScreen />); }); return renderer; }
function action(renderer: ReactTestRenderer.ReactTestRenderer, label: string) { return renderer.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0]; }
beforeEach(() => {
  mockNavigate.mockReset(); mockEventQuery = { data: { events: [] }, isLoading: false, error: null, refetch: jest.fn() }; mockProductQuery = { data: { products: [] }, isLoading: false, error: null, refetch: jest.fn() };
});

test.each(['empty', 'loading', 'error', 'search'])('Events heading create action remains available in %s state without a bottom FAB', state => {
  mockEventQuery.isLoading = state === 'loading'; mockEventQuery.error = state === 'error' ? new Error('offline') : null;
  const renderer = render();
  if (state === 'search') ReactTestRenderer.act(() => renderer.root.findByType(TextInput).props.onChangeText('no results'));
  const create = action(renderer, 'Create event');
  expect(StyleSheet.flatten(create.props.style)).toEqual(expect.objectContaining({ width: 44, height: 44 }));
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Events')).toBe(true);
  expect(action(renderer, 'Create event or product')).toBeUndefined();
  ReactTestRenderer.act(() => create.props.onPress()); expect(mockNavigate).toHaveBeenCalledWith('CreateExploreEvent');
  const product = renderer.root.findAll(node => node.props.title === 'Create used product' && node.props.onPress)[0];
  ReactTestRenderer.act(() => product.props.onPress()); expect(mockNavigate).toHaveBeenCalledWith('CreateExploreProduct');
  ReactTestRenderer.act(() => renderer.unmount());
});

test('Complaints is a fourth Nexus mode that opens the shared list', () => {
  const renderer = render();
  ReactTestRenderer.act(() => action(renderer, 'Complaints').props.onPress());
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Shared complaints panel')).toBe(true);
  expect(action(renderer, 'Create event')).toBeUndefined();
  ReactTestRenderer.act(() => renderer.unmount());
});

test('Used products filters the existing product catalog and retains product detail navigation', () => {
  mockEventQuery.data.events = [{ id: 'event-1', title: 'Community meetup', startsAt: '2026-12-01T10:00:00Z', media: [], publisher: { displayName: 'Organiser' }, price: 0, reviewStatus: 'approved' }];
  mockProductQuery.data.products = [{ id: 'product-1', name: 'Exercise bike', images: [], price: 12_000, reviewStatus: 'approved' }];
  const renderer = render();
  ReactTestRenderer.act(() => action(renderer, 'Used products').props.onPress());
  expect(action(renderer, 'Products')).toBeUndefined();
  expect(renderer.root.findAll(node => node.props.testID === 'event-event-1')).toHaveLength(0);
  const product = renderer.root.findAll(node => node.props.testID === 'product-product-1' && node.props.onPress)[0];
  ReactTestRenderer.act(() => product.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ProductDetail', { productId: 'product-1' });
  ReactTestRenderer.act(() => renderer.unmount());
});

test.each(['loading', 'error', 'search'])('News has its own empty state during %s and does not show listing actions or content', state => {
  mockEventQuery.isLoading = mockProductQuery.isLoading = state === 'loading';
  mockEventQuery.error = mockProductQuery.error = state === 'error' ? new Error('offline') : null;
  const renderer = render();
  if (state === 'search') ReactTestRenderer.act(() => renderer.root.findByType(TextInput).props.onChangeText('bike'));
  ReactTestRenderer.act(() => action(renderer, 'News').props.onPress());
  const labels = renderer.root.findAllByType(Text).map(node => node.props.children);
  expect(labels).toContain('No news yet');
  expect(labels).not.toContain('Loading Explore…');
  expect(labels).not.toContain('Could not load Explore.');
  expect(labels).not.toContain('Your submissions');
  expect(action(renderer, 'Create event')).toBeUndefined();
  expect(action(renderer, 'Following')).toBeUndefined();
  expect(renderer.root.findAll(node => node.props.title === 'Create used product')).toHaveLength(0);
  expect(renderer.root.findAllByType(TextInput)).toHaveLength(0);
  ReactTestRenderer.act(() => action(renderer, 'All').props.onPress());
  expect(renderer.root.findByType(TextInput).props.value).toBe(state === 'search' ? 'bike' : '');
  expect(action(renderer, 'Create event')).toBeDefined();
  ReactTestRenderer.act(() => renderer.unmount());
});

test.each(['loading', 'error'])('Used products is not blocked by an inactive Events %s state', state => {
  mockEventQuery.isLoading = state === 'loading';
  mockEventQuery.error = state === 'error' ? new Error('offline') : null;
  mockProductQuery.data.products = [{ id: 'product-1', name: 'Exercise bike', images: [], price: 12_000, reviewStatus: 'approved' }];
  const renderer = render();
  ReactTestRenderer.act(() => action(renderer, 'Used products').props.onPress());
  expect(renderer.root.findAllByType(Text).some(node => node.props.children === 'Exercise bike')).toBe(true);
  expect(action(renderer, 'Create event')).toBeUndefined();
  ReactTestRenderer.act(() => renderer.unmount());
});
