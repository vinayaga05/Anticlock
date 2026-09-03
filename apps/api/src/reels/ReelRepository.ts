import { and, asc, desc, eq, ilike, isNull, lte, ne, or } from 'drizzle-orm';
import { MAX_REEL_VIDEO_DURATION_MS } from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mediaAssets, reels } from '../db/schema.js';

export type ReelListFilters = {
  status?: string;
  contentMode?: string;
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
    if (filters.contentMode) {
      conditions.push(eq(reels.contentMode, filters.contentMode));
    }
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
          eq(reels.moderationStatus, 'clear'),
          ne(reels.contentMode, 'test'),
          eq(mediaAssets.kind, 'video'),
          eq(mediaAssets.mimeType, 'video/mp4'),
          // Public Clips feed is R2-only — no external sample URLs or local files.
          eq(mediaAssets.storageProvider, 'r2'),
          eq(mediaAssets.accessLevel, 'public'),
          eq(mediaAssets.processingStatus, 'ready'),
          or(
            eq(mediaAssets.moderationStatus, 'approved'),
            eq(mediaAssets.moderationStatus, 'not_required'),
          ),
          isNull(mediaAssets.deletedAt),
          isNull(mediaAssets.archivedAt),
          lte(mediaAssets.durationMs, MAX_REEL_VIDEO_DURATION_MS),
        ),
      )
      .orderBy(asc(reels.displayOrder), desc(reels.publishedAt))
      .limit(limit);
  }

  /**
   * Resolves a Reel only when it is still safely published and playable. This
   * gates all mobile engagement writes so drafts, review items, restricted
   * items, and arbitrary R2 objects can never acquire public engagement.
   */
  async getPublishedForEngagement(id: string, allowUnderReview = false) {
    return (
      (
        await db
          .select({ reel: reels, media: mediaAssets })
          .from(reels)
          .innerJoin(mediaAssets, eq(reels.mediaId, mediaAssets.id))
          .where(
            and(
              eq(reels.id, id),
              eq(reels.status, 'published'),
              ne(reels.contentMode, 'test'),
              allowUnderReview
                ? or(
                    eq(reels.moderationStatus, 'clear'),
                    eq(reels.moderationStatus, 'under_review'),
                  )
                : eq(reels.moderationStatus, 'clear'),
              eq(mediaAssets.kind, 'video'),
              eq(mediaAssets.mimeType, 'video/mp4'),
              eq(mediaAssets.storageProvider, 'r2'),
              eq(mediaAssets.accessLevel, 'public'),
              eq(mediaAssets.processingStatus, 'ready'),
              or(
                eq(mediaAssets.moderationStatus, 'approved'),
                eq(mediaAssets.moderationStatus, 'not_required'),
              ),
              isNull(mediaAssets.deletedAt),
              isNull(mediaAssets.archivedAt),
              lte(mediaAssets.durationMs, MAX_REEL_VIDEO_DURATION_MS),
            ),
          )
          .limit(1)
      )[0] ?? null
    );
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
