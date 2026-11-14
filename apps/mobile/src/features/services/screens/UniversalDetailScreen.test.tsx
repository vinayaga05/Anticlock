import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { useMarketplaceProviderQuery } from '@/shared/api/marketplaceHooks';
import { UniversalDetailScreen } from './UniversalDetailScreen';

const mockNavigate = jest.fn();
const mockAddToCart = jest.fn();
let mockCategoryId = '';
let mockProviderActionType = 'service_request';
const providerId = '6a480af4-f63b-4f0b-a4c5-635df8a21c71';
const providerCategoryId = 'service-category-from-api';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: { entityType: 'provider', entityId: providerId, categoryId: mockCategoryId } }),
}));
jest.mock('@/shared/api/marketplaceHooks', () => ({
  isMarketplaceProviderId: () => true,
  useMarketplaceProviderQuery: jest.fn(),
}));
jest.mock('@/shared/api/hooks', () => ({ useProfileClipReelsQuery: () => ({ data: [] }) }));
jest.mock('@/shared/api/storyHooks', () => ({ useContentProfileQuery: () => ({ data: { counts: { clips: 0 } } }) }));
jest.mock('@/shared/store/cartStore', () => ({ useCartStore: (select: any) => select({ add: mockAddToCart }) }));
jest.mock('@/shared/hooks/useTheme', () => require('@/test/componentMocks').themeModule);
jest.mock('@/shared/components/AppIcon', () => require('@/test/componentMocks').appIconModule);
jest.mock('@/shared/components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/shared/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: any) => children,
}));
jest.mock('@/shared/components/Card', () => ({ Card: ({ children }: any) => children }));
jest.mock('@/features/services/components/ProviderIntroVideoSection', () => ({ ProviderIntroVideoSection: () => null }));
jest.mock('@/features/services/components/PrimaryActionBar', () => ({
  PrimaryActionBar: ({ cta, onPress }: any) => {
    const NativePressable = require('react-native').Pressable;
    return <NativePressable accessibilityLabel={cta.label} onPress={onPress} />;
  },
}));
jest.mock('@/shared/data/services', () => ({
  ...jest.requireActual('@/shared/data/services'),
  getCategory: () => undefined,
  getCourse: () => undefined, getEvent: () => undefined, getProduct: () => undefined,
}));
jest.mock('react-native-reanimated', () => {
  const ReactNativeView = require('react-native').View;
  return {
    __esModule: true, default: { View: ReactNativeView },
    FadeIn: { duration: () => ({}) },
    FadeInDown: { duration: () => ({ delay: () => ({}) }) },
  };
});
jest.mock('react-native-svg', () => {
  const NativeView = require('react-native').View;
  return { __esModule: true, default: NativeView, Defs: NativeView, LinearGradient: NativeView, Rect: NativeView, Stop: NativeView };
});

beforeEach(() => {
  mockNavigate.mockClear(); mockAddToCart.mockClear(); mockCategoryId = ''; mockProviderActionType = 'service_request';
  (useMarketplaceProviderQuery as jest.Mock).mockReset().mockReturnValue({
    data: {
      id: providerId, name: 'Plumber', categoryIds: [providerCategoryId],
      get actionType() { return mockProviderActionType; }, location: { area: '', city: '' },
      reviewCount: 0, verified: false,
    },
    isLoading: false,
  });
});

test.each([
  ['', providerCategoryId],
  ['selected-service-category', 'selected-service-category'],
])('provider request resolves route category %s to %s', (routeCategoryId, expectedCategoryId) => {
  mockCategoryId = routeCategoryId;
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<UniversalDetailScreen />); });
  expect(useMarketplaceProviderQuery).toHaveBeenCalledWith(providerId);
  const request = renderer.root.findAll(node => node.props.accessibilityLabel === 'Request service' && typeof node.props.onPress === 'function')[0];
  expect(request).toBeDefined();
  ReactTestRenderer.act(() => request!.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ServiceRequest', { categoryId: expectedCategoryId, providerId });
  ReactTestRenderer.act(() => renderer.unmount());
});

test('a retail provider without a selected product opens a real service request without adding to cart', () => {
  mockProviderActionType = 'product_purchase';
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => { renderer = ReactTestRenderer.create(<UniversalDetailScreen />); });
  const request = renderer.root.findAll(node => node.props.accessibilityLabel === 'Request service' && typeof node.props.onPress === 'function')[0];
  expect(request).toBeDefined();
  ReactTestRenderer.act(() => request.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ServiceRequest', { categoryId: providerCategoryId, providerId });
  expect(mockAddToCart).not.toHaveBeenCalled();
  ReactTestRenderer.act(() => renderer.unmount());
});
