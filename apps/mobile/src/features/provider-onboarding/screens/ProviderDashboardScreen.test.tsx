import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ProviderDashboardScreen } from './ProviderDashboardScreen';

jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/PressableScale', () => require('@/test/componentMocks').pressableScaleModule);
jest.mock('react-native-safe-area-context', () => require('@/test/componentMocks').safeAreaModule);
jest.mock('@/features/provider-onboarding/components/DateTimeFields', () => ({ DateField: () => null, TimeField: () => null, formatTimeLabel: (value: string) => value }));
jest.mock('./ProviderBusinessesScreen', () => ({ ProviderBusinessesScreen: () => null }));
jest.mock('@/shared/components/Button', () => ({
  Button: ({ title, onPress, accessibilityLabel }: any) => {
    const { Pressable, Text } = require('react-native');
    return <Pressable accessibilityLabel={accessibilityLabel ?? title} onPress={onPress}><Text>{title}</Text></Pressable>;
  },
}));

const mockNavigate = jest.fn();
const mockRefetch = jest.fn();
let mockBusiness: any;
let mockIdentities: any[];
let mockLoading = false;
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
  useRoute: () => ({ params: { providerId: 'business-2' } }),
  useFocusEffect: (effect: () => void) => effect(),
}));
jest.mock('@/shared/api/providerHooks', () => ({
  useMyBusinessQuery: () => ({ data: mockBusiness, isLoading: mockLoading, isRefetching: false, refetch: mockRefetch }),
  useUpdateMyBusinessMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useProviderBookingActionMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ identities: mockIdentities, active: { id: 'personal-1', type: 'user', profileType: 'personal' } }),
}));

function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<ProviderDashboardScreen />); });
  return renderer;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockRefetch.mockClear();
  mockLoading = false;
  mockIdentities = [{ id: 'business-2', type: 'provider', profileType: 'business', role: 'owner', name: 'Studio' }];
  mockBusiness = {
    id: 'business-2', name: 'Studio', status: 'active', avatarUrl: null,
    categories: [], counts: { services: 0, upcomingBookings: 0, totalBookings: 0 },
    profile: { description: null, contactPerson: null, mobile: null, email: null, address: null, area: null, city: null, openingTime: null, closingTime: null, pricingStartsAt: null, workingDays: [], modes: [] },
    services: [], upcomingBookings: [],
  };
});

describe('business dashboard product entry', () => {
  it('opens the product composer for the loaded active business', () => {
    const renderer = render();
    const action = renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')[0];
    expect(action).toBeDefined();
    ReactTestRenderer.act(() => action.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('CreateExploreProduct', {
      publisherProfileId: 'business-2', publisherProfileType: 'business',
    });
  });

  it.each(['suspended', 'inactive'])('hides product creation for an %s business', status => {
    mockBusiness.status = status;
    const renderer = render();
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')).toHaveLength(0);
  });

  it.each(['analyst', 'unavailable'])('hides product creation when publishing membership is %s', role => {
    mockIdentities = role === 'unavailable' ? [] : [{ ...mockIdentities[0], role }];
    const renderer = render();
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')).toHaveLength(0);
  });

  it('hides product creation when the owned business is loading or unavailable', () => {
    mockLoading = true;
    let renderer = render();
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')).toHaveLength(0);
    mockLoading = false;
    mockBusiness = undefined;
    renderer = render();
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')).toHaveLength(0);
  });

  it('does not use stale business data for a different dashboard route', () => {
    mockBusiness.id = 'another-business';
    const renderer = render();
    expect(renderer.root.findAll(node => node.props.accessibilityLabel === 'Add product for this business')).toHaveLength(0);
  });
});
