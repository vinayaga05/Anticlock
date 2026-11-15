import React from 'react';
import Renderer from 'react-test-renderer';
import { ServiceCategoryScreen } from './ServiceCategoryScreen';
import { useMarketplaceProvidersQuery } from '@/shared/api/marketplaceHooks';
const mockNavigate = jest.fn();
let mockCategoryId = 'health.doctors';
let mockProviders: any[] = [];
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, setOptions: jest.fn() }),
  useRoute: () => ({
    params: { treeId: 'health', categoryId: mockCategoryId },
  }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock('@/shared/hooks/useSearchScrollRestoration', () => ({
  useSearchScrollRestoration: () => ({
    searchQuery: '',
    onChangeText: jest.fn(),
  }),
}));
jest.mock('@/shared/api/marketplaceHooks', () => ({
  isMarketplaceProviderId: () => true,
  useMarketplaceProvidersQuery: jest.fn(() => ({ data: mockProviders })),
}));
jest.mock('@/shared/navigation/businessNavigation', () => ({
  navigateToProvider: (nav: any, id: string, categoryId: string) =>
    nav.navigate('BusinessProfile', { providerId: id, categoryId }),
}));
jest.mock('@/shared/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: any) => children,
}));
jest.mock('@/shared/components/HealthScreenShell', () => ({
  HealthScreenShell: ({ children }: any) => children,
}));
jest.mock('@/shared/components/SearchBar', () => ({
  SearchBar: (props: any) => require('react').createElement('search-input', props),
}));
jest.mock('@/shared/components/EmptyState', () => ({
  EmptyState: (props: any) => require('react').createElement('empty-state', props),
}));
jest.mock('@/shared/components/SectionHeader', () => ({
  SectionHeader: (props: any) => require('react').createElement('section-header', props),
}));
jest.mock('@/shared/components/FilterPills', () => ({
  FilterPills: (props: any) => require('react').createElement('filter-pills', props),
}));
jest.mock('@/features/services/components/ServiceCategoryGrid', () => ({
  ServiceCategoryGrid: (props: any) =>
    require('react').createElement('specialty-grid', props),
}));
jest.mock('@/features/services/components/ProviderCard', () => ({
  ProviderCard: (props: any) => require('react').createElement('provider-card', props),
}));
jest.mock('@/features/services/components/EventCard', () => ({
  EventCard: () => null,
}));
jest.mock('@/features/services/components/CourseCard', () => ({
  CourseCard: () => null,
}));
jest.mock('@/features/services/components/ProductCard', () => ({
  ProductCard: () => null,
}));
let tree: Renderer.ReactTestRenderer;
beforeEach(() => {
  mockCategoryId = 'health.doctors';
  mockProviders = [];
  mockNavigate.mockClear();
});
afterEach(() => Renderer.act(() => tree?.unmount()));
function render() {
  Renderer.act(() => {
    tree = Renderer.create(<ServiceCategoryScreen />);
  });
}
test('Doctors skips specialties and shows real provider cards with normal search and near-you filters', () => {
  mockProviders = [
    {
      id: 'approved-doctor',
      name: 'Doctor',
      type: 'doctor',
      location: { city: 'Chennai', area: 'Anna Nagar' },
    },
  ];
  render();
  expect(useMarketplaceProvidersQuery).toHaveBeenCalledWith({
    categoryId: 'health.doctors',
    limit: 50,
  });
  expect(tree.root.findAllByType('specialty-grid' as any)).toHaveLength(0);
  expect(tree.root.findByType('search-input' as any).props.placeholder).toBe(
    'Search Doctors',
  );
  expect(tree.root.findByType('filter-pills' as any).props.activeId).toBe(
    'near',
  );
  const card = tree.root.findByType('provider-card' as any);
  expect(card.props.provider.id).toBe('approved-doctor');
  Renderer.act(() => card.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('BusinessProfile', {
    providerId: 'approved-doctor',
    categoryId: 'health.doctors',
  });
});
test('Doctors without results shows the normal nearby empty state, never the specialty grid', () => {
  render();
  expect(tree.root.findByType('empty-state' as any).props.title).toBe(
    'No providers nearby',
  );
  expect(tree.root.findAllByType('specialty-grid' as any)).toHaveLength(0);
});
test('other health services keep their direct provider-list behavior', () => {
  mockCategoryId = 'health.physiotherapist';
  render();
  expect(tree.root.findByType('search-input' as any).props.placeholder).toBe(
    'Search Physiotherapist',
  );
  expect(tree.root.findAllByType('specialty-grid' as any)).toHaveLength(0);
});
