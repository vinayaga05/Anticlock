import { and, desc, eq, isNull, sql, ilike, or, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  mediaAssets,
  mediaUsages,
  stubBanners,
  stubProducts,
  stubProviders,
  uploadSessions,
  users,
} from '../db/schema.js';

export type MediaListFilters = {
  q?: string;
  kind?: string;
  status?: string;
  accessLevel?: string;
  limit: number;
};

export class MediaRepository {
  async createAsset(values: typeof mediaAssets.$inferInsert) {
    const [row] = await db.insert(mediaAssets).values(values).returning();
    return row!;
  }

  async updateAsset(id: string, values: Partial<typeof mediaAssets.$inferInsert>) {
    const [row] = await db
      .update(mediaAssets)
      .set(values)
      .where(eq(mediaAssets.id, id))
      .returning();
    return row;
  }

  async getAsset(id: string) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)));
    return row ?? null;
  }

  async findByChecksum(checksum: string) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.checksumSha256, checksum),
          eq(mediaAssets.processingStatus, 'ready'),
          isNull(mediaAssets.deletedAt),
          isNull(mediaAssets.archivedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listAssets(filters: MediaListFilters) {
    const conditions = [isNull(mediaAssets.deletedAt)];
    if (filters.kind) conditions.push(eq(mediaAssets.kind, filters.kind));
    if (filters.status) {
      conditions.push(eq(mediaAssets.processingStatus, filters.status));
    }
    if (filters.accessLevel) {
      conditions.push(eq(mediaAssets.accessLevel, filters.accessLevel));
    }
    if (filters.q) {
      conditions.push(
        or(
          ilike(mediaAssets.originalFilename, `%${filters.q}%`),
          ilike(mediaAssets.mimeType, `%${filters.q}%`),
        )!,
      );
    }

    const rows = await db
      .select({
        asset: mediaAssets,
        createdByName: users.name,
        usageCount: sql<number>`(
          select count(*)::int from media_usages mu where mu.media_id = ${mediaAssets.id}
        )`,
      })
      .from(mediaAssets)
      .leftJoin(users, eq(mediaAssets.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(mediaAssets.createdAt))
      .limit(filters.limit);

    return rows;
  }

  async createSession(values: typeof uploadSessions.$inferInsert) {
    const [row] = await db.insert(uploadSessions).values(values).returning();
    return row!;
  }

  async getSession(id: string) {
    const [row] = await db
      .select()
      .from(uploadSessions)
      .where(eq(uploadSessions.id, id));
    return row ?? null;
  }

  async updateSession(
    id: string,
    values: Partial<typeof uploadSessions.$inferInsert>,
  ) {
    const [row] = await db
      .update(uploadSessions)
      .set(values)
      .where(eq(uploadSessions.id, id))
      .returning();
    return row;
  }

  async listUsages(mediaId: string) {
    return db.select().from(mediaUsages).where(eq(mediaUsages.mediaId, mediaId));
  }

  async usageCount(mediaId: string) {
    const [row] = await db
      .select({ value: count() })
      .from(mediaUsages)
      .where(eq(mediaUsages.mediaId, mediaId));
    return Number(row?.value ?? 0);
  }

  async attachUsage(values: typeof mediaUsages.$inferInsert) {
    const [row] = await db
      .insert(mediaUsages)
      .values(values)
      .onConflictDoUpdate({
        target: [
          mediaUsages.mediaId,
          mediaUsages.entityType,
          mediaUsages.entityId,
          mediaUsages.usageType,
        ],
        set: { sortOrder: values.sortOrder ?? 0 },
      })
      .returning();
    return row!;
  }

  async detachUsage(id: string) {
    const [row] = await db
      .delete(mediaUsages)
      .where(eq(mediaUsages.id, id))
      .returning();
    return row ?? null;
  }

  async getUsage(id: string) {
    const [row] = await db.select().from(mediaUsages).where(eq(mediaUsages.id, id));
    return row ?? null;
  }

  async usagesForEntity(entityType: string, entityId: string) {
    return db
      .select()
      .from(mediaUsages)
      .where(
        and(
          eq(mediaUsages.entityType, entityType),
          eq(mediaUsages.entityId, entityId),
        ),
      );
  }

  async replaceEntityUsages(
    entityType: string,
    entityId: string,
    usageType: string,
    mediaIds: string[],
  ) {
    const existing = await this.usagesForEntity(entityType, entityId);
    for (const u of existing.filter(x => x.usageType === usageType)) {
      await db.delete(mediaUsages).where(eq(mediaUsages.id, u.id));
    }
    const created = [];
    for (let i = 0; i < mediaIds.length; i++) {
      created.push(
        await this.attachUsage({
          mediaId: mediaIds[i]!,
          entityType,
          entityId,
          usageType,
          sortOrder: i,
        }),
      );
    }
    return created;
  }

  async resolveEntityLabel(entityType: string, entityId: string) {
    if (entityType === 'PROVIDER') {
      const [p] = await db
        .select()
        .from(stubProviders)
        .where(eq(stubProviders.id, entityId));
      return p?.name ?? entityId;
    }
    if (entityType === 'PRODUCT') {
      const [p] = await db
        .select()
        .from(stubProducts)
        .where(eq(stubProducts.id, entityId));
      return p?.name ?? entityId;
    }
    if (entityType === 'BANNER') {
      const [b] = await db
        .select()
        .from(stubBanners)
        .where(eq(stubBanners.id, entityId));
      return b?.title ?? entityId;
    }
    return entityId;
  }

  listProviders() {
    return db.select().from(stubProviders);
  }

  listProducts() {
    return db.select().from(stubProducts);
  }

  listBanners() {
    return db.select().from(stubBanners);
  }

  getProvider(id: string) {
    return db
      .select()
      .from(stubProviders)
      .where(eq(stubProviders.id, id))
      .then(r => r[0] ?? null);
  }

  getProduct(id: string) {
    return db
      .select()
      .from(stubProducts)
      .where(eq(stubProducts.id, id))
      .then(r => r[0] ?? null);
  }

  getBanner(id: string) {
    return db
      .select()
      .from(stubBanners)
      .where(eq(stubBanners.id, id))
      .then(r => r[0] ?? null);
  }
}

export const mediaRepository = new MediaRepository();
