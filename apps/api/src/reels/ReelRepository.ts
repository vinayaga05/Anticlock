import { and, asc, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../db/client.js';
import { mediaAssets, reels } from '../db/schema.js';

export type ReelListFilters = {
  status?: string;
  isSample?: boolean;
  q?: string;
  limit: number;
};

export class ReelRepository {
  async create(values: typeof reels.$inferInsert) {
    const [row] = await db.insert(reels).values(values).returning();
    return row!;
  }

  async update(id: string, values: Partial<typeof reels.$inferInsert>) {
    const [row] = await db
      .update(reels)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(reels.id, id))
      .returning();
    return row ?? null;
  }

  async get(id: string) {
    const [row] = await db.select().from(reels).where(eq(reels.id, id));
    return row ?? null;
  }

  async getWithMedia(id: string) {
    const reel = await this.get(id);
    if (!reel) return null;
    const media = reel.mediaId
      ? (
          await db
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.id, reel.mediaId))
            .limit(1)
        )[0] ?? null
      : null;
    const thumb = reel.thumbnailMediaId
      ? (
          await db
            .select()
            .from(mediaAssets)
            .where(eq(mediaAssets.id, reel.thumbnailMediaId))
            .limit(1)
        )[0] ?? null
      : null;
    return { reel, media, thumb };
  }

  async list(filters: ReelListFilters) {
    const conditions = [];
    if (filters.status) conditions.push(eq(reels.status, filters.status));
    if (filters.isSample !== undefined) {
      conditions.push(eq(reels.isSample, filters.isSample));
    }
    if (filters.q) {
      conditions.push(
        or(
          ilike(reels.title, `%${filters.q}%`),
          ilike(reels.creatorName, `%${filters.q}%`),
          ilike(reels.caption, `%${filters.q}%`),
        )!,
      );
    }

    return db
      .select({
        reel: reels,
        media: mediaAssets,
      })
      .from(reels)
      .leftJoin(mediaAssets, eq(reels.mediaId, mediaAssets.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(reels.displayOrder), desc(reels.createdAt))
      .limit(filters.limit);
  }

  async listPublished(limit = 50) {
    return db
      .select({
        reel: reels,
        media: mediaAssets,
      })
      .from(reels)
      .innerJoin(mediaAssets, eq(reels.mediaId, mediaAssets.id))
      .where(
        and(
          eq(reels.status, 'published'),
          eq(mediaAssets.processingStatus, 'ready'),
          isNull(mediaAssets.deletedAt),
        ),
      )
      .orderBy(asc(reels.displayOrder), desc(reels.publishedAt))
      .limit(limit);
  }

  async findMediaByExternalId(externalId: string) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.externalId, externalId),
          isNull(mediaAssets.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }
}

export const reelRepository = new ReelRepository();
