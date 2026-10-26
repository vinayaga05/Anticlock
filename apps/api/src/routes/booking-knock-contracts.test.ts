import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BookingListQuerySchema,
  BookingListResponseSchema,
  CustomerRescheduleBookingRequestSchema,
} from '@anticlock/contracts';
import {
  bookingChangedEvent,
  publishBookingEvent,
  subscribeBookingEvents,
} from '../realtime/bookingEvents.js';

describe('Knock booking contracts', () => {
  it('accepts the four server-side list filters', () => {
    for (const filter of ['all', 'on_site', 'online', 'classes'] as const) {
      assert.equal(BookingListQuerySchema.parse({ filter }).filter, filter);
    }
    assert.equal(BookingListQuerySchema.safeParse({ filter: 'upcoming_only' }).success, false);
  });

  it('returns role, mode, type, pagination and complete filter counts', () => {
    const value = BookingListResponseSchema.parse({
      bookings: [{
        id: '73c7ec4e-5cfc-4f99-9564-fc5dc34f28c1',
        mobileUserId: '9230a388-560a-4ea9-8a7e-254a23ecb79c',
        providerId: '4f38ab90-74e6-42cb-9523-daa3de95d013',
        categoryId: 'fitness',
        category: 'class',
        bookingMode: 'online',
        bookingType: 'group_session',
        viewerRole: 'customer',
        status: 'confirmed',
        serviceMode: 'online',
        startsAt: '2026-11-02T10:00:00.000Z',
        endsAt: '2026-11-02T11:00:00.000Z',
        durationMinutes: 60,
        amount: 500,
        paymentStatus: 'paid',
        detail: { serviceTitle: 'Online strength class', providerName: 'Fit Co' },
        createdAt: '2026-10-26T00:00:00.000Z',
        updatedAt: '2026-10-26T00:00:00.000Z',
        cancelledAt: null,
        completedAt: null,
      }],
      nextCursor: null,
      counts: { all: 8, onSite: 5, online: 3, classes: 2 },
    });
    assert.equal(value.bookings[0].bookingType, 'group_session');
    assert.equal(value.counts.classes, 2);
  });

  it('requires an ISO time for customer reschedule requests', () => {
    assert.equal(CustomerRescheduleBookingRequestSchema.safeParse({ startsAt: 'tomorrow' }).success, false);
    assert.equal(CustomerRescheduleBookingRequestSchema.safeParse({
      startsAt: '2026-11-02T10:00:00.000Z',
    }).success, true);
  });
});

describe('booking event bus', () => {
  it('fans a database change to connected viewers without polling', async () => {
    const received: string[] = [];
    const unsubscribe = subscribeBookingEvents(event => received.push(event.bookingId));
    await publishBookingEvent(bookingChangedEvent({
      id: '73c7ec4e-5cfc-4f99-9564-fc5dc34f28c1',
      status: 'confirmed',
      userIds: ['user-a', 'user-b', 'user-a'],
    }));
    unsubscribe();
    assert.deepEqual(received, ['73c7ec4e-5cfc-4f99-9564-fc5dc34f28c1']);
  });
});
