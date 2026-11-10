import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Image, ScrollView } from 'react-native';
import { ShopScreen } from './ShopScreen';
import {
  getPublishedShopCategories,
  getShopCategoryArtworkKey,
  getShopCategoryColumns,
  resolveShopCategoryFilter,
} from './shopLayout';

jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/AppIcon',
  () => require('@/test/componentMocks').appIconModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/ScreenContainer', () => ({
  ScreenContainer: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return (
      <View testID="shop-screen-container" {...props}>
        {children}
      </View>
    );
  },
}));
jest.mock('@/shared/components/AppHeader', () => ({
  AppHeader: () => {
    const { View } = require('react-native');
    return <View testID="shop-app-header" />;
  },
}));
jest.mock('@/shared/components/SearchBar', () => ({ SearchBar: () => null }));
jest.mock('@/shared/components/Card', () => ({
  Card: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));
jest.mock('@/shared/components/Button', () => ({
  Button: (props: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable {...props}>
        <Text>{props.title}</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/shared/components/EmptyState', () => ({
  EmptyState: (props: any) => {
    const { View } = require('react-native');
    return <View testID="shop-empty-state" {...props} />;
  },
}));
jest.mock('@/shared/components/SectionHeader', () => ({
  SectionHeader: () => null,
}));
jest.mock('@/shared/components/IconBadge', () => ({ IconBadge: () => null }));
jest.mock('@/features/services/components/ProductCard', () => ({
  ProductCard: () => null,
}));
jest.mock('@/shared/navigation/tabBarInset', () => ({
  useTabBarBottomInset: () => 100,
}));
jest.mock('@/shared/store/cartStore', () => ({
  useCartStore: () => ({ count: 0 }),
}));
const categoryId = '11111111-1111-4111-8111-111111111111';
const customId = '22222222-2222-4222-8222-222222222222';
const mockUseProductsQuery = jest.fn((..._args: any[]) => ({
  data: { products: [] },
  isLoading: false,
}));
let mockApiEnabled = true;
let mockCategoryQuery: any;
let mockRouteParams: any = {};
jest.mock('@/shared/api', () => ({
  get isApiEnabled() {
    return mockApiEnabled;
  },
  useProductsQuery: (...args: any[]) => mockUseProductsQuery(...args),
}));
jest.mock('@/shared/api/shopHooks', () => ({
  useProductCategoriesQuery: () => mockCategoryQuery,
}));
jest.mock('@/shared/data/services', () => ({
  getEcommerceCategories: () => [
    { id: 'ecom.electronics', name: 'Electronics and Gadgets' },
  ],
  getProductsForCategory: () => [],
  marketplaceProducts: [],
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

let mockActive: any = {
  type: 'user',
  profileType: 'personal',
  id: 'user-1',
  name: 'Arun',
};
jest.mock('@/shared/publishing/useActiveProfile', () => ({
  useActiveProfile: () => ({ active: mockActive }),
}));

function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<ShopScreen />);
  });
  return renderer;
}

beforeEach(() => {
  mockNavigate.mockClear();
  mockUseProductsQuery.mockClear();
  mockApiEnabled = true;
  mockRouteParams = {};
  mockCategoryQuery = {
    data: [
      {
        id: categoryId,
        name: 'Electronics and Gadgets',
        slug: 'electronics-gadgets',
        status: 'published',
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  };
  mockActive = {
    type: 'user',
    profileType: 'personal',
    id: 'user-1',
    name: 'Arun',
  };
});

describe('Shop layout and business entry', () => {
  it('keeps the header outside scrolling content and reserves room above floating tabs', () => {
    const renderer = render();
    const scroll = renderer.root.findByType(ScrollView);
    expect(
      scroll.findAll(node => node.props.testID === 'shop-app-header'),
    ).toHaveLength(0);
    expect(
      renderer.root.findAll(node => node.props.testID === 'shop-app-header')
        .length,
    ).toBeGreaterThan(0);
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never');
    expect(scroll.props.contentContainerStyle.paddingBottom).toBe(100);
  });

  it('gives long category labels three lines and adjusts columns for narrow/large-text layouts', () => {
    const renderer = render();
    const label = renderer.root.findAll(
      node =>
        node.props.children === 'Electronics and Gadgets' &&
        node.props.numberOfLines,
    )[0];
    expect(label.props.numberOfLines).toBe(3);
    expect(getShopCategoryColumns(280)).toBe(2);
    expect(getShopCategoryColumns(335)).toBe(3);
    expect(getShopCategoryColumns(335, 1.3)).toBe(2);
  });

  it('does not offer business product publishing for a personal profile', () => {
    const renderer = render();
    expect(
      renderer.root.findAll(node =>
        String(node.props.accessibilityLabel ?? '').startsWith(
          'Add product for ',
        ),
      ),
    ).toHaveLength(0);
  });

  it('does not offer business product publishing to an analyst', () => {
    mockActive = {
      type: 'provider',
      profileType: 'business',
      role: 'analyst',
      id: 'business-2',
      name: 'Arun Sports',
    };
    const renderer = render();
    expect(
      renderer.root.findAll(node =>
        String(node.props.accessibilityLabel ?? '').startsWith(
          'Add product for ',
        ),
      ),
    ).toHaveLength(0);
  });

  it('opens Add product addressed to the active business profile', () => {
    mockActive = {
      type: 'provider',
      profileType: 'business',
      id: 'business-2',
      name: 'Arun Sports',
    };
    const renderer = render();
    const action = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Add product for Arun Sports' &&
        node.props.onPress,
    )[0];
    ReactTestRenderer.act(() => action.props.onPress());
    expect(mockNavigate).toHaveBeenCalledWith('CreateExploreProduct', {
      publisherProfileId: 'business-2',
      publisherProfileType: 'business',
    });
  });

  it('uses the actual published category UUID when a tile is selected', () => {
    const renderer = render();
    const tile = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Electronics and Gadgets' &&
        node.props.onPress,
    )[0];
    ReactTestRenderer.act(() => tile.props.onPress());
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(categoryId, {
      enabled: true,
    });
    expect(
      mockUseProductsQuery.mock.calls.every(
        ([id]) => !String(id).startsWith('ecom.'),
      ),
    ).toBe(true);
  });

  it('supports direct UUID routes and uniquely resolves legacy category codes', () => {
    mockRouteParams = { categoryId };
    render();
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(categoryId, {
      enabled: true,
    });
    mockRouteParams = { categoryId: 'ecom.electronics' };
    render();
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(categoryId, {
      enabled: true,
    });
  });

  it('does not fetch all or send a legacy code for unavailable or ambiguous filters', () => {
    mockRouteParams = { categoryId: 'ecom.health' };
    const renderer = render();
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
    expect(
      renderer.root.findAll(node => node.props.title === 'Category unavailable')
        .length,
    ).toBeGreaterThan(0);
    mockCategoryQuery.data = [
      {
        id: categoryId,
        name: 'Supplements',
        slug: 'supplements',
        status: 'published',
      },
      { id: customId, name: 'Wellness', slug: 'wellness', status: 'published' },
    ];
    render();
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
  });

  it('shows distinct category loading and error states without requesting an unresolved filter', () => {
    mockRouteParams = { categoryId: 'ecom.electronics' };
    mockCategoryQuery = {
      data: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    };
    const loading = render();
    expect(
      loading.root.findAll(
        node => node.props.children === 'Loading product categories…',
      ).length,
    ).toBeGreaterThan(0);
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
    mockCategoryQuery = {
      data: undefined,
      isLoading: false,
      error: new Error('offline'),
      refetch: jest.fn(),
    };
    const error = render();
    expect(
      error.root.findAll(
        node => node.props.title === 'Could not load categories',
      ).length,
    ).toBeGreaterThan(0);
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
  });

  it('renders custom categories with their own image or a generic icon and fetches their UUID', () => {
    mockCategoryQuery.data = [
      {
        id: categoryId,
        name: 'Handmade pottery',
        slug: 'handmade-pottery',
        imageUrl: 'https://example.invalid/pottery.jpg',
        status: 'published',
      },
      {
        id: customId,
        name: 'Collectibles',
        slug: 'collectibles',
        status: 'published',
      },
    ];
    const renderer = render();
    const image = renderer.root
      .findAllByType(Image)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'Handmade pottery product category image',
      );
    expect(image?.props.source).toEqual({
      uri: 'https://example.invalid/pottery.jpg',
    });
    expect(
      renderer.root.findAll(node => node.props.testID === 'icon-shopping-bag')
        .length,
    ).toBeGreaterThan(0);
    const tile = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Collectibles' && node.props.onPress,
    )[0];
    ReactTestRenderer.act(() => tile.props.onPress());
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(customId, {
      enabled: true,
    });
  });

  it('retains local categories without any product API request in offline mode', () => {
    mockApiEnabled = false;
    const renderer = render();
    const tile = renderer.root.findAll(
      node =>
        node.props.accessibilityLabel === 'Electronics and Gadgets' &&
        node.props.onPress,
    )[0];
    ReactTestRenderer.act(() => tile.props.onPress());
    expect(mockUseProductsQuery).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
  });
});

describe('Shop category resolution', () => {
  it('maps canonical and legacy names to existing artwork without reusing a code as an API ID', () => {
    expect(getShopCategoryArtworkKey('fitness-equipment')).toBe('ecom.fitness');
    expect(getShopCategoryArtworkKey('Supplements')).toBe('ecom.health');
    expect(getShopCategoryArtworkKey('wellness')).toBe('ecom.health');
    expect(getShopCategoryArtworkKey('Land & Properties')).toBe(
      'ecom.property',
    );
    expect(getShopCategoryArtworkKey('ecom.electronics')).toBe(
      'ecom.electronics',
    );
    expect(getShopCategoryArtworkKey('custom-artwork')).toBeUndefined();
  });

  it('omits unpublished and invalid-ID categories from the API grid', () => {
    const categories = getPublishedShopCategories([
      {
        id: categoryId,
        name: 'Fitness',
        slug: 'fitness-equipment',
        status: 'published',
      },
      { id: customId, name: 'Hidden', slug: 'hidden', status: 'draft' },
      {
        id: 'ecom.health',
        name: 'Health',
        slug: 'health',
        status: 'published',
      },
    ]);
    expect(categories).toEqual([
      {
        id: categoryId,
        name: 'Fitness',
        artworkKey: 'ecom.fitness',
        imageUrl: undefined,
      },
    ]);
    expect(
      resolveShopCategoryFilter('ecom.fitness', categories, false),
    ).toEqual({ status: 'selected', categoryId });
    expect(resolveShopCategoryFilter('ecom.health', categories, false)).toEqual(
      { status: 'unavailable' },
    );
  });
});
