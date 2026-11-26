jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
import {
  serviceTrees,
  serviceCategories,
  marketplaceProviders,
  marketplaceCourses,
  marketplaceProducts,
  searchCatalog,
  getCategoriesByTree,
} from '@/shared/data/services';
import { isHealthRecord } from './releaseFeatures';

test('the actual Android catalogue and all search entry points exclude health offerings', () => {
  for (const rows of [
    serviceTrees,
    serviceCategories,
    marketplaceProviders,
    marketplaceCourses,
    marketplaceProducts,
  ]) {
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some(isHealthRecord)).toBe(false);
  }
  expect(getCategoriesByTree('health')).toEqual([]);
  for (const query of ['doctor', 'fitness', 'nutrition', 'pharmacy', '']) {
    for (const rows of Object.values(searchCatalog(query)))
      expect(rows.some(isHealthRecord)).toBe(false);
  }
  expect(searchCatalog('plumb').categories.length).toBeGreaterThan(0);
});
