jest.mock('./client', () => ({ apiRequest: jest.fn() }));
jest.mock('./config', () => ({ isApiEnabled: true }));
jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({
    isReady: () => false,
    navigate: jest.fn(),
  }),
}));

import {
  isMarketplaceProviderId,
  mapMarketplaceCard,
} from './marketplaceHooks';
import { routeForNotification } from '@/shared/navigation/rootNavigation';

describe('marketplace mapping', () => {
  it('maps an approved business card onto the provider card shape', () => {
    const provider = mapMarketplaceCard({
      id: '0b9a2f7e-3d4c-4a5b-9c8d-7e6f5a4b3c2d',
      name: 'Lotus Yoga',
      providerKind: 'business',
      categoryIds: ['fitness.yoga'],
      categories: [
        {
          id: 'fitness.yoga',
          name: 'Yoga',
          treeId: 'fitness',
          actionType: 'class_booking',
        },
      ],
      city: 'Chennai',
      area: 'Adyar',
      description: 'Morning batches',
      priceFrom: 499,
      avatarUrl: 'https://cdn/logo.jpg',
      coverUrl: null,
      modes: ['center', 'online'],
      workingDays: ['mon'],
      openingTime: '06:00',
      closingTime: '20:00',
      verified: true,
      createdAt: '2026-10-08T00:00:00.000Z',
    });
    expect(provider).toMatchObject({
      name: 'Lotus Yoga',
      type: 'Yoga',
      actionType: 'class_booking',
      imageUrl: 'https://cdn/logo.jpg',
      reviewCount: 0,
      location: { city: 'Chennai', area: 'Adyar' },
      priceFrom: 499,
      subtitle: 'Yoga · Chennai',
      tags: ['At centre', 'Online'],
    });
    expect(isMarketplaceProviderId(provider.id)).toBe(true);
    expect(isMarketplaceProviderId('prov-doc-remya')).toBe(false);
  });

  it('routes provider application notifications to the status screen', () => {
    expect(
      routeForNotification({
        kind: 'provider_application',
        applicationId: 'a1',
        status: 'approved',
      }),
    ).toEqual({
      screen: 'ProviderApplicationStatus',
      params: { applicationId: 'a1' },
    });
    expect(routeForNotification({ kind: 'other' })).toBeNull();
  });
});
