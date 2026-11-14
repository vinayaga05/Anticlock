import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ProviderBusinessesScreen } from './ProviderBusinessesScreen';

const mockNavigate = jest.fn();
let mockApplication: any;
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }), useFocusEffect: jest.fn() }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);
jest.mock('@/shared/components/Button', () => ({ Button: ({ title, onPress, accessibilityLabel }: any) => require('react').createElement(require('react-native').Pressable, { onPress, accessibilityLabel: accessibilityLabel ?? title }) }));
jest.mock('@/shared/api/providerHooks', () => ({ useProviderApplicationsQuery: () => ({ data: [mockApplication], isLoading: false, refetch: jest.fn() }), useDeleteProviderApplicationMutation: () => ({ mutate: jest.fn(), isPending: false }) }));

let renderer: ReactTestRenderer.ReactTestRenderer;
function press(label: string) {
  const button = renderer.root.findAll(node => node.props.accessibilityLabel === label && node.props.onPress)[0];
  expect(button).toBeDefined();
  ReactTestRenderer.act(() => button.props.onPress());
}
beforeEach(() => { mockNavigate.mockReset(); mockApplication = { id: 'application-1', businessName: 'Movement studio', providerKind: 'business', status: 'approved', providerId: 'business-1', categoryIds: ['yoga'], categories: [{ id: 'yoga', name: 'Yoga' }] }; });
afterEach(() => { ReactTestRenderer.act(() => renderer.unmount()); });
test('the approved business card opens the owner storefront', () => {
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ProviderBusinessesScreen />); });
  press('Open Movement studio');
  expect(mockNavigate).toHaveBeenCalledWith('BusinessProfile', { providerId: 'business-1' });
});
test.each([
  ['draft', [], null, 'ProviderApplicationServices'],
  ['draft', ['yoga'], null, 'ProviderApplicationForm'],
  ['rejected', ['yoga'], null, 'ProviderApplicationStatus'],
  ['changes_requested', ['yoga'], null, 'ProviderApplicationStatus'],
  ['pending_review', ['yoga'], null, 'ProviderApplicationStatus'],
  ['approved', ['yoga'], null, 'ProviderApplicationStatus'],
])('the %s application card retains its existing resume or review destination', (status, categoryIds, providerId, screen) => {
  mockApplication = { ...mockApplication, status, categoryIds, providerId };
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ProviderBusinessesScreen />); });
  press('Open Movement studio');
  expect(mockNavigate).toHaveBeenCalledWith(screen, { applicationId: 'application-1' });
});
test('changes-requested Edit and resubmit still opens the owner application form', () => {
  mockApplication = { ...mockApplication, status: 'changes_requested', providerId: null };
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ProviderBusinessesScreen />); });
  press('Resume Movement studio');
  expect(mockNavigate).toHaveBeenCalledWith('ProviderApplicationForm', { applicationId: 'application-1' });
});
