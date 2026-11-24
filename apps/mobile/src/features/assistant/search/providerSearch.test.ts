import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import type { MarketplaceProvider } from '@/shared/data/services/serviceTypes';
import {
  filterProviderResults,
  marketplaceOpenNow,
  useProvidersAvailableToday,
} from './providerSearch';

jest.mock('@tanstack/react-query', () => ({ useQuery: jest.fn() }));
jest.mock('@/shared/api/client', () => ({
  apiRequest: jest.fn(),
  ApiError: Error,
}));
const monday = new Date('2026-11-23T06:30:00Z');
const row = (
  id: string,
  changes: Partial<MarketplaceProvider> = {},
): MarketplaceProvider => ({
  id,
  name: id,
  type: 'Plumber',
  categoryIds: ['home.plumber'],
  actionType: 'home_service',
  imageUrl: '',
  rating: 4.4,
  reviewCount: 8,
  priceFrom: 700,
  verified: true,
  workingDays: ['Monday'],
  openingTime: '09:00',
  closingTime: '18:00',
  location: {
    city: 'Puducherry',
    area: 'White Town',
    latitude: 11.93,
    longitude: 79.83,
  },
  ...changes,
});

test('open now uses the provider schedule in India and excludes missing hours or temporary closures', () => {
  expect(marketplaceOpenNow(row('open'), monday)).toBe(true);
  expect(
    marketplaceOpenNow(row('closed', { temporarilyUnavailable: true }), monday),
  ).toBe(false);
  expect(
    marketplaceOpenNow(row('unknown', { openingTime: null }), monday),
  ).toBe(false);
  expect(
    marketplaceOpenNow(row('closed'), new Date('2026-11-23T15:00:00Z')),
  ).toBe(false);
});

test('nearby, area, price and rating filters use real matching row values', () => {
  const candidates = [
    row('far', {
      location: {
        city: 'Chennai',
        area: 'Anna Nagar',
        latitude: 13.07,
        longitude: 80.21,
      },
    }),
    row('unknown', { priceFrom: undefined }),
    row('new', { reviewCount: 0 }),
    row('match'),
  ];
  expect(
    filterProviderResults(
      candidates,
      { nearby: true, maxPrice: 800, minRating: 4, sort: 'closest' },
      { latitude: 11.93, longitude: 79.83 },
      monday,
    ).map(p => p.id),
  ).toEqual(['match']);
  expect(
    filterProviderResults(
      candidates,
      {
        areaLabel: 'White Town, Puducherry',
        minRating: 4,
        availability: 'open_now',
      },
      undefined,
      monday,
    ).map(p => p.id),
  ).toEqual(['unknown', 'match']);
});

test('available today checks bookable slots for the requested category and mode', async () => {
  const request = jest.mocked(apiRequest);
  request.mockImplementation(
    async <T>(path: string) =>
      ({
        availability: {
          slots: [
            {
              available:
                path.includes('/match/') && path.includes('serviceMode=home'),
            },
          ],
        },
      } as T),
  );
  useProvidersAvailableToday(
    [
      row('match', { modes: ['center', 'home'] }),
      row('booked', { modes: ['home'] }),
      row('other-category', {
        categoryIds: ['home.electrician'],
        modes: ['home'],
      }),
    ],
    'home.plumber',
    true,
  );

  const { queryFn } = jest.mocked(useQuery).mock.calls[0][0];
  if (typeof queryFn !== 'function')
    throw new Error('Missing availability query');
  await expect(
    queryFn({
      queryKey: ['availability-test'],
      signal: new AbortController().signal,
      meta: undefined,
      client: {} as never,
    }),
  ).resolves.toEqual(['match']);
  expect(request.mock.calls.map(([path]) => path)).toEqual(
    expect.arrayContaining([
      expect.stringMatching(
        /\/match\/availability\?.*categoryId=home.plumber&serviceMode=center$/,
      ),
      expect.stringMatching(
        /\/match\/availability\?.*categoryId=home.plumber&serviceMode=home$/,
      ),
      expect.stringMatching(
        /\/booked\/availability\?.*categoryId=home.plumber&serviceMode=home$/,
      ),
    ]),
  );
  expect(request).toHaveBeenCalledTimes(3);
});
