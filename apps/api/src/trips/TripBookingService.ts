import { and, desc, eq, gte, ilike, lt, or } from 'drizzle-orm';
import type {
  TripBooking,
  TripBookingWithTrip,
  TripBookingAdminListItem,
  TripBookingStatus,
  CreateTripBookingRequest,
  UpdateTripBookingRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { tripBookings, trips, mobileUsers } from '../db/schema.js';
import { tripService } from './TripService.js';

export class TripBookingService {
  async createBooking(
    mobileUserId: string,
    request: CreateTripBookingRequest,
  ): Promise<TripBooking> {
    // Validate trip exists and is published
    const trip = await tripService.getTrip(request.tripId);
    if (!trip) {
      throw Object.assign(new Error('Trip not found'), {
        code: 'trip_not_found',
        status: 404,
      });
    }

    if (trip.status !== 'published') {
      throw Object.assign(new Error('Trip is not available for booking'), {
        code: 'trip_not_published',
        status: 400,
      });
    }

    // Validate number of travelers matches traveler details
    if (request.travelerDetails.length !== request.numberOfTravelers) {
      throw Object.assign(
        new Error('Number of travelers must match traveler details count'),
        {
          code: 'traveler_count_mismatch',
          status: 400,
        },
      );
    }

    // Check availability
    const startDate = new Date(request.startDate);
    const availability = await tripService.checkAvailability(
      request.tripId,
      startDate,
      request.numberOfTravelers,
    );

    if (!availability.available) {
      throw Object.assign(new Error('Trip is not available for the selected date'), {
        code: 'trip_unavailable',
        status: 400,
      });
    }

    // Calculate total price (simplified - could have per-traveler pricing)
    const totalPrice = trip.basePrice * request.numberOfTravelers;

    // Generate booking number
    const bookingNumber = this.generateBookingNumber();

    const [row] = await db
      .insert(tripBookings)
      .values({
        bookingNumber,
        tripId: request.tripId,
        mobileUserId,
        startDate,
        numberOfTravelers: request.numberOfTravelers,
        totalPrice,
        status: 'pending',
        paymentStatus: 'pending',
        travelerDetails: request.travelerDetails as Record<string, unknown>[],
        specialRequests: request.specialRequests ?? null,
      })
      .returning();

    return this.mapBookingRow(row!);
  }

  async getBooking(
    bookingId: string,
    mobileUserId: string,
  ): Promise<TripBooking | null> {
    const [row] = await db
      .select()
      .from(tripBookings)
      .where(
        and(eq(tripBookings.id, bookingId), eq(tripBookings.mobileUserId, mobileUserId)),
      );

    return row ? this.mapBookingRow(row) : null;
  }

  async getBookingWithTrip(
    bookingId: string,
    mobileUserId: string,
  ): Promise<TripBookingWithTrip | null> {
    const [row] = await db
      .select({
        booking: tripBookings,
        trip: trips,
      })
      .from(tripBookings)
      .innerJoin(trips, eq(tripBookings.tripId, trips.id))
      .where(
        and(eq(tripBookings.id, bookingId), eq(tripBookings.mobileUserId, mobileUserId)),
      );

    if (!row) return null;

    return {
      ...this.mapBookingRow(row.booking),
      tripName: row.trip.name,
      tripDestination: row.trip.destination,
      tripDurationDays: row.trip.durationDays,
    };
  }

  async listBookings(
    mobileUserId: string,
    options: {
      status?: TripBookingStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ bookings: TripBookingWithTrip[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [eq(tripBookings.mobileUserId, mobileUserId)];
    if (options.status) conditions.push(eq(tripBookings.status, options.status));
    if (options.cursor)
      conditions.push(lt(tripBookings.createdAt, new Date(options.cursor)));

    const rows = await db
      .select({
        booking: tripBookings,
        trip: trips,
      })
      .from(tripBookings)
      .innerJoin(trips, eq(tripBookings.tripId, trips.id))
      .where(and(...conditions))
      .orderBy(desc(tripBookings.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      bookings: items.map(({ booking, trip }) => ({
        ...this.mapBookingRow(booking),
        tripName: trip.name,
        tripDestination: trip.destination,
        tripDurationDays: trip.durationDays,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.booking.createdAt.toISOString()
        : null,
    };
  }

  async updateBooking(
    bookingId: string,
    mobileUserId: string,
    update: UpdateTripBookingRequest,
  ): Promise<TripBooking | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.status) {
      values.status = update.status;
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
      if (update.status === 'completed') {
        values.completedAt = new Date();
      }
    }
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.specialRequests) values.specialRequests = update.specialRequests;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(tripBookings)
      .set(values)
      .where(
        and(eq(tripBookings.id, bookingId), eq(tripBookings.mobileUserId, mobileUserId)),
      )
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  async cancelBooking(
    bookingId: string,
    mobileUserId: string,
  ): Promise<TripBooking | null> {
    const [row] = await db
      .update(tripBookings)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tripBookings.id, bookingId),
          eq(tripBookings.mobileUserId, mobileUserId),
          or(
            eq(tripBookings.status, 'pending'),
            eq(tripBookings.status, 'confirmed'),
          )!,
        ),
      )
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  async listBookingsAdmin(filters: {
    userId?: string;
    tripId?: string;
    status?: TripBookingStatus;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ bookings: TripBookingAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);

    const conditions = [];
    if (filters.userId) conditions.push(eq(tripBookings.mobileUserId, filters.userId));
    if (filters.tripId) conditions.push(eq(tripBookings.tripId, filters.tripId));
    if (filters.status) conditions.push(eq(tripBookings.status, filters.status));
    if (filters.from)
      conditions.push(gte(tripBookings.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lt(tripBookings.createdAt, new Date(filters.to)));
    if (filters.search) {
      conditions.push(ilike(tripBookings.bookingNumber, `%${filters.search}%`));
    }
    if (filters.cursor)
      conditions.push(lt(tripBookings.createdAt, new Date(filters.cursor)));

    const rows = await db
      .select({
        booking: tripBookings,
        trip: trips,
        user: mobileUsers,
      })
      .from(tripBookings)
      .innerJoin(trips, eq(tripBookings.tripId, trips.id))
      .innerJoin(mobileUsers, eq(tripBookings.mobileUserId, mobileUsers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(tripBookings.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      bookings: items.map(({ booking, trip, user }) => ({
        ...this.mapBookingRow(booking),
        tripName: trip.name,
        userName: user.displayName,
        userPhone: user.phone,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.booking.createdAt.toISOString()
        : null,
    };
  }

  async getBookingAdmin(bookingId: string): Promise<TripBookingAdminListItem | null> {
    const [row] = await db
      .select({
        booking: tripBookings,
        trip: trips,
        user: mobileUsers,
      })
      .from(tripBookings)
      .innerJoin(trips, eq(tripBookings.tripId, trips.id))
      .innerJoin(mobileUsers, eq(tripBookings.mobileUserId, mobileUsers.id))
      .where(eq(tripBookings.id, bookingId));

    if (!row) return null;

    return {
      ...this.mapBookingRow(row.booking),
      tripName: row.trip.name,
      userName: row.user.displayName,
      userPhone: row.user.phone,
    };
  }

  async updateBookingAdmin(
    bookingId: string,
    update: UpdateTripBookingRequest,
  ): Promise<TripBooking | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.status) {
      values.status = update.status;
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
      if (update.status === 'completed') {
        values.completedAt = new Date();
      }
    }
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.specialRequests) values.specialRequests = update.specialRequests;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(tripBookings)
      .set(values)
      .where(eq(tripBookings.id, bookingId))
      .returning();

    return row ? this.mapBookingRow(row) : null;
  }

  private generateBookingNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TRB-${timestamp}-${random}`;
  }

  private mapBookingRow(row: typeof tripBookings.$inferSelect): TripBooking {
    return {
      id: row.id,
      tripId: row.tripId,
      mobileUserId: row.mobileUserId,
      bookingNumber: row.bookingNumber,
      startDate: row.startDate.toISOString(),
      numberOfTravelers: row.numberOfTravelers,
      totalPrice: row.totalPrice,
      status: row.status as TripBooking['status'],
      paymentStatus: row.paymentStatus as TripBooking['paymentStatus'],
      travelerDetails: row.travelerDetails as TripBooking['travelerDetails'],
      specialRequests: row.specialRequests ?? undefined,
      metadata: row.metadata as TripBooking['metadata'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }
}

export const tripBookingService = new TripBookingService();
