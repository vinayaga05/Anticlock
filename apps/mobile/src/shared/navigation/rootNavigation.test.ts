jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));

import { routeForNotification } from './rootNavigation';

describe('Explore notification routing', () => {
  it('opens the creator event submission from a review notification', () => {
    expect(routeForNotification({ entityType: 'event', entityId: 'event-1' })).toEqual({
      screen: 'ExploreSubmissionDetail',
      params: { itemId: 'event-1', kind: 'event' },
    });
  });

  it('opens the creator product submission from a review notification', () => {
    expect(routeForNotification({ entityType: 'product', entityId: 'product-1' })).toEqual({
      screen: 'ExploreSubmissionDetail',
      params: { itemId: 'product-1', kind: 'product' },
    });
  });
});

describe('booking notification routing', () => {
  it('opens the exact booking detail from a booking event', () => {
    expect(routeForNotification({
      kind: 'booking',
      bookingId: 'booking-1',
      screen: 'BookingDetail',
    })).toEqual({
      screen: 'BookingDetail',
      params: { bookingId: 'booking-1' },
    });
  });
});
