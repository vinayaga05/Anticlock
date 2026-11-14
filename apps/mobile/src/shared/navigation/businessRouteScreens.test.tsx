import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ProfileRouteScreen, UniversalDetailRouteScreen } from './businessRouteScreens';

const mockReplace = jest.fn();
let mockParams: any;
let mockActive: any;
const providerId = '93ee79ba-5655-439a-9826-91515290dd7b';
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: mockReplace }), useRoute: () => ({ params: mockParams }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({ useActiveProfile: () => ({ active: mockActive }) }));
jest.mock('@/features/profile/screens/UserProfileScreen', () => ({ UserProfileScreen: () => null }));
jest.mock('@/features/services/screens/UniversalDetailScreen', () => ({ UniversalDetailScreen: () => null }));
import { UserProfileScreen } from '@/features/profile/screens/UserProfileScreen';
import { UniversalDetailScreen } from '@/features/services/screens/UniversalDetailScreen';

beforeEach(() => { mockReplace.mockClear(); mockParams = undefined; mockActive = null; });

function render(component: React.ReactElement) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(component); });
  return renderer;
}

test('legacy business Profile cannot render the old social page', () => {
  mockParams = { profileType: 'business', profileId: providerId };
  const renderer = render(<ProfileRouteScreen />);
  expect(mockReplace).toHaveBeenCalledWith('BusinessProfile', { providerId });
  expect(renderer.root.findAllByType(UserProfileScreen)).toHaveLength(0);
  ReactTestRenderer.act(() => renderer.unmount());
});
test('a default profile entry follows the active business but explicit personal links stay personal', () => {
  mockActive = { type: 'provider', id: providerId };
  const business = render(<ProfileRouteScreen />);
  expect(mockReplace).toHaveBeenCalledWith('BusinessProfile', { providerId });
  ReactTestRenderer.act(() => business.unmount()); mockReplace.mockClear();
  mockParams = { profileType: 'personal', profileId: 'user-1' };
  const personal = render(<ProfileRouteScreen />);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(personal.root.findAllByType(UserProfileScreen)).toHaveLength(1);
  ReactTestRenderer.act(() => personal.unmount());
});
test('legacy approved-provider Details links redirect while demo fixtures retain Details', () => {
  mockParams = { entityType: 'provider', entityId: providerId, categoryId: 'category' };
  const business = render(<UniversalDetailRouteScreen />);
  expect(mockReplace).toHaveBeenCalledWith('BusinessProfile', { providerId, categoryId: 'category' });
  expect(business.root.findAllByType(UniversalDetailScreen)).toHaveLength(0);
  ReactTestRenderer.act(() => business.unmount()); mockReplace.mockClear();
  mockParams = { entityType: 'provider', entityId: 'demo-provider', categoryId: 'category' };
  const demo = render(<UniversalDetailRouteScreen />);
  expect(mockReplace).not.toHaveBeenCalled();
  expect(demo.root.findAllByType(UniversalDetailScreen)).toHaveLength(1);
  ReactTestRenderer.act(() => demo.unmount());
});
