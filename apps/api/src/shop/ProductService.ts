import { randomUUID } from 'node:crypto';
import { and, desc, eq, ilike, lt, or, sql } from 'drizzle-orm';
import type {
  CreateProductRequest,
  CreateUserProductRequest,
  ExploreReviewRequest,
  Product,
  ProductImage,
  UpdateProductRequest,
  UpdateUserProductRequest,
} from '@anticlock/contracts';
import { CreateUserProductRequestSchema } from '@anticlock/contracts';
import { db } from '../db/client.js';
import { exploreSaves, mediaAssets, productCategories, productImages, products } from '../db/schema.js';
import { mediaService } from '../media/MediaService.js';
import {
  authorColumnsFor,
  loadPublisher,
  publisherRefFromAuthor,
  resolveOwnedPublisher,
  type PublisherRef,
} from '../publishing/publisher.js';
import { notificationService } from '../notifications/NotificationService.js';
import { writeAudit } from '../lib/audit.js';
import { hasAcceptedFollow, profilesAreBlocked } from '../social/ProfileFollowService.js';

function appError(message: string, code: string, status: 400 | 403 | 404 | 409) {
  return Object.assign(new Error(message), { code, status });
}

function slugFor(name: string) {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150) || 'product';
  return `${base}-${randomUUID().slice(0, 8)}`;
}

const USER_EDITABLE = new Set(['draft', 'changes_requested', 'rejected']);
const REVIEW_STATUS = {
  approve: 'approved', request_changes: 'changes_requested', reject: 'rejected',
  suspend: 'suspended', restore: 'approved', archive: 'archived',
} as const;
const REVIEW_PRODUCT_STATUS = {
  approve: 'published', request_changes: 'draft', reject: 'draft',
  suspend: 'archived', restore: 'published', archive: 'archived',
} as const;
const REVIEW_ALLOWED: Record<ExploreReviewRequest['action'], string[]> = {
  approve: ['pending_review', 'suspended'],
  request_changes: ['pending_review'],
  reject: ['pending_review'],
  suspend: ['approved'],
  restore: ['suspended'],
  archive: ['approved', 'suspended'],
};

export class ProductService {
  async listCategories() {
    const rows = await db.select().from(productCategories)
      .where(eq(productCategories.status, 'published'))
      .orderBy(productCategories.sortOrder, productCategories.name);
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      sortOrder: row.sortOrder,
      status: row.status as 'published',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createProduct(request: CreateProductRequest): Promise<Product> {
    const [row] = await db.insert(products).values({
      categoryId: request.categoryId,
      slug: request.slug,
      name: request.name,
      description: request.description,
      price: request.price,
      compareAtPrice: request.compareAtPrice ?? null,
      inventory: request.inventory,
      status: request.status ?? 'draft',
      reviewStatus: request.status === 'published' ? 'approved' : 'draft',
      approvedAt: request.status === 'published' ? new Date() : null,
      metadata: request.metadata ?? null,
    }).returning();
    if (request.imageIds?.length) {
      await db.insert(productImages).values(request.imageIds.map((mediaAssetId, index) => ({
        productId: row!.id, mediaAssetId, sortOrder: index,
      })));
    }
    return this.getProductById(row!.id);
  }

  async createUserProduct(ownerUserId: string, request: CreateUserProductRequest) {
    const owned = await resolveOwnedPublisher(ownerUserId, {
      id: request.publisherProfileId,
      type: request.publisherProfileType,
    });
    await mediaService.requireMobileContentAssets(ownerUserId, request.imageIds);
    const [duplicate] = await db.select({ id: products.id }).from(products).where(and(
      eq(products.ownerMobileUserId, ownerUserId),
      sql`lower(${products.name}) = lower(${request.name})`,
      sql`${products.reviewStatus} <> 'archived'`,
    )).limit(1);
    if (duplicate) throw appError('A matching product already exists', 'duplicate_product', 409);
    const [row] = await db.transaction(async tx => {
      const inserted = await tx.insert(products).values({
        categoryId: request.categoryId,
        slug: slugFor(request.name),
        name: request.name,
        description: request.description,
        price: request.price,
        compareAtPrice: request.compareAtPrice ?? null,
        inventory: request.inventory,
        status: 'draft',
        ownerMobileUserId: ownerUserId,
        ...authorColumnsFor(owned.ref),
        reviewStatus: 'draft',
        requestedVisibility: request.requestedVisibility,
        metadata: {
          tags: [...new Set(request.tags)],
          deliveryMethods: request.deliveryMethods,
          pickupDetails: request.pickupDetails ?? null,
          contact: request.contact,
        },
      }).returning();
      await tx.insert(productImages).values(request.imageIds.map((mediaAssetId, index) => ({
        productId: inserted[0]!.id, mediaAssetId, sortOrder: index,
      })));
      return inserted;
    });
    return this.getProductById(row!.id);
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.getProductById(productId);
  }

  private async canViewProduct(
    product: Product,
    userId: string,
    viewer?: PublisherRef,
  ) {
    if (product.ownerMobileUserId === userId) return true;
    if (!product.publisherProfileId || !product.publisherProfileType) return product.status === 'published';
    const publisher = {
      id: product.publisherProfileId,
      type: product.publisherProfileType,
    } satisfies PublisherRef;
    if (!viewer || await profilesAreBlocked(viewer, publisher)) return false;
    if (product.reviewStatus === 'approved' && product.status === 'published') {
      return product.requestedVisibility === 'public'
        || await hasAcceptedFollow(viewer, publisher);
    }
    return product.reviewStatus === 'pending_review'
      && product.requestedVisibility === 'followers_only'
      && await hasAcceptedFollow(viewer, publisher);
  }

  async getProductForViewer(productId: string, userId: string, viewer?: PublisherRef) {
    const product = await this.getProductById(productId, userId);
    if (!(await this.canViewProduct(product, userId, viewer))) {
      throw appError('Product not found', 'not_found', 404);
    }
    return product;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const [row] = await db.select().from(products).where(eq(products.slug, slug));
    return row ? this.getProductById(row.id) : null;
  }

  private async getProductById(productId: string, viewerUserId?: string): Promise<Product> {
    const [row] = await db.select().from(products).where(eq(products.id, productId));
    if (!row) throw appError('Product not found', 'not_found', 404);
    const imageRows = await db.select({
      id: mediaAssets.id,
      kind: mediaAssets.kind,
      thumbnailUrl: mediaAssets.thumbnailUrl,
      alt: productImages.alt,
      sortOrder: productImages.sortOrder,
    }).from(productImages)
      .innerJoin(mediaAssets, eq(productImages.mediaAssetId, mediaAssets.id))
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);
    const imageResults: Array<ProductImage | null> = await Promise.all(imageRows.map(async img => {
      const kind = img.kind === 'video' ? 'video' : 'image';
      const url = await mediaService.getAuthorizedContentDeliveryUrl(img.id, kind);
      return url ? ({
        id: img.id,
        url,
        ...(img.alt ? { alt: img.alt } : {}),
        sortOrder: img.sortOrder,
        kind,
        thumbnailUrl: img.thumbnailUrl,
      } satisfies ProductImage) : null;
    }));
    const images = imageResults.filter((item): item is ProductImage => item !== null);
    const publisherProfileId = row.authorProviderId ?? row.authorMobileUserId;
    const publisherProfileType = row.authorProviderId
      ? ('business' as const)
      : row.authorMobileUserId ? ('personal' as const) : null;
    const publisher = publisherProfileId && publisherProfileType
      ? await loadPublisher({ id: publisherProfileId, type: publisherProfileType })
      : null;
    const saves = viewerUserId ? await db.select({ id: exploreSaves.id }).from(exploreSaves).where(and(
      eq(exploreSaves.mobileUserId, viewerUserId),
      eq(exploreSaves.entityType, 'product'),
      eq(exploreSaves.entityId, productId),
    )).limit(1) : [];
    return {
      id: row.id,
      categoryId: row.categoryId,
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      inventory: row.inventory,
      images,
      status: row.status as Product['status'],
      ownerMobileUserId: row.ownerMobileUserId,
      publisherProfileId,
      publisherProfileType,
      publisher,
      reviewStatus: row.reviewStatus as Product['reviewStatus'],
      requestedVisibility: row.requestedVisibility as Product['requestedVisibility'],
      reviewReason: row.reviewReason,
      reviewVersion: row.reviewVersion,
      viewerHasSaved: saves.length > 0,
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listProducts(options: {
    categoryId?: string;
    status?: string;
    reviewStatus?: string;
    ownerMobileUserId?: string;
    requestedVisibility?: string;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ products: Product[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);
    const conditions = [];
    if (options.categoryId) conditions.push(eq(products.categoryId, options.categoryId));
    if (options.status) conditions.push(eq(products.status, options.status));
    if (options.reviewStatus) conditions.push(eq(products.reviewStatus, options.reviewStatus));
    if (options.ownerMobileUserId) conditions.push(eq(products.ownerMobileUserId, options.ownerMobileUserId));
    if (options.requestedVisibility) conditions.push(eq(products.requestedVisibility, options.requestedVisibility));
    if (options.cursor) conditions.push(lt(products.createdAt, new Date(options.cursor)));
    if (options.search) conditions.push(or(
      ilike(products.name, `%${options.search}%`),
      ilike(products.description, `%${options.search}%`),
    )!);
    const rows = await db.select().from(products)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt)).limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      products: await Promise.all(page.map(row => this.getProductById(row.id))),
      nextCursor: hasMore ? page[page.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async listMine(ownerUserId: string) {
    return this.listProducts({ ownerMobileUserId: ownerUserId, limit: 100 });
  }

  async listExploreProducts(options: {
    userId: string;
    viewer: PublisherRef;
    categoryId?: string;
    search?: string;
    following?: boolean;
    maxPrice?: number;
    limit?: number;
  }) {
    const result = await this.listProducts({
      categoryId: options.categoryId,
      search: options.search,
      limit: Math.min((options.limit ?? 50) * 4, 100),
    });
    const visible: Product[] = [];
    for (const product of result.products) {
      if (options.maxPrice != null && product.price > options.maxPrice) continue;
      if (!(await this.canViewProduct(product, options.userId, options.viewer))) continue;
      if (options.following) {
        if (!product.publisherProfileId || !product.publisherProfileType) continue;
        const ref = {
          id: product.publisherProfileId,
          type: product.publisherProfileType,
        } satisfies PublisherRef;
        if (!(await hasAcceptedFollow(options.viewer, ref))) continue;
      }
      visible.push(product);
      if (visible.length >= (options.limit ?? 50)) break;
    }
    return { products: visible, nextCursor: null };
  }

  async updateUserProduct(ownerUserId: string, productId: string, request: UpdateUserProductRequest) {
    const [existing] = await db.select().from(products).where(and(
      eq(products.id, productId), eq(products.ownerMobileUserId, ownerUserId),
    ));
    if (!existing) throw appError('Product not found', 'not_found', 404);
    if (!USER_EDITABLE.has(existing.reviewStatus)) {
      throw appError('This product cannot be edited in its current state', 'invalid_status', 409);
    }
    if (request.imageIds) await mediaService.requireMobileContentAssets(ownerUserId, request.imageIds);
    const existingImages = request.imageIds ?? (await db.select({ id: productImages.mediaAssetId })
      .from(productImages).where(eq(productImages.productId, productId))).map(item => item.id);
    const previousMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const previousContact = previousMetadata.contact as CreateUserProductRequest['contact'] | undefined;
    const candidate = CreateUserProductRequestSchema.safeParse({
      publisherProfileId: existing.authorProviderId ?? existing.authorMobileUserId ?? undefined,
      publisherProfileType: existing.authorProviderId ? 'business' : 'personal',
      categoryId: request.categoryId ?? existing.categoryId,
      name: request.name ?? existing.name,
      description: request.description ?? existing.description ?? '',
      price: request.price ?? existing.price,
      compareAtPrice: request.compareAtPrice !== undefined ? request.compareAtPrice : existing.compareAtPrice,
      inventory: request.inventory ?? existing.inventory,
      imageIds: existingImages,
      tags: request.tags ?? previousMetadata.tags ?? [],
      requestedVisibility: request.requestedVisibility ?? existing.requestedVisibility,
      deliveryMethods: request.deliveryMethods ?? previousMetadata.deliveryMethods ?? [],
      pickupDetails: request.pickupDetails !== undefined ? request.pickupDetails : previousMetadata.pickupDetails,
      contact: request.contact ?? previousContact,
    });
    if (!candidate.success) {
      throw appError(candidate.error.issues[0]?.message ?? 'Invalid product', 'invalid_product', 400);
    }
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['categoryId', 'name', 'description', 'price', 'compareAtPrice', 'inventory', 'requestedVisibility'] as const) {
      if (request[key] !== undefined) values[key] = request[key];
    }
    const previous = previousMetadata;
    if (request.tags !== undefined || request.deliveryMethods !== undefined || request.pickupDetails !== undefined || request.contact !== undefined) {
      values.metadata = {
        ...previous,
        ...(request.tags !== undefined ? { tags: [...new Set(request.tags)] } : {}),
        ...(request.deliveryMethods !== undefined ? { deliveryMethods: request.deliveryMethods } : {}),
        ...(request.pickupDetails !== undefined ? { pickupDetails: request.pickupDetails } : {}),
        ...(request.contact !== undefined ? { contact: request.contact } : {}),
      };
    }
    await db.transaction(async tx => {
      await tx.update(products).set(values).where(eq(products.id, productId));
      if (request.imageIds) {
        await tx.delete(productImages).where(eq(productImages.productId, productId));
        await tx.insert(productImages).values(request.imageIds.map((mediaAssetId, index) => ({
          productId, mediaAssetId, sortOrder: index,
        })));
      }
    });
    return this.getProductById(productId);
  }

  async submitUserProduct(ownerUserId: string, productId: string) {
    const [existing] = await db.select().from(products).where(and(
      eq(products.id, productId), eq(products.ownerMobileUserId, ownerUserId),
    ));
    if (!existing) throw appError('Product not found', 'not_found', 404);
    if (!USER_EDITABLE.has(existing.reviewStatus)) throw appError('Product is already submitted', 'invalid_status', 409);
    const media = await db.select({ id: productImages.mediaAssetId }).from(productImages)
      .where(eq(productImages.productId, productId));
    if (!media.length) throw appError('Add at least one product image or video', 'media_required', 400);
    await mediaService.requireMobileContentAssets(ownerUserId, media.map(item => item.id));
    const [updated] = await db.update(products).set({
      reviewStatus: 'pending_review',
      reviewReason: null,
      reviewVersion: existing.reviewVersion + (existing.submittedAt ? 1 : 0),
      submittedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(products.id, productId)).returning();
    await notificationService.notifyUser(ownerUserId, {
      type: 'explore_submission_received',
      title: 'Product submitted',
      body: `${existing.name} is now in review.`,
      data: { entityType: 'product', entityId: productId, status: 'pending_review' },
    }).catch(() => undefined);
    return this.getProductById(updated!.id);
  }

  async archiveUserProduct(ownerUserId: string, productId: string) {
    const [existing] = await db.select().from(products).where(and(
      eq(products.id, productId), eq(products.ownerMobileUserId, ownerUserId),
    ));
    if (!existing) throw appError('Product not found', 'not_found', 404);
    if (!['approved', 'suspended'].includes(existing.reviewStatus)) {
      throw appError('Only an approved or suspended product can be archived', 'invalid_status', 409);
    }
    await db.update(products).set({
      reviewStatus: 'archived', status: 'archived', updatedAt: new Date(),
    }).where(eq(products.id, productId));
    return this.getProductById(productId);
  }

  async deleteUserProduct(ownerUserId: string, productId: string) {
    const [existing] = await db.select().from(products).where(and(
      eq(products.id, productId), eq(products.ownerMobileUserId, ownerUserId),
    ));
    if (!existing) throw appError('Product not found', 'not_found', 404);
    if (existing.reviewStatus === 'approved' || existing.reviewStatus === 'suspended') {
      throw appError('Archive this product instead of deleting it', 'invalid_status', 409);
    }
    await db.transaction(async tx => {
      await tx.delete(exploreSaves).where(and(
        eq(exploreSaves.entityType, 'product'), eq(exploreSaves.entityId, productId),
      ));
      await tx.delete(products).where(eq(products.id, productId));
    });
  }

  async setSaved(userId: string, viewer: PublisherRef, productId: string, saved: boolean) {
    const product = await this.getProductForViewer(productId, userId, viewer);
    if (saved) {
      await db.insert(exploreSaves).values({
        mobileUserId: userId, entityType: 'product', entityId: productId,
      }).onConflictDoNothing();
    } else {
      await db.delete(exploreSaves).where(and(
        eq(exploreSaves.mobileUserId, userId),
        eq(exploreSaves.entityType, 'product'),
        eq(exploreSaves.entityId, productId),
      ));
    }
    return { ...product, viewerHasSaved: saved };
  }

  async listSaved(userId: string, viewer: PublisherRef) {
    const saves = await db.select({ id: exploreSaves.entityId }).from(exploreSaves).where(and(
      eq(exploreSaves.mobileUserId, userId),
      eq(exploreSaves.entityType, 'product'),
    )).orderBy(desc(exploreSaves.createdAt));
    const result: Product[] = [];
    for (const save of saves) {
      try {
        result.push(await this.getProductForViewer(save.id, userId, viewer));
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error;
      }
    }
    return { products: result, nextCursor: null };
  }

  async reviewUserProduct(productId: string, request: ExploreReviewRequest, actor: { id: string; email: string }) {
    const [existing] = await db.select().from(products).where(eq(products.id, productId));
    if (!existing) throw appError('Product not found', 'not_found', 404);
    if (!existing.ownerMobileUserId) throw appError('This is an operator-managed catalog product', 'invalid_product', 409);
    if (!REVIEW_ALLOWED[request.action].includes(existing.reviewStatus)) {
      throw appError('Review action is not allowed from this status', 'invalid_status', 409);
    }
    const nextReview = REVIEW_STATUS[request.action];
    const nextStatus = REVIEW_PRODUCT_STATUS[request.action];
    const [updated] = await db.update(products).set({
      reviewStatus: nextReview,
      status: nextStatus,
      reviewReason: request.reason ?? null,
      approvedAt: nextReview === 'approved' ? new Date() : existing.approvedAt,
      updatedAt: new Date(),
    }).where(eq(products.id, productId)).returning();
    await writeAudit({
      actorId: actor.id,
      actorEmail: actor.email,
      action: `explore.product.${request.action}`,
      entityType: 'product',
      entityId: productId,
      metadata: {
        previousStatus: existing.reviewStatus,
        newStatus: nextReview,
        reviewVersion: existing.reviewVersion,
        reason: request.reason ?? null,
      },
    });
    const type = request.action === 'approve' || request.action === 'restore'
      ? 'explore_approved'
      : request.action === 'request_changes'
        ? 'explore_changes_requested'
        : request.action === 'reject'
          ? 'explore_rejected'
          : request.action === 'suspend' ? 'explore_suspended' : 'status_update';
    await notificationService.notifyUser(existing.ownerMobileUserId, {
      type,
      title: `Product ${nextReview.replace('_', ' ')}`,
      body: request.reason ? `${existing.name}: ${request.reason}` : existing.name,
      data: { entityType: 'product', entityId: productId, status: nextReview },
    }).catch(() => undefined);
    return this.getProductById(updated!.id);
  }

  async updateProduct(productId: string, request: UpdateProductRequest): Promise<Product> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['categoryId', 'slug', 'name', 'description', 'price', 'compareAtPrice', 'inventory', 'status', 'metadata'] as const) {
      if (request[key] !== undefined) updateData[key] = request[key];
    }
    const [row] = await db.update(products).set(updateData).where(eq(products.id, productId)).returning();
    if (!row) throw appError('Product not found', 'not_found', 404);
    if (request.imageIds !== undefined) {
      await db.transaction(async tx => {
        await tx.delete(productImages).where(eq(productImages.productId, productId));
        if (request.imageIds!.length) {
          await tx.insert(productImages).values(request.imageIds!.map((mediaAssetId, index) => ({ productId, mediaAssetId, sortOrder: index })));
        }
      });
    }
    return this.getProductById(productId);
  }

  async deleteProduct(productId: string): Promise<void> {
    await db.transaction(async tx => {
      await tx.delete(exploreSaves).where(and(
        eq(exploreSaves.entityType, 'product'), eq(exploreSaves.entityId, productId),
      ));
      await tx.delete(products).where(eq(products.id, productId));
    });
  }

  async decrementInventory(productId: string, quantity: number, tx?: typeof db): Promise<void> {
    const dbInstance = tx ?? db;
    const rows = await dbInstance.update(products).set({
      inventory: sql`${products.inventory} - ${quantity}`,
      updatedAt: new Date(),
    }).where(and(eq(products.id, productId), sql`${products.inventory} >= ${quantity}`))
      .returning({ id: products.id });
    if (!rows.length) {
      const [product] = await dbInstance.select({ id: products.id }).from(products).where(eq(products.id, productId));
      throw appError(
        product ? 'Insufficient inventory' : 'Product not found',
        product ? 'insufficient_inventory' : 'not_found',
        product ? 409 : 404,
      );
    }
  }
}

export const productService = new ProductService();
