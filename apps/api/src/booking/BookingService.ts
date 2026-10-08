import { and, desc, eq, gte, lt, or } from 'drizzle-orm';
import type {
  Booking,
  BookingAdminListItem,
  BookingStatus,
  CreateBookingRequest,
  UpdateBookingRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { bookings, mobileUsers, providers } from '../db/schema.js';
import { parseCursorDate } from '../lib/cursor.js';

export class BookingService {
  async createBooking(
    mobileUserId: string,
    request: CreateBookingRequest,
  ): Promise<Booking> {
    if (request.providerId) {
      // Only approved, active business profiles can take bookings.
      const [provider] = await db
        .select({ id: providers.id, status: providers.status })
        .from(providers)
        .where(eq(providers.id, request.providerId))
        .limit(1);
      if (!provider || provider.status !== 'active') {
        throw Object.assign(new Error('This provider is not accepting bookings'), {
          code: 'provider_unavailable',
          status: 400,
        });
      }
    }
    const [row] = await db
      .insert(bookings)
      .values({
        mobileUserId,
        providerId: request.providerId ?? null,
        categoryId: request.categoryId ?? null,
        category: request.category,
        status: 'pending',
        serviceMode: request.serviceMode,
        startsAt: new Date(request.startsAt),
        endsAt: request.endsAt ? new Date(request.endsAt) : null,
        durationMinutes: request.durationMinutes ?? null,
        amount: request.amount ?? null,
        paymentStatus: 'pending',
        detail: request.detail as Record<string, unknown>,
        metadata: request.metadata ?? null,
      })
      .returning();

    return this.mapBookingRow(row!);
  }

  async getBooking(bookingId: string, mobileUserId: string): Promise<Booking | null> {
    const [row] = await db
      .select()
      .from(bookings)
      .where(
        and(eq(bookings.id, bookingId), eq(bookings.mobileUserId, mobileUserId)),
      );

    return row ? this.mapBookingRow(row) : null;
  }

  async listBookings(
    mobileUserId: string,
    options: {
      status?: BookingStatus | 'upcoming' | 'past';
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ bookings: Booking[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);
    const now = new Date();

    let conditions = [eq(bookings.mobileUserId, mobileUserId)];

    if (options.cursor) {
      conditions.push(lt(bookings.startsAt, parseCursorDate(options.cursor)));
    }

    if (options.status === 'upcoming') {
      conditions.push(
        and(
          gte(bookings.startsAt, now),
          or(
            eq(bookings.status, 'pending'),
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'provider_assigned'),
            eq(bookings.status, 'on_the_way'),
            eq(bookings.status, 'in_progress'),
          ),
        )!,
      );
    } else if (options.status === 'past') {
      conditions.push(
        or(
          lt(bookings.startsAt, now),
          eq(bookings.status, 'completed'),
          eq(bookings.status, 'cancelled'),
          eq(bookings.status, 'no_show'),
        )!,
      );
    } else if (options.status) {
      conditions.push(eq(bookings.status, options.status));
    }

    const rows = await db
      .select()
      .from(bookings)
      .where(and(...conditions))
      .orderBy(desc(bookings.startsAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      bookings: items.map(row => this.mapBookingRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.startsAt.toISOString() : null,
    };
  }

  async updateBooking(
    bookingId: string,
    mobileUserId: string,
    update: UpdateBookingRequest,
  ): Promise<Booking | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.startsAt) values.startsAt = new Date(update.startsAt);
    if (update.endsAt !== undefined) values.endsAt = update.endsAt ? new Date(update.endsAt) : null;
    if (update.status) {
      values.status = update.status;
      if (update.status === 'completed') {
        values.completedAt = new Date();
      }
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
    }
    if (update.amount !== undefined) values.amount = update.amount;
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.detail) {
      const [existing] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      if (existing) {
        values.detail = { ...existing.detail, ...update.detail };
      }
    }
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(bookings)
      .set(values)
      .where(
        and(eq(bookings.id, bookingId), eq(bookings.mobileUserId, mobileUserId)),
      )
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  async cancelBooking(
    bookingId: string,
    mobileUserId: string,
    reason?: string,
  ): Promise<Booking | null> {
    const [row] = await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
        metadata: reason ? { cancellationReason: reason } : undefined,
      })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.mobileUserId, mobileUserId),
          or(
            eq(bookings.status, 'pending'),
            eq(bookings.status, 'confirmed'),
            eq(bookings.status, 'provider_assigned'),
          ),
        ),
      )
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  async listBookingsAdmin(filters: {
    userId?: string;
    providerId?: string;
    status?: BookingStatus;
    from?: string;
    to?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ bookings: BookingAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);

    const conditions = [];
    if (filters.userId) conditions.push(eq(bookings.mobileUserId, filters.userId));
    if (filters.providerId) conditions.push(eq(bookings.providerId, filters.providerId));
    if (filters.status) conditions.push(eq(bookings.status, filters.status));
    if (filters.from) conditions.push(gte(bookings.startsAt, new Date(filters.from)));
    if (filters.to) conditions.push(lt(bookings.startsAt, new Date(filters.to)));
    if (filters.cursor) conditions.push(lt(bookings.startsAt, parseCursorDate(filters.cursor)));

    const rows = await db
      .select({
        booking: bookings,
        user: mobileUsers,
        provider: providers,
      })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.startsAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      bookings: items.map(({ booking, user, provider }) => ({
        ...this.mapBookingRow(booking),
        userName: user.displayName,
        userPhone: user.phone,
        providerName: provider?.name ?? null,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.booking.startsAt.toISOString()
        : null,
    };
  }

  async getBookingAdmin(bookingId: string): Promise<BookingAdminListItem | null> {
    const [row] = await db
      .select({
        booking: bookings,
        user: mobileUsers,
        provider: providers,
      })
      .from(bookings)
      .innerJoin(mobileUsers, eq(bookings.mobileUserId, mobileUsers.id))
      .leftJoin(providers, eq(bookings.providerId, providers.id))
      .where(eq(bookings.id, bookingId));

    if (!row) return null;

    return {
      ...this.mapBookingRow(row.booking),
      userName: row.user.displayName,
      userPhone: row.user.phone,
      providerName: row.provider?.name ?? null,
    };
  }

  async updateBookingAdmin(
    bookingId: string,
    update: UpdateBookingRequest,
  ): Promise<Booking | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.startsAt) values.startsAt = new Date(update.startsAt);
    if (update.endsAt !== undefined) values.endsAt = update.endsAt ? new Date(update.endsAt) : null;
    if (update.status) {
      values.status = update.status;
      if (update.status === 'completed') {
        values.completedAt = new Date();
      }
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
    }
    if (update.amount !== undefined) values.amount = update.amount;
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.detail) {
      const [existing] = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId));
      if (existing) {
        values.detail = { ...existing.detail, ...update.detail };
      }
    }
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(bookings)
      .set(values)
      .where(eq(bookings.id, bookingId))
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  private mapBookingRow(row: typeof bookings.$inferSelect): Booking {
    return {
      id: row.id,
      mobileUserId: row.mobileUserId,
      providerId: row.providerId,
      categoryId: row.categoryId,
      category: row.category as Booking['category'],
      status: row.status as Booking['status'],
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
