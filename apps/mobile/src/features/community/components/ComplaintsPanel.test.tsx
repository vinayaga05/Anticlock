import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { ComplaintsPanel } from './ComplaintsPanel';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/Card', () => ({ Card: ({ children }: any) => children }));
jest.mock('@/shared/components/Button', () => ({ Button: (props: any) => { const { Pressable } = require('react-native'); return <Pressable {...props} />; } }));
let mockUser: any = { id: 'user-1' };
const mockLogout = jest.fn(); const mockNavigate = jest.fn(); const mockRefetch = jest.fn(); const mockNext = jest.fn();
jest.mock('@/shared/context/AuthProvider', () => ({ useAuth: () => ({ user: mockUser, logout: mockLogout }) }));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: any) => require('react').useEffect(callback, [callback]),
}));
let mockQuery: any;
const mockUseQuery = jest.fn();
jest.mock('@/shared/api/complaintHooks', () => ({ useComplaintsQuery: (enabled: boolean) => { mockUseQuery(enabled); return mockQuery; } }));
const complaint = (id: string, createdAt: string) => ({ id, createdAt, title: `Issue ${id}`, description: `Complete description for ${id}. It must remain visible without truncation.`, author: { id: `author-${id}`, displayName: `Author ${id}`, avatarUrl: null } });
const first = complaint('first', '2026-11-12T00:00:00.000Z'); const newest = complaint('newest', '2026-11-13T00:00:00.000Z');
function button(renderer: ReactTestRenderer.ReactTestRenderer, title: string) { return renderer.root.findAll(node => node.props.title === title && node.props.onPress)[0]; }
function render() { let renderer!: ReactTestRenderer.ReactTestRenderer; ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ComplaintsPanel />); }); return renderer; }
function texts(renderer: ReactTestRenderer.ReactTestRenderer) { return renderer.root.findAllByType(Text).map(node => [node.props.children].flat().join('')); }
beforeEach(() => {
  mockUser = { id: 'user-1' }; mockLogout.mockReset(); mockNavigate.mockReset(); mockRefetch.mockReset(); mockNext.mockReset(); mockUseQuery.mockReset();
  mockQuery = { data: { pages: [{ complaints: [first, newest], nextCursor: 'next' }] }, isLoading: false, isError: false, hasNextPage: true, isFetchingNextPage: false, refetch: mockRefetch, fetchNextPage: mockNext };
});

test('shows shared complaints newest first with author, date and full description', () => {
  const renderer = render(); const content = texts(renderer);
  expect(content.indexOf('Issue newest')).toBeLessThan(content.indexOf('Issue first'));
  expect(content).toContain(newest.description);
  expect(content.some(value => value.includes('Author newest'))).toBe(true);
  const description = renderer.root.findAllByType(Text).find(node => node.props.children === newest.description)!;
  expect(description.props.numberOfLines).toBeUndefined();
  expect(mockRefetch).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => button(renderer, 'Add complaint').props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('CreateComplaint');
  ReactTestRenderer.act(() => renderer.unmount());
});

test('refreshes and paginates the real list and retains existing rows on page failure', () => {
  mockQuery.isFetchNextPageError = true;
  const renderer = render();
  ReactTestRenderer.act(() => button(renderer, 'Refresh complaints').props.onPress());
  ReactTestRenderer.act(() => button(renderer, 'Retry loading more').props.onPress());
  expect(mockRefetch).toHaveBeenCalledTimes(2); expect(mockNext).toHaveBeenCalledTimes(1);
  expect(texts(renderer)).toContain('Issue newest');
  ReactTestRenderer.act(() => renderer.unmount());
});

test('distinguishes loading, request failure and empty results while keeping Add complaint', () => {
  mockQuery.data = undefined; mockQuery.isLoading = true;
  const renderer = render(); expect(texts(renderer)).toContain('Loading complaints…'); expect(button(renderer, 'Add complaint')).toBeDefined();
  mockQuery = { ...mockQuery, isLoading: false, isError: true };
  ReactTestRenderer.act(() => renderer.update(<ComplaintsPanel />));
  expect(texts(renderer)).toContain('Could not load complaints. Please try again.');
  expect(texts(renderer)).not.toContain('No complaints yet. Add the first complaint.');
  ReactTestRenderer.act(() => button(renderer, 'Retry complaints').props.onPress());
  mockQuery = { ...mockQuery, isError: false, data: { pages: [{ complaints: [], nextCursor: null }] } };
  ReactTestRenderer.act(() => renderer.update(<ComplaintsPanel />));
  expect(texts(renderer)).toContain('No complaints yet. Add the first complaint.');
  ReactTestRenderer.act(() => renderer.unmount());
});

test('suppresses cached complaints for guests and does not request a list', () => {
  mockUser = { id: 'temporary-guest' };
  const renderer = render();
  expect(mockUseQuery).toHaveBeenCalledWith(false); expect(mockRefetch).not.toHaveBeenCalled();
  expect(texts(renderer)).not.toContain('Issue newest');
  expect(renderer.root.findAll(node => node.props.title === 'Add complaint')).toHaveLength(0);
  ReactTestRenderer.act(() => button(renderer, 'Sign in').props.onPress()); expect(mockLogout).toHaveBeenCalledTimes(1);
  ReactTestRenderer.act(() => renderer.unmount());
});

test('loading more cannot cancel an active refresh that is fetching newly posted complaints', () => {
  mockQuery.isFetching = true; mockQuery.isRefetching = true;
  const renderer = render();
  expect(button(renderer, 'Load more complaints').props.disabled).toBe(true);
  ReactTestRenderer.act(() => button(renderer, 'Load more complaints').props.onPress());
  expect(mockNext).not.toHaveBeenCalled();
  mockQuery = { ...mockQuery, isRefetching: false, isFetchingNextPage: true };
  ReactTestRenderer.act(() => renderer.update(<ComplaintsPanel />));
  expect(button(renderer, 'Refresh complaints').props.disabled).toBe(true);
  ReactTestRenderer.act(() => renderer.unmount());
});
