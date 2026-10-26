jest.mock('@react-navigation/native', () => ({
  createNavigationContainerRef: () => ({ isReady: () => false, navigate: jest.fn() }),
}));

import { routeForNotification } from './rootNavigation';

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
