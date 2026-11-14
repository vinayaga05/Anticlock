import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BusinessAvailabilityQuerySchema, CreateBusinessReviewRequestSchema, UpdateBusinessProfileRequestSchema, UpdateBusinessServicesRequestSchema } from '@anticlock/contracts';
import { businessSlots, configuredServiceDuration, istDate, validBusinessDate, validWorkingDay } from './businessAvailability.js';
import { businessPublicFields, decodeReviewCursor, encodeReviewCursor } from './BusinessProfileService.js';

const input = {
  date: '2026-11-16', categoryId: 'fitness.yoga', serviceMode: 'center' as const, durationMinutes: 60,
  workingDays: ['Monday'], openingTime: '09:00', closingTime: '12:00', temporarilyUnavailable: false,
  serviceAvailable: true, allowedModes: ['center', 'home'] as Array<'center' | 'home'>, bookings: [], now: new Date('2026-11-15T10:00:00Z'),
};
describe('real business availability', () => {
  it('uses IST explicitly, validates calendar dates and accepts full or short working days', () => {
    assert.equal(istDate(new Date('2026-11-15T20:00:00Z')), '2026-11-16');
    for (const date of ['2026-02-30', '2026-13-01', 'bad']) assert.equal(validBusinessDate(date), false);
    assert.equal(validBusinessDate('2028-02-29'), true);
    for (const day of ['MON', 'Monday', 'wed', ' Sunday ']) assert.equal(validWorkingDay(day), true);
    assert.equal(validWorkingDay('holiday'), false);
    assert.equal(configuredServiceDuration('45'), 45);
    for (const value of [null, undefined, '', 'bad', 0, 4, 45.5, 481]) assert.equal(configuredServiceDuration(value), null);
  });
  it('builds 30-minute starts with real service duration and closing boundary', () => {
    const slots = businessSlots(input);
    assert.equal(slots.timeZone, 'Asia/Kolkata');
    assert.equal(slots.slots.length, 5);
    assert.deepEqual(slots.slots[0], { startsAt: '2026-11-16T03:30:00.000Z', endsAt: '2026-11-16T04:30:00.000Z', available: true });
    assert.equal(slots.slots.at(-1)?.endsAt, '2026-11-16T06:30:00.000Z');
    assert.equal(businessSlots({ ...input, durationMinutes: 90 }).slots.length, 4);
  });
  it('uses interval overlap, allows adjacent bookings and derives missing end from duration', () => {
    const result = businessSlots({ ...input, bookings: [{ startsAt: new Date('2026-11-16T04:30:00Z'), endsAt: null, durationMinutes: 60 }] });
    assert.deepEqual(result.slots.map(slot => slot.available), [true, false, false, false, true]);
  });
  it('excludes starts at or before the supplied clock and reports a fully occupied day', () => {
    const result = businessSlots({ ...input, now: new Date('2026-11-16T04:00:00Z') });
    assert.deepEqual(result.slots.map(slot => slot.available), [false, false, true, true, true]);
    const full = businessSlots({ ...input, bookings: [{ startsAt: new Date('2026-11-16T03:30:00Z'), endsAt: new Date('2026-11-16T06:30:00Z') }] });
    assert.equal(full.slots.every(slot => !slot.available), true);
    assert.equal(full.reason, 'No available times on this date.');
  });
  it('returns no invented times for missing hours, closed days, paused services or modes', () => {
    for (const change of [{ workingDays: [] }, { openingTime: null }, { openingTime: 'xx' }, { closingTime: '08:00' }, { workingDays: ['Tuesday'] }, { temporarilyUnavailable: true }, { serviceAvailable: false }, { allowedModes: [] }]) {
      const result = businessSlots({ ...input, ...change });
      assert.equal(result.slots.length, 0, JSON.stringify(change));
      assert.ok(result.reason);
    }
  });
});
describe('business public fields and contracts', () => {
  it('extracts only explicit public profile fields and never generates years or operating times', () => {
    const fields = businessPublicFields({ publicProfile: { common: { profile: { description: 'Real description', yearsInOperation: 7, languages: [' Tamil ', 'English'], documents: { secret: 'kyc-document' } }, basic: { mobile: '9876543210' }, availability: {} }, dynamic: { passport: 'private' } } });
    assert.equal(fields.description, 'Real description');
    assert.equal(fields.yearsInBusiness, 7);
    assert.deepEqual(fields.languages, ['Tamil', 'English']);
    assert.equal(fields.openingTime, null);
    assert.deepEqual(fields.modes, []);
    assert.equal(businessPublicFields({ publicProfile: null }).yearsInBusiness, null);
    assert.equal(businessPublicFields({ publicProfile: { common: { profile: { yearsInBusiness: null, yearsInOperation: 7 } } } }).yearsInBusiness, null);
  });
  it('checks owner update fields, branding, URL schemes, and review Unicode before database writes', () => {
    assert.equal(UpdateBusinessProfileRequestSchema.safeParse({ brandAccentColor: '#Aa12fF', tagline: 'My business', yearsInBusiness: 0 }).success, true);
    for (const value of [{ brandAccentColor: 'red' }, { yearsInBusiness: -1 }, { website: 'javascript:alert(1)' }, { website: 'not a URL' }, { website: 'https://user:password@example.test' }, { status: 'active' }, { role: 'owner' }]) assert.equal(UpdateBusinessProfileRequestSchema.safeParse(value).success, false);
    assert.equal(CreateBusinessReviewRequestSchema.safeParse({ bookingId: '572af106-4f78-46a6-9fa4-0bfd256c0c07', rating: 5, body: '😀'.repeat(5) }).success, false);
    assert.equal(UpdateBusinessServicesRequestSchema.safeParse({ services: [{ categoryId: 'yoga', description: null, price: 2147483648, durationMinutes: 60, modes: ['center'], available: true }] }).success, false);
    assert.equal(BusinessAvailabilityQuerySchema.safeParse({ date: '2026-11-16', categoryId: 'yoga', serviceMode: 'center', durationMinutes: '60' }).success, true);
  });
  it('uses exact timestamp plus ID cursors to preserve tied review timestamps', () => {
    const row = { id: '572af106-4f78-46a6-9fa4-0bfd256c0c07', createdAt: new Date('2026-11-14T04:00:00.123Z') };
    assert.deepEqual(decodeReviewCursor(encodeReviewCursor(row)), row);
    for (const cursor of ['', 'garbage', Buffer.from('["bad", "bad"]').toString('base64url')]) assert.throws(() => decodeReviewCursor(cursor), /Invalid review cursor/);
  });
});
