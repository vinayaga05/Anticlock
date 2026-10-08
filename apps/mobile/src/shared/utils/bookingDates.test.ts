import {
  getUpcomingBookingDates,
  scheduleToIso,
  toLocalDateId,
} from '@/shared/utils/bookingDates';

describe('booking dates', () => {
  it('uses the device-local calendar day, not the UTC day', () => {
    // 00:30 local on 9 Oct: the UTC day can still be 8 Oct in UTC+ zones.
    const lateNight = new Date(2026, 9, 9, 0, 30);
    expect(toLocalDateId(lateNight)).toBe('2026-10-09');
    expect(getUpcomingBookingDates(1)[0]!.id).toBe(toLocalDateId(new Date()));
  });

  it('turns a picked local date and slot into the matching instant', () => {
    const iso = scheduleToIso('2026-10-09', '12:30 AM');
    expect(iso).toBe(new Date(2026, 9, 9, 0, 30).toISOString());
    expect(scheduleToIso('2026-10-09', '2:15 PM')).toBe(
      new Date(2026, 9, 9, 14, 15).toISOString(),
    );
    expect(scheduleToIso('9 Oct', '10:00 AM')).toBeNull();
  });
});
