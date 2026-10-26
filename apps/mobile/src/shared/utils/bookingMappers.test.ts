import type { Booking } from '@anticlock/contracts';
import { filterBookings } from '@/shared/data/bookings';
import { mapApiBookingToConsolidated } from './bookingMappers';

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: '73c7ec4e-5cfc-4f99-9564-fc5dc34f28c1',
    mobileUserId: '9230a388-560a-4ea9-8a7e-254a23ecb79c',
    providerId: '4f38ab90-74e6-42cb-9523-daa3de95d013',
    categoryId: 'fitness',
    category: 'appointment',
    bookingMode: 'on_site',
    bookingType: 'appointment',
    viewerRole: 'customer',
    status: 'pending',
    serviceMode: 'center',
    startsAt: '2026-11-02T10:00:00.000Z',
    endsAt: '2026-11-02T11:00:00.000Z',
    durationMinutes: 60,
    amount: 500,
    paymentStatus: 'pending',
    detail: { serviceTitle: 'Consultation', providerName: 'Fit Co' },
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    cancelledAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('Knock booking filters', () => {
  it('shows a class in Classes and its actual delivery-mode tab', () => {
    const onSiteClass = mapApiBookingToConsolidated(booking({
      category: 'class',
      bookingType: 'group_session',
      bookingMode: 'on_site',
      serviceMode: 'center',
    }));
    const onlineAppointment = mapApiBookingToConsolidated(booking({
      id: '55318b05-f77f-434e-93de-109039a46e8b',
      bookingMode: 'online',
      serviceMode: 'online',
    }));

    expect(filterBookings([onSiteClass, onlineAppointment], 'all')).toHaveLength(2);
    expect(filterBookings([onSiteClass, onlineAppointment], 'classes')).toEqual([onSiteClass]);
    expect(filterBookings([onSiteClass, onlineAppointment], 'on_site')).toEqual([onSiteClass]);
    expect(filterBookings([onSiteClass, onlineAppointment], 'online')).toEqual([onlineAppointment]);
  });

  it('preserves provider role, customer identity and payment state', () => {
    const mapped = mapApiBookingToConsolidated(booking({
      viewerRole: 'provider',
      customerName: 'Bala Customer',
      paymentStatus: 'paid',
    }));
    expect(mapped.viewerRole).toBe('provider');
    expect(mapped.customerName).toBe('Bala Customer');
    expect(mapped.paymentStatus).toBe('paid');
  });
});
