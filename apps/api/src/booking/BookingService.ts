import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  lte,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import type {
  Booking,
  BookingAdminListItem,
  BookingListFilter,
  BookingStatus,
  CreateBookingRequest,
  CustomerRescheduleBookingRequest,
  CustomerUpdateBookingRequest,
  ProviderBookingActionRequest,
  UpdateBookingRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  bookings,
  mobileUsers,
  providerMemberships,
  providerServiceOfferings,
  providers,
  serviceCategories,
} from '../db/schema.js';
import { parseCursorDate } from '../lib/cursor.js';
import { notificationService } from '../notifications/NotificationService.js';
import {
  bookingChangedEvent,
  publishBookingEvent,
} from '../realtime/bookingEvents.js';

const ACTIVE_STATUSES = ['pending', 'confirmed', 'reschedule_requested'];
const PROVIDER_ROLES = ['owner', 'admin'];
type BookingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function appError(message: string, code: string, status: 400 | 403 | 404 | 409) {
  return Object.assign(new Error(message), { code, status });
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function bookingEnd(start: Date, request: Pick<CreateBookingRequest, 'endsAt' | 'durationMinutes'>) {
  if (request.endsAt) return new Date(request.endsAt);
  return new Date(start.getTime() + (request.durationMinutes ?? 60) * 60_000);
}

function assertWithinProviderHours(
  provider: typeof providers.$inferSelect,
  startsAt: Date,
  endsAt: Date,
) {
  const common = object(provider.publicProfile).common;
  const availability = object(object(common).availability);
  const workingDays = Array.isArray(availability.workingDays)
    ? availability.workingDays.filter((day): day is string => typeof day === 'string')
    : [];
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const local = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find(part => part.type === type)?.value ?? '';
    return {
      date: `${value('year')}-${value('month')}-${value('day')}`,
      day: value('weekday').slice(0, 3).toLowerCase(),
      time: `${value('hour')}:${value('minute')}`,
    };
  };
  const start = local(startsAt);
  const end = local(endsAt);
  if (workingDays.length && !workingDays.map(item => item.slice(0, 3).toLowerCase()).includes(start.day)) {
    throw appError('The provider is not available on this day', 'outside_availability', 409);
  }
  const openingTime = typeof availability.openingTime === 'string' ? availability.openingTime : null;
  const closingTime = typeof availability.closingTime === 'string' ? availability.closingTime : null;
  if (
    (openingTime && start.time < openingTime) ||
    (closingTime && (start.time >= closingTime || end.date !== start.date || end.time > closingTime))
  ) {
    throw appError('Choose a time within the provider’s operating hours', 'outside_availability', 409);
  }
}

export class BookingService {
  private async providerIdsForUser(mobileUserId: string) {
    const rows = await db
      .select({ providerId: providerMemberships.providerId })
      .from(providerMemberships)
      .where(and(
        eq(providerMemberships.mobileUserId, mobileUserId),
        inArray(providerMemberships.role, PROVIDER_ROLES),
      ));
    return [...new Set(rows.map(row => row.providerId))];
  }

  private async providerOwnerIds(providerId: string) {
    const rows = await db
      .select({ mobileUserId: providerMemberships.mobileUserId })
      .from(providerMemberships)
      .where(and(
        eq(providerMemberships.providerId, providerId),
        inArray(providerMemberships.role, PROVIDER_ROLES),
      ));
    return [...new Set(rows.map(row => row.mobileUserId))];
  }

  private async notifyProviderOwners(
    providerId: string,
    payload: Parameters<typeof notificationService.notifyUser>[1],
  ) {
    const owners = await this.providerOwnerIds(providerId);
    await Promise.allSettled(owners.map(userId => notificationService.notifyUser(userId, payload)));
    return owners;
  }

  private async publishChange(
    row: typeof bookings.$inferSelect,
    additionalUserIds: string[] = [],
  ) {
    const owners = row.providerId ? await this.providerOwnerIds(row.providerId) : [];
    await publishBookingEvent(bookingChangedEvent({
      id: row.id,
      status: (this.mapBookingRow(row).status),
      userIds: [row.mobileUserId, ...owners, ...additionalUserIds],
    }));
  }

  private async assertProviderCanBook(
    providerId: string,
    categoryId: string | null | undefined,
    mode: CreateBookingRequest['serviceMode'],
  ) {
    const [row] = await db
      .select({ provider: providers, offering: providerServiceOfferings, actionType: serviceCategories.actionType })
      .from(providers)
      .innerJoin(providerServiceOfferings, eq(providerServiceOfferings.providerId, providers.id))
      .innerJoin(serviceCategories, eq(providerServiceOfferings.categoryId, serviceCategories.id))
      .where(and(
        eq(providers.id, providerId),
        eq(providers.status, 'active'),
        categoryId ? eq(providerServiceOfferings.categoryId, categoryId) : undefined,
      ))
      .limit(1);
    if (!row) {
      throw appError('This approved provider does not offer the selected service', 'provider_unavailable', 400);
    }

    const common = object(object(row.provider.publicProfile).common);
    const services = object(common.services);
    const allowed =
      (mode === 'online' && services.online === true) ||
      (mode === 'home' && services.homeVisit === true) ||
      (mode === 'center' && services.atLocation === true);
    if (!allowed) {
      throw appError(`This provider does not offer ${mode} bookings`, 'service_mode_unavailable', 400);
    }
    return row;
  }

  private async assertNoConflict(
    tx: BookingTransaction,
    providerId: string,
    customerId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBookingId?: string,
  ) {
    // Serialize scheduling for this provider so two simultaneous requests
    // cannot both pass the overlap check.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${providerId}))`);
    const [conflict] = await tx
      .select({ id: bookings.id, mobileUserId: bookings.mobileUserId })
      .from(bookings)
      .where(and(
        eq(bookings.providerId, providerId),
        inArray(bookings.status, ACTIVE_STATUSES),
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined,
        lt(bookings.startsAt, endsAt),
        sql`COALESCE(${bookings.endsAt}, ${bookings.startsAt} + interval '60 minutes') > ${startsAt.toISOString()}::timestamptz`,
      ))
      .limit(1);
    if (conflict) {
      throw appError(
        conflict.mobileUserId === customerId
          ? 'You already have a booking that overlaps this time'
          : 'This time is no longer available. Choose another slot.',
        conflict.mobileUserId === customerId ? 'duplicate_booking' : 'booking_conflict',
        409,
      );
    }
  }

  async createBooking(mobileUserId: string, request: CreateBookingRequest): Promise<Booking> {
    if (!request.providerId) {
      throw appError('Choose an approved service provider', 'provider_required', 400);
    }
    const startsAt = new Date(request.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw appError('Choose a future date and time', 'invalid_schedule', 400);
    }
    const endsAt = bookingEnd(startsAt, request);
    if (endsAt <= startsAt) throw appError('End time must be after start time', 'invalid_schedule', 400);

    const providerData = await this.assertProviderCanBook(
      request.providerId,
      request.categoryId,
      request.serviceMode,
    );
    assertWithinProviderHours(providerData.provider, startsAt, endsAt);
    const amount = providerData.offering.pricingStartsAt ?? request.amount ?? null;
    const [row] = await db.transaction(async tx => {
      await this.assertNoConflict(tx, request.providerId!, mobileUserId, startsAt, endsAt);
      return tx
        .insert(bookings)
        .values({
          mobileUserId,
          providerId: request.providerId,
          categoryId: providerData.offering.categoryId,
          category: request.category,
          status: 'pending',
          serviceMode: request.serviceMode,
          startsAt,
          endsAt,
          durationMinutes: request.durationMinutes ?? 60,
          amount,
          paymentStatus: 'pending',
          detail: {
            ...request.detail,
            providerName: providerData.provider.name,
            serviceTitle: request.detail.serviceTitle || providerData.provider.name,
          },
          metadata: {
            ...(request.metadata ?? {}),
            bookingType: request.bookingType ?? request.category,
            // This will become provider-configurable; clients cannot weaken it.
            cancellationWindowHours: 2,
          },
        })
        .returning();
    });

    const booking = this.mapBookingRow(row!, 'customer');
    await this.notifyProviderOwners(request.providerId, {
      type: 'booking_created',
      title: 'New booking request',
      body: `${booking.detail.serviceTitle} was requested for ${startsAt.toLocaleString('en-IN')}.`,
      data: {
        kind: 'booking',
        bookingId: booking.id,
        providerId: request.providerId,
        screen: 'BookingDetail',
      },
    });
    await this.publishChange(row!);
    return booking;
  }

  async getBooking(bookingId: string, mobileUserId: string): Promise<Booking | null> {
    const providerIds = await this.providerIdsForUser(mobileUserId);
    const access = providerIds.length
      ? or(eq(bookings.mobileUserId, mobileUserId), inArray(bookings.providerId, providerIds))
      : eq(bookings.mobileUserId, mobileUserId);
    const [row] = await db
      .select({ booking: bookings, customerName: mobileUsers.displayName })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .where(and(eq(bookings.id, bookingId), access));
    return row
      ? this.mapBookingRow(
          row.booking,
          row.booking.mobileUserId === mobileUserId ? 'customer' : 'provider',
          row.customerName,
        )
      : null;
  }

  async listBookings(
    mobileUserId: string,
    options: {
      status?: BookingStatus | 'upcoming' | 'past';
      category?: Booking['category'];
      filter?: BookingListFilter;
      limit?: number;
      cursor?: string;
    } = {},
  ) {
    const limit = Math.min(options.limit ?? 20, 100);
    const now = new Date();
    const providerIds = await this.providerIdsForUser(mobileUserId);
    const access = providerIds.length
      ? or(eq(bookings.mobileUserId, mobileUserId), inArray(bookings.providerId, providerIds))!
      : eq(bookings.mobileUserId, mobileUserId);
    const conditions = [access];
    if (options.cursor) conditions.push(lt(bookings.startsAt, parseCursorDate(options.cursor)));
    if (options.category) conditions.push(eq(bookings.category, options.category));
    if (options.status === 'upcoming') {
      conditions.push(and(gte(bookings.startsAt, now), inArray(bookings.status, ACTIVE_STATUSES))!);
    } else if (options.status === 'past') {
      conditions.push(or(
        lt(bookings.startsAt, now),
        inArray(bookings.status, ['completed', 'cancelled', 'rejected', 'no_show']),
      )!);
    } else if (options.status) conditions.push(eq(bookings.status, options.status));

    if (options.filter === 'online') {
      conditions.push(eq(bookings.serviceMode, 'online'));
    } else if (options.filter === 'on_site') {
      conditions.push(inArray(bookings.serviceMode, ['center', 'home']));
    } else if (options.filter === 'classes') {
      conditions.push(or(
        eq(bookings.category, 'class'),
        sql`${bookings.metadata}->>'bookingType' IN ('class', 'group_session', 'course', 'workshop')`,
      )!);
    }

    const rows = await db
      .select({ booking: bookings, customerName: mobileUsers.displayName })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.startsAt)).limit(limit + 1);
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const [counts] = await db.select({
      all: sql<number>`count(*)::int`,
      onSite: sql<number>`count(*) filter (where ${bookings.serviceMode} in ('center', 'home'))::int`,
      online: sql<number>`count(*) filter (where ${bookings.serviceMode} = 'online')::int`,
      classes: sql<number>`count(*) filter (where ${bookings.category} = 'class' or ${bookings.metadata}->>'bookingType' in ('class', 'group_session', 'course', 'workshop'))::int`,
    }).from(bookings).where(access);
    return {
      bookings: items.map(({ booking, customerName }) => this.mapBookingRow(
        booking,
        booking.mobileUserId === mobileUserId ? 'customer' : 'provider',
        customerName,
      )),
      nextCursor: hasMore ? items.at(-1)!.booking.startsAt.toISOString() : null,
      counts: counts ?? { all: 0, onSite: 0, online: 0, classes: 0 },
    };
  }

  async updateCustomerDetails(
    bookingId: string,
    mobileUserId: string,
    update: CustomerUpdateBookingRequest,
  ): Promise<Booking | null> {
    const [existing] = await db.select().from(bookings).where(and(
      eq(bookings.id, bookingId),
      eq(bookings.mobileUserId, mobileUserId),
    ));
    if (!existing) return null;
    if (!ACTIVE_STATUSES.includes(existing.status)) {
      throw appError('This booking can no longer be edited', 'invalid_transition', 409);
    }
    const [row] = await db.update(bookings).set({
      detail: { ...existing.detail, ...update.detail },
      updatedAt: new Date(),
    }).where(eq(bookings.id, bookingId)).returning();
    await this.publishChange(row!);
    return this.mapBookingRow(row!, 'customer');
  }

  async cancelBooking(bookingId: string, mobileUserId: string, reason?: string) {
    const [existing] = await db.select().from(bookings).where(and(
      eq(bookings.id, bookingId),
      eq(bookings.mobileUserId, mobileUserId),
    ));
    if (!existing) return null;
    if (!ACTIVE_STATUSES.includes(existing.status)) {
      throw appError('This booking can no longer be cancelled', 'invalid_transition', 409);
    }
    const cancellationHours = Number(object(existing.metadata).cancellationWindowHours ?? 2);
    if (existing.status !== 'pending' && existing.startsAt.getTime() - Date.now() < cancellationHours * 3_600_000) {
      throw appError(`Confirmed bookings must be cancelled at least ${cancellationHours} hours before they start`, 'cancellation_window_closed', 409);
    }
    const [row] = await db.update(bookings).set({
      status: 'cancelled',
      cancelledAt: new Date(),
      updatedAt: new Date(),
      metadata: { ...object(existing.metadata), ...(reason ? { cancellationReason: reason } : {}) },
    }).where(eq(bookings.id, bookingId)).returning();
    if (row?.providerId) {
      await this.notifyProviderOwners(row.providerId, {
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        body: `${object(row.detail).serviceTitle ?? 'A booking'} was cancelled by the customer.`,
        data: { kind: 'booking', bookingId: row.id, providerId: row.providerId, screen: 'BookingDetail' },
      });
    }
    if (row) await this.publishChange(row);
    return row ? this.mapBookingRow(row, 'customer') : null;
  }

  async requestCustomerReschedule(
    bookingId: string,
    mobileUserId: string,
    request: CustomerRescheduleBookingRequest,
  ): Promise<Booking | null> {
    const result = await db.transaction(async tx => {
      const [existing] = await tx.select().from(bookings).where(and(
        eq(bookings.id, bookingId),
        eq(bookings.mobileUserId, mobileUserId),
      )).for('update');
      if (!existing) return null;
      if (!['pending', 'confirmed', 'reschedule_requested'].includes(existing.status)) {
        throw appError('This booking cannot be rescheduled', 'invalid_transition', 409);
      }
      if (!existing.providerId) {
        throw appError('This provider is unavailable', 'provider_unavailable', 409);
      }
      const startsAt = new Date(request.startsAt);
      const endsAt = request.endsAt !== undefined
        ? request.endsAt ? new Date(request.endsAt) : null
        : new Date(startsAt.getTime() + (existing.durationMinutes ?? 60) * 60_000);
      if (startsAt <= new Date() || (endsAt && endsAt <= startsAt)) {
        throw appError('Choose a valid future date and time', 'invalid_schedule', 400);
      }
      const [provider] = await tx.select().from(providers).where(and(
        eq(providers.id, existing.providerId),
        eq(providers.status, 'active'),
      ));
      if (!provider) throw appError('This provider is unavailable', 'provider_unavailable', 409);
      assertWithinProviderHours(
        provider,
        startsAt,
        endsAt ?? new Date(startsAt.getTime() + 60 * 60_000),
      );
      await this.assertNoConflict(
        tx,
        existing.providerId,
        mobileUserId,
        startsAt,
        endsAt ?? new Date(startsAt.getTime() + 60 * 60_000),
        existing.id,
      );
      const [row] = await tx.update(bookings).set({
        status: 'reschedule_requested',
        startsAt,
        endsAt,
        updatedAt: new Date(),
        metadata: {
          ...object(existing.metadata),
          rescheduleRequestedBy: 'customer',
          ...(request.reason ? { customerRescheduleReason: request.reason } : {}),
        },
      }).where(eq(bookings.id, bookingId)).returning();
      return row!;
    });
    if (!result) return null;
    if (result.providerId) {
      await this.notifyProviderOwners(result.providerId, {
        type: 'booking_rescheduled',
        title: 'Customer requested a new time',
        body: `${object(result.detail).serviceTitle ?? 'A booking'} was moved to ${result.startsAt.toLocaleString('en-IN')}.`,
        data: {
          kind: 'booking',
          bookingId: result.id,
          providerId: result.providerId,
          screen: 'BookingDetail',
        },
      });
    }
    await this.publishChange(result);
    return this.mapBookingRow(result, 'customer');
  }

  async actOnProviderBooking(
    mobileUserId: string,
    providerId: string,
    bookingId: string,
    request: ProviderBookingActionRequest,
  ): Promise<Booking> {
    const [membership] = await db.select({ role: providerMemberships.role })
      .from(providerMemberships)
      .where(and(
        eq(providerMemberships.mobileUserId, mobileUserId),
        eq(providerMemberships.providerId, providerId),
        inArray(providerMemberships.role, PROVIDER_ROLES),
      ));
    if (!membership) throw appError('Booking not found', 'not_found', 404);
    const allowed: Record<ProviderBookingActionRequest['action'], string[]> = {
      accept: ['pending', 'reschedule_requested'],
      reject: ['pending', 'reschedule_requested'],
      reschedule: ['pending', 'confirmed', 'reschedule_requested'],
      complete: ['confirmed'],
      no_show: ['confirmed'],
    };
    const nextStatus: BookingStatus =
      request.action === 'accept' ? 'confirmed' :
        request.action === 'reject' ? 'rejected' :
          request.action === 'reschedule' ? 'reschedule_requested' :
            request.action === 'complete' ? 'completed' : 'no_show';
    const result = await db.transaction(async tx => {
      const [existing] = await tx.select().from(bookings).where(and(
        eq(bookings.id, bookingId),
        eq(bookings.providerId, providerId),
      )).for('update');
      if (!existing) throw appError('Booking not found', 'not_found', 404);
      if (!allowed[request.action].includes(existing.status)) {
        throw appError(`Cannot ${request.action} a ${existing.status} booking`, 'invalid_transition', 409);
      }
      const startsAt = request.startsAt ? new Date(request.startsAt) : existing.startsAt;
      const endsAt = request.endsAt !== undefined
        ? request.endsAt ? new Date(request.endsAt) : null
        : request.startsAt
          ? new Date(startsAt.getTime() + (existing.durationMinutes ?? 60) * 60_000)
          : existing.endsAt;
      if (request.action === 'reschedule') {
        if (startsAt <= new Date()) throw appError('Choose a future date and time', 'invalid_schedule', 400);
        const [provider] = await tx.select().from(providers).where(and(
          eq(providers.id, providerId),
          eq(providers.status, 'active'),
        ));
        if (!provider) throw appError('This provider is unavailable', 'provider_unavailable', 409);
        assertWithinProviderHours(
          provider,
          startsAt,
          endsAt ?? new Date(startsAt.getTime() + 60 * 60_000),
        );
        await this.assertNoConflict(
          tx,
          providerId,
          existing.mobileUserId,
          startsAt,
          endsAt ?? new Date(startsAt.getTime() + 60 * 60_000),
          existing.id,
        );
      }
      const [row] = await tx.update(bookings).set({
        status: nextStatus,
        startsAt,
        endsAt,
        updatedAt: new Date(),
        completedAt: nextStatus === 'completed' ? new Date() : existing.completedAt,
        metadata: {
          ...object(existing.metadata),
          ...(request.action === 'reschedule' ? { rescheduleRequestedBy: 'provider' } : {}),
          ...(request.reason ? { providerReason: request.reason } : {}),
        },
      }).where(and(eq(bookings.id, bookingId), eq(bookings.providerId, providerId))).returning();
      return { existing, row: row!, startsAt };
    });

    const notification =
      nextStatus === 'confirmed'
        ? { type: 'booking_confirmed' as const, title: 'Booking confirmed', body: 'Your provider accepted the booking.' }
        : nextStatus === 'rejected'
          ? { type: 'booking_rejected' as const, title: 'Booking declined', body: request.reason || 'The provider could not accept this booking.' }
          : nextStatus === 'reschedule_requested'
            ? { type: 'booking_rescheduled' as const, title: 'Booking rescheduled', body: `New time: ${result.startsAt.toLocaleString('en-IN')}` }
            : nextStatus === 'completed'
              ? { type: 'booking_completed' as const, title: 'Booking completed', body: 'Your booking was marked complete.' }
              : { type: 'status_update' as const, title: 'Booking update', body: 'The provider marked this booking as no-show.' };
    await notificationService.notifyUser(result.existing.mobileUserId, {
      ...notification,
      data: { kind: 'booking', bookingId, providerId, screen: 'BookingDetail' },
    });
    await this.publishChange(result.row, [mobileUserId]);
    return this.mapBookingRow(result.row, 'provider');
  }

  async confirmCustomerReschedule(bookingId: string, mobileUserId: string) {
    const [existing] = await db.select().from(bookings).where(and(
      eq(bookings.id, bookingId),
      eq(bookings.mobileUserId, mobileUserId),
    ));
    if (!existing) return null;
    if (
      existing.status !== 'reschedule_requested' ||
      object(existing.metadata).rescheduleRequestedBy !== 'provider'
    ) {
      throw appError('There is no provider time proposal to accept', 'invalid_transition', 409);
    }
    const [row] = await db.update(bookings).set({
      status: 'confirmed',
      updatedAt: new Date(),
      metadata: { ...object(existing.metadata), rescheduleAcceptedAt: new Date().toISOString() },
    }).where(and(
      eq(bookings.id, bookingId),
      eq(bookings.mobileUserId, mobileUserId),
      eq(bookings.status, 'reschedule_requested'),
    )).returning();
    if (!row) throw appError('Booking changed. Refresh and try again.', 'booking_changed', 409);
    if (row.providerId) {
      await this.notifyProviderOwners(row.providerId, {
        type: 'booking_confirmed',
        title: 'New booking time accepted',
        body: `The customer accepted the new time for ${object(row.detail).serviceTitle ?? 'the booking'}.`,
        data: { kind: 'booking', bookingId: row.id, providerId: row.providerId, screen: 'BookingDetail' },
      });
    }
    await this.publishChange(row);
    return this.mapBookingRow(row, 'customer');
  }

  async sendDueReminders(now = new Date()) {
    const until = new Date(now.getTime() + 24 * 60 * 60_000);
    const rows = await db.select().from(bookings).where(and(
      inArray(bookings.status, ['confirmed', 'reschedule_requested']),
      gt(bookings.startsAt, now),
      lte(bookings.startsAt, until),
      isNull(bookings.reminderSentAt),
    )).orderBy(asc(bookings.startsAt)).limit(200);
    let sent = 0;
    for (const row of rows) {
      const [claimed] = await db.update(bookings)
        .set({ reminderSentAt: new Date() })
        .where(and(eq(bookings.id, row.id), isNull(bookings.reminderSentAt)))
        .returning({ id: bookings.id });
      if (!claimed) continue;
      const payload = {
        type: 'booking_reminder' as const,
        title: 'Booking reminder',
        body: `${object(row.detail).serviceTitle ?? 'Your booking'} starts ${row.startsAt.toLocaleString('en-IN')}.`,
        data: { kind: 'booking', bookingId: row.id, providerId: row.providerId, screen: 'BookingDetail' },
      };
      await notificationService.notifyUser(row.mobileUserId, payload);
      if (row.providerId) {
        await this.notifyProviderOwners(row.providerId, {
          ...payload,
          data: {
            ...payload.data,
            screen: 'BookingDetail',
          },
        });
      }
      await this.publishChange(row);
      sent += 1;
    }
    return sent;
  }

  async listBookingsAdmin(filters: {
    userId?: string; providerId?: string; status?: BookingStatus;
    from?: string; to?: string; limit?: number; cursor?: string;
  }): Promise<{ bookings: BookingAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);
    const conditions = [];
    if (filters.userId) conditions.push(eq(bookings.mobileUserId, filters.userId));
    if (filters.providerId) conditions.push(eq(bookings.providerId, filters.providerId));
    if (filters.status) conditions.push(eq(bookings.status, filters.status));
    if (filters.from) conditions.push(gte(bookings.startsAt, new Date(filters.from)));
    if (filters.to) conditions.push(lt(bookings.startsAt, new Date(filters.to)));
    if (filters.cursor) conditions.push(lt(bookings.startsAt, parseCursorDate(filters.cursor)));
    const rows = await db.select({ booking: bookings, user: mobileUsers, provider: providers })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(bookings.startsAt)).limit(limit + 1);
    const items = rows.slice(0, limit);
    return {
      bookings: items.map(({ booking, user, provider }) => ({
        ...this.mapBookingRow(booking),
        userName: user.displayName,
        userPhone: user.phone,
        providerName: provider?.name ?? null,
      })),
      nextCursor: rows.length > limit ? items.at(-1)!.booking.startsAt.toISOString() : null,
    };
  }

  async getBookingAdmin(bookingId: string): Promise<BookingAdminListItem | null> {
    const [row] = await db.select({ booking: bookings, user: mobileUsers, provider: providers })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(eq(bookings.id, bookingId));
    return row ? {
      ...this.mapBookingRow(row.booking),
      userName: row.user.displayName,
      userPhone: row.user.phone,
      providerName: row.provider?.name ?? null,
    } : null;
  }

  async updateBookingAdmin(bookingId: string, update: UpdateBookingRequest) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (update.startsAt) values.startsAt = new Date(update.startsAt);
    if (update.endsAt !== undefined) values.endsAt = update.endsAt ? new Date(update.endsAt) : null;
    if (update.status) {
      values.status = update.status;
      if (update.status === 'completed') values.completedAt = new Date();
      if (update.status === 'cancelled') values.cancelledAt = new Date();
    }
    if (update.amount !== undefined) values.amount = update.amount;
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.detail) {
      const [existing] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
      if (existing) values.detail = { ...existing.detail, ...update.detail };
    }
    if (update.metadata) values.metadata = update.metadata;
    const [row] = await db.update(bookings).set(values).where(eq(bookings.id, bookingId)).returning();
    if (row) await this.publishChange(row);
    return row ? this.mapBookingRow(row) : null;
  }

  private mapBookingRow(
    row: typeof bookings.$inferSelect,
    viewerRole: Booking['viewerRole'] = 'customer',
    customerName?: string,
  ): Booking {
    const legacyStatus: Record<string, BookingStatus> = {
      provider_assigned: 'confirmed',
      on_the_way: 'confirmed',
      in_progress: 'confirmed',
    };
    const metadata = object(row.metadata);
    const rawType = typeof metadata.bookingType === 'string'
      ? metadata.bookingType
      : row.category;
    const supportedTypes: Booking['bookingType'][] = [
      'appointment', 'class', 'group_session', 'course', 'workshop',
      'home_service', 'lab', 'event', 'hospital', 'other',
    ];
    const bookingType = supportedTypes.includes(rawType as Booking['bookingType'])
      ? rawType as Booking['bookingType']
      : 'other';
    return {
      id: row.id,
      mobileUserId: row.mobileUserId,
      providerId: row.providerId,
      categoryId: row.categoryId,
      category: row.category as Booking['category'],
      bookingMode: row.serviceMode === 'online' ? 'online' : 'on_site',
      bookingType,
      viewerRole,
      ...(customerName ? { customerName } : {}),
      status: legacyStatus[row.status] ?? row.status as Booking['status'],
      serviceMode: row.serviceMode as Booking['serviceMode'],
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      durationMinutes: row.durationMinutes,
      amount: row.amount,
      paymentStatus: row.paymentStatus as Booking['paymentStatus'],
      detail: row.detail as Booking['detail'],
      metadata: row.metadata as Booking['metadata'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}

export const bookingService = new BookingService();

let reminderTimer: ReturnType<typeof setInterval> | null = null;
export function startBookingReminderJob() {
  if (reminderTimer) return;
  const run = () => bookingService.sendDueReminders().catch(error => {
    console.error('[BookingService] reminder job failed', error);
  });
  void run();
  reminderTimer = setInterval(run, 60 * 60_000);
  reminderTimer.unref?.();
}
