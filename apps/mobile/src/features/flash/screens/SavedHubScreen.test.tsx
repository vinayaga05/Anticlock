import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { SavedHubScreen } from './SavedHubScreen';
import { Card } from '@/shared/components/Card';

const mockNavigate = jest.fn(), mockRemove = jest.fn(), mockFetchNext = jest.fn(), mockRefetch = jest.fn();
let mockBusinesses: any;
let mockRemoveError: Error | null;
const providerId = 'ed3b2a59-3ab7-49bd-b557-d74294a01ed4';
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate }) }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('@/shared/components/ScreenContainer', () => ({ ScreenContainer: ({ children }: any) => children }));
jest.mock('@/shared/components/Card', () => ({ Card: ({ children, onPress }: any) => require('react').createElement(require('react-native').Pressable, { onPress }, children) }));
jest.mock('@/shared/components/EmptyState', () => ({ EmptyState: ({ title, description }: any) => require('react').createElement(require('react-native').Text, {}, `${title} ${description}`) }));
jest.mock('@/shared/components/Button', () => ({ Button: ({ title, onPress, disabled, loading }: any) => require('react').createElement(require('react-native').Pressable, { accessibilityLabel: title, onPress, disabled: disabled || loading }, require('react').createElement(require('react-native').Text, {}, title)) }));
jest.mock('@/shared/services/engagementRepository', () => ({ useEngagementStore: (select: any) => select({ saved: [], unsaveContent: jest.fn() }) }));
jest.mock('@/shared/publishing/useActiveProfile', () => ({ useActiveProfile: () => ({ active: { id: 'viewer-business', type: 'provider', name: 'Viewer' } }) }));
jest.mock('@/shared/api/exploreHooks', () => ({ useSavedExploreEventsQuery: () => ({ data: { events: [] }, refetch: mockRefetch }) }));
jest.mock('@/shared/api/shopHooks', () => ({ useSavedProductsQuery: () => ({ data: { products: [] }, refetch: mockRefetch }) }));
jest.mock('@/shared/api/client', () => ({ apiRequest: jest.fn() }));
jest.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: jest.fn() }), useQueryClient: () => ({ invalidateQueries: jest.fn() }) }));
jest.mock('@/features/business-profile/businessSavedHooks', () => ({
  useSavedBusinessesQuery: () => mockBusinesses,
  useUnsaveBusinessMutation: () => ({ mutate: mockRemove, error: mockRemoveError, isPending: false }),
}));

let renderer: ReactTestRenderer.ReactTestRenderer;
function render() { ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<SavedHubScreen />); }); }
function text() { return renderer.root.findAllByType(Text).flatMap(node => [node.props.children].flat(Infinity)).filter(value => typeof value === 'string').join(' '); }
function actions(label: string) { return renderer.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress); }
function press(label: string) { const target = actions(label)[0]; expect(target).toBeDefined(); ReactTestRenderer.act(() => target.props.onPress()); }
beforeEach(() => {
  mockNavigate.mockReset(); mockRemove.mockReset(); mockFetchNext.mockReset(); mockRefetch.mockReset(); mockRemoveError = null;
  mockBusinesses = { data: { pages: [{ businesses: [{ id: providerId, name: 'Saved studio', categoryLabel: 'Yoga', city: 'Chennai', area: 'Adyar', avatarUrl: null, coverUrl: 'https://example.test/cover.png', savedAt: '2026-11-14T00:00:00Z' }] }] }, hasNextPage: false, isFetching: false, fetchNextPage: mockFetchNext, refetch: mockRefetch };
});
afterEach(() => { ReactTestRenderer.act(() => renderer.unmount()); });

test('saved businesses appear in All and the Businesses bucket and open their dedicated storefront', () => {
  render(); expect(text()).toContain('Saved studio'); press('Businesses');
  expect(text()).toContain('Yoga · Adyar, Chennai');
  ReactTestRenderer.act(() => renderer.root.findAllByType(Card)[0].props.onPress!());
  expect(mockNavigate).toHaveBeenCalledWith('BusinessProfile', { providerId });
});
test('business Remove sends an unsave request and exposes retryable failures', () => {
  mockRemoveError = new Error('Offline'); render(); press('Remove Saved studio');
  expect(mockRemove).toHaveBeenCalledWith(providerId); expect(text()).toContain('Try Remove again');
});
test('business pagination uses the server page state and does not cancel an active refresh', () => {
  mockBusinesses.hasNextPage = true; render(); press('More saved businesses'); expect(mockFetchNext).toHaveBeenCalledWith({ cancelRefetch: false });
  mockFetchNext.mockClear(); mockBusinesses = { ...mockBusinesses, isFetching: true };
  ReactTestRenderer.act(() => renderer.update(<SavedHubScreen />));
  expect(actions('More saved businesses')[0].props.disabled).toBe(true); press('More saved businesses'); expect(mockFetchNext).not.toHaveBeenCalled();
});
test('business list failures have an explicit retry and the empty state explains saving', () => {
  mockBusinesses = { ...mockBusinesses, data: undefined, isError: true, error: new Error('Offline') }; render(); press('Businesses'); press('Retry saved businesses'); expect(mockRefetch).toHaveBeenCalled();
  expect(text()).toContain('Pull down to retry');
  mockBusinesses = { ...mockBusinesses, isError: false, error: null }; ReactTestRenderer.act(() => renderer.update(<SavedHubScreen />));
  expect(text()).toContain('Save an approved business from its profile');
});
