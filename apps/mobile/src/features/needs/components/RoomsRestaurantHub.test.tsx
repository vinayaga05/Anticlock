import React from 'react';
import Renderer from 'react-test-renderer';
import { RoomsRestaurantHub } from './RoomsRestaurantHub';
import { NeedsShowcaseGrid } from './NeedsShowcaseGrid';
import {
  getCategoriesByTree,
  needsShowcaseCards,
} from '@/shared/data/services';
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock(
  '@/shared/hooks/useTheme',
  () => require('@/test/componentMocks').themeModule,
);
jest.mock(
  '@/shared/components/PressableScale',
  () => require('@/test/componentMocks').pressableScaleModule,
);
jest.mock('@/shared/components/Glass', () => ({
  Glass: ({ children }: any) => children,
}));
jest.mock('@/shared/components/IconBadge', () => ({ IconBadge: () => null }));
jest.mock('@/shared/components/SectionHeader', () => ({
  SectionHeader: () => null,
}));
jest.mock('@/features/services/components/ServiceCategoryGrid', () => ({
  ServiceCategoryGrid: (props: any) =>
    require('react').createElement('category-grid', props),
}));
const names = [
  'Hotel',
  'Lodge',
  'Veg Restaurant',
  'Non-Veg Restaurant',
  'Fast Food',
  'Cloud Kitchen',
  'Food Truck',
  'Café & Juice Bar',
  'Cake & Sweet Stall',
];
let tree: Renderer.ReactTestRenderer;
afterEach(() => Renderer.act(() => tree?.unmount()));
test('Rooms and Restaurant shows all nine requested services in order in the standard provider directory', () => {
  Renderer.act(() => {
    tree = Renderer.create(<RoomsRestaurantHub />);
  });
  const grid = tree.root.findByType('category-grid' as any);
  expect(grid.props.treeId).toBe('rooms_restaurant');
  expect(grid.props.categories.map((c: any) => c.name)).toEqual(names);
  expect(
    grid.props.categories.every((c: any) => c.actionType === 'service_request'),
  ).toBe(true);
});
test('Needs replaces My Activity with the Rooms and Restaurant entry and opens its tree', () => {
  expect(needsShowcaseCards.some(c => c.title === 'My Activity')).toBe(false);
  Renderer.act(() => {
    tree = Renderer.create(<NeedsShowcaseGrid />);
  });
  const entry = tree.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Rooms and Restaurant' &&
      typeof n.props.onPress === 'function',
  )[0];
  expect(entry).toBeDefined();
  Renderer.act(() => entry.props.onPress());
  expect(mockNavigate).toHaveBeenCalledWith('ServiceTree', {
    treeId: 'rooms_restaurant',
  });
});
test('the backend seed and mobile catalog agree on every Rooms and Restaurant category', () => {
  const catalog = require('../../../../../api/src/seed/catalog.json');
  const seeded = catalog.categories.filter(
    (c: any) => c.treeId === 'rooms_restaurant',
  );
  expect(seeded.map((c: any) => [c.id, c.name])).toEqual(
    getCategoriesByTree('rooms_restaurant').map(c => [c.id, c.name]),
  );
  expect(
    catalog.trees.filter((t: any) => t.id === 'rooms_restaurant'),
  ).toHaveLength(1);
});
