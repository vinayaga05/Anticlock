import { and, desc, eq, ilike, lt, or } from 'drizzle-orm';
import type {
  Trip,
  TripWithImages,
  CreateTripRequest,
  UpdateTripRequest,
  TripStatus,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { trips, mediaAssets } from '../db/schema.js';
import { parseCursorDate } from '../lib/cursor.js';

export class TripService {
  async createTrip(request: CreateTripRequest): Promise<Trip> {
    const [row] = await db
      .insert(trips)
      .values({
        name: request.name,
        slug: request.slug,
        description: request.description,
        destination: request.destination,
        durationDays: request.durationDays,
        basePrice: request.basePrice,
        maxGroupSize: request.maxGroupSize,
        itinerary: request.itinerary as unknown[],
        inclusions: request.inclusions ?? [],
        exclusions: request.exclusions ?? [],
        difficulty: request.difficulty,
        imageIds: request.imageIds ?? [],
        status: request.status ?? 'draft',
        metadata: request.metadata ?? null,
      })
      .returning();

    return this.mapTripRow(row!);
  }

  async getTrip(tripId: string): Promise<Trip | null> {
    const [row] = await db
      .select()
      .from(trips)
      .where(eq(trips.id, tripId));

    return row ? this.mapTripRow(row) : null;
  }

  async getTripBySlug(slug: string): Promise<Trip | null> {
    const [row] = await db
      .select()
      .from(trips)
      .where(eq(trips.slug, slug));

    return row ? this.mapTripRow(row) : null;
  }

  async getTripWithImages(tripId: string): Promise<TripWithImages | null> {
    const trip = await this.getTrip(tripId);
    if (!trip) return null;

    const images = await this.getTripImages(trip.imageIds);
    return { ...trip, images };
  }

  async listTrips(options: {
    destination?: string;
    difficulty?: Trip['difficulty'];
    status?: TripStatus;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ trips: Trip[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [];
    if (options.destination) {
      conditions.push(ilike(trips.destination, `%${options.destination}%`));
    }
    if (options.difficulty) {
      conditions.push(eq(trips.difficulty, options.difficulty));
    }
    if (options.status) {
      conditions.push(eq(trips.status, options.status));
    }
    if (options.search) {
      conditions.push(
        or(
          ilike(trips.name, `%${options.search}%`),
          ilike(trips.description, `%${options.search}%`),
          ilike(trips.destination, `%${options.search}%`),
        )!,
      );
    }
    if (options.cursor) {
      conditions.push(lt(trips.createdAt, parseCursorDate(options.cursor)));
    }

    const rows = await db
      .select()
      .from(trips)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(trips.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      trips: items.map(row => this.mapTripRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async updateTrip(
    tripId: string,
    update: UpdateTripRequest,
  ): Promise<Trip | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.name) values.name = update.name;
    if (update.slug) values.slug = update.slug;
    if (update.description) values.description = update.description;
    if (update.destination) values.destination = update.destination;
    if (update.durationDays !== undefined) values.durationDays = update.durationDays;
    if (update.basePrice !== undefined) values.basePrice = update.basePrice;
    if (update.maxGroupSize !== undefined)
      values.maxGroupSize = update.maxGroupSize;
    if (update.itinerary) values.itinerary = update.itinerary as unknown[];
    if (update.inclusions) values.inclusions = update.inclusions;
    if (update.exclusions) values.exclusions = update.exclusions;
    if (update.difficulty) values.difficulty = update.difficulty;
    if (update.imageIds) values.imageIds = update.imageIds;
    if (update.status) values.status = update.status;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(trips)
      .set(values)
      .where(eq(trips.id, tripId))
      .returning();

    return row ? this.mapTripRow(row) : null;
  }

  async deleteTrip(tripId: string): Promise<boolean> {
    const result = await db.delete(trips).where(eq(trips.id, tripId));
    return result.length > 0;
  }

  async checkAvailability(
    tripId: string,
    startDate: Date,
    numberOfTravelers: number,
  ): Promise<{ available: boolean; remainingSlots: number }> {
    const trip = await this.getTrip(tripId);
    if (!trip) {
      throw Object.assign(new Error('Trip not found'), {
        code: 'trip_not_found',
        status: 404,
      });
    }

    // This is simplified - in a real system, you'd track slot allocation per date
    // For now, we just check if the request doesn't exceed max group size
    const available = numberOfTravelers <= trip.maxGroupSize;
    const remainingSlots = Math.max(0, trip.maxGroupSize - numberOfTravelers);

    return { available, remainingSlots };
  }

  private async getTripImages(imageIds: string[]) {
    if (imageIds.length === 0) return [];

    const rows = await db
      .select({
        id: mediaAssets.id,
        storageKey: mediaAssets.storageKey,
        width: mediaAssets.width,
        height: mediaAssets.height,
      })
      .from(mediaAssets)
      .where(
        and(
          or(...imageIds.map(id => eq(mediaAssets.id, id)))!,
          eq(mediaAssets.kind, 'image'),
        ),
      );

    // Preserve order from imageIds
    const imageMap = new Map(rows.map(r => [r.id, r]));
    return imageIds
      .map(id => imageMap.get(id))
      .filter((img): img is NonNullable<typeof img> => img !== undefined)
      .map(img => ({
        id: img.id,
        url: img.storageKey,
        width: img.width,
        height: img.height,
      }));
  }

  private mapTripRow(row: typeof trips.$inferSelect): Trip {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      destination: row.destination,
      durationDays: row.durationDays,
      basePrice: row.basePrice,
      maxGroupSize: row.maxGroupSize,
      itinerary: row.itinerary as Trip['itinerary'],
      inclusions: (row.inclusions as string[]) ?? [],
      exclusions: (row.exclusions as string[]) ?? [],
      difficulty: row.difficulty as Trip['difficulty'],
      imageIds: (row.imageIds as string[]) ?? [],
      status: row.status as Trip['status'],
      metadata: row.metadata as Trip['metadata'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const tripService = new TripService();
