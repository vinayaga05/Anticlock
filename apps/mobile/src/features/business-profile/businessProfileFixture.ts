import type { BusinessProfile } from '@anticlock/contracts';
export const BUSINESS_ID = 'f2d13dd3-a39f-4534-849a-9cf93978169f';
export const CUSTOMER_ID = '1013c13f-4115-4e91-80a4-868631e785da';
export function businessFixture(
  overrides: Partial<BusinessProfile> = {},
): BusinessProfile {
  return {
    id: BUSINESS_ID,
    name: 'Lotus Movement Studio',
    providerKind: 'business',
    verified: true,
    tagline: 'Thoughtful movement. A little more you.',
    brandAccentColor: '#345D51',
    description:
      'A neighbourhood studio for considered movement, strength, and a slower moment in your day.',
    yearsInBusiness: 8,
    certifications: ['Certified instruction'],
    languages: ['English', 'Tamil'],
    avatarUrl: null,
    coverUrl: null,
    categories: [
      { id: 'yoga-service', name: 'Yoga & Movement', treeId: 'fitness' },
    ],
    gallery: [
      {
        id: '23d78cd1-89e7-40b3-bcea-8524505d9388',
        kind: 'image',
        url: 'https://example.test/gallery.jpg',
      },
    ],
    services: [
      {
        id: 'b752a97c-7db8-47f0-afcf-e5809a1d62ba',
        categoryId: 'yoga-service',
        title: 'Personal movement session',
        description: 'A considered practice, shaped around you.',
        price: 750,
        durationMinutes: 60,
        modes: ['center', 'online'],
        available: true,
      },
    ],
    contact: { phone: null, email: null, website: null },
    location: {
      address: '12 Garden Road',
      city: 'Chennai',
      area: 'Adyar',
      pincode: '600020',
      latitude: 13.0012,
      longitude: 80.2565,
      serviceRadiusKm: 5,
    },
    availability: {
      timeZone: 'Asia/Kolkata',
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      openingTime: '07:00',
      closingTime: '19:00',
      temporarilyUnavailable: false,
      operatingStatus: 'open',
      nextAvailableAt: '2026-11-16T03:30:00.000Z',
    },
    rating: { average: null, count: 0 },
    reviews: [],
    products: [],
    events: [],
    stats: { followers: 18, clips: 0, products: 0, events: 0 },
    viewer: {
      role: null,
      isOwner: false,
      canManage: false,
      canEditServices: false,
      canViewAnalytics: false,
      canPublish: false,
      isSaved: false,
      canReview: false,
      relationship: {
        canFollow: true,
        followStatus: 'not_following',
        isFollowing: false,
        isRequested: false,
        isBlocked: false,
        canViewContent: true,
        canMessage: true,
      },
    },
    ...overrides,
  };
}
