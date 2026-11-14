import type { BusinessAvailability, ServiceMode } from '@anticlock/contracts';

export const BUSINESS_TIME_ZONE = 'Asia/Kolkata' as const;
const DAYS = ['sun', 'sunday', 'mon', 'monday', 'tue', 'tuesday', 'wed', 'wednesday', 'thu', 'thursday', 'fri', 'friday', 'sat', 'saturday'];
export const dayKey = (day: string) => day.trim().slice(0, 3).toLowerCase();
export const validWorkingDay = (day: string) => DAYS.includes(day.trim().toLowerCase());
export function configuredServiceDuration(value: unknown): number | null {
  const minutes = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isInteger(minutes) && minutes >= 5 && minutes <= 480 ? minutes : null;
}
export function istDate(now: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function validBusinessDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+05:30`);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsed.getTime()) && istDate(parsed) === date;
}
export function businessSlots(input: {
  date: string; categoryId: string; serviceMode: ServiceMode; durationMinutes: number;
  workingDays: string[]; openingTime: string | null; closingTime: string | null;
  temporarilyUnavailable: boolean; serviceAvailable: boolean; allowedModes: ServiceMode[];
  bookings: Array<{ startsAt: Date; endsAt: Date | null; durationMinutes?: number | null }>;
  now: Date;
}): BusinessAvailability {
  const result: BusinessAvailability = { date: input.date, categoryId: input.categoryId, serviceMode: input.serviceMode, durationMinutes: input.durationMinutes, timeZone: BUSINESS_TIME_ZONE, slots: [], reason: null };
  const unavailable = (reason: string) => ({ ...result, reason });
  if (!validBusinessDate(input.date)) return unavailable('Choose a valid date.');
  if (input.temporarilyUnavailable) return unavailable('This business is temporarily unavailable.');
  if (!input.serviceAvailable) return unavailable('This service is currently unavailable.');
  if (!input.allowedModes.includes(input.serviceMode)) return unavailable('This service does not offer the selected mode.');
  if (!input.openingTime || !input.closingTime || !input.workingDays.length) return unavailable('Operating hours have not been provided.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.openingTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.closingTime)) return unavailable('Operating hours have not been provided.');
  const opening = new Date(`${input.date}T${input.openingTime}:00+05:30`);
  const closing = new Date(`${input.date}T${input.closingTime}:00+05:30`);
  // Existing bookings support same-day operating windows only.
  if (closing <= opening) return unavailable('Operating hours are unavailable for this date.');
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIME_ZONE, weekday: 'short' }).format(opening).toLowerCase();
  if (!input.workingDays.map(dayKey).includes(weekday)) return unavailable('This business is closed on this day.');
  const durationMs = input.durationMinutes * 60_000;
  for (let start = opening.getTime(); start + durationMs <= closing.getTime(); start += 30 * 60_000) {
    const end = start + durationMs;
    const conflict = input.bookings.some(booking => booking.startsAt.getTime() < end && (booking.endsAt?.getTime() ?? booking.startsAt.getTime() + (booking.durationMinutes ?? 60) * 60_000) > start);
    result.slots.push({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString(), available: start > input.now.getTime() && !conflict });
  }
  if (!result.slots.some(slot => slot.available)) result.reason = 'No available times on this date.';
  return result;
}
