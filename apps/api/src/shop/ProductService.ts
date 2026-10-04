import { and, desc, eq, ilike, lt, or } from 'drizzle-orm';
import type {
  Product,
  ProductWithImages,
  CreateProductRequest,
  UpdateProductRequest,
  ProductStatus,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { products, productCategories, mediaAssets } from '../db/schema.js';

export class ProductService {
  async createProduct(request: CreateProductRequest): Promise<Product> {
    const [row] = await db
      .insert(products)
      .values({
        categoryId: request.categoryId ?? null,
        name: request.name,
        slug: request.slug,
        description: request.description,
        price: request.price,
        compareAtPrice: request.compareAtPrice ?? null,
        inventory: request.inventory ?? null,
        status: request.status ?? 'draft',
        imageIds: request.imageIds ?? [],
        metadata: request.metadata ?? null,
      })
      .returning();

    return this.mapProductRow(row!);
  }

  async getProduct(productId: string): Promise<Product | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    return row ? this.mapProductRow(row) : null;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.slug, slug));

    return row ? this.mapProductRow(row) : null;
  }

  async getProductWithImages(productId: string): Promise<ProductWithImages | null> {
    const product = await this.getProduct(productId);
    if (!product) return null;

    const images = await this.getProductImages(product.imageIds);
    return { ...product, images };
  }

  async listProducts(options: {
    categoryId?: string;
    status?: ProductStatus;
    search?: string;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ products: Product[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [];
    if (options.categoryId) {
      conditions.push(eq(products.categoryId, options.categoryId));
    }
    if (options.status) {
      conditions.push(eq(products.status, options.status));
    }
    if (options.search) {
      conditions.push(
        or(
          ilike(products.name, `%${options.search}%`),
          ilike(products.description, `%${options.search}%`),
        )!,
      );
    }
    if (options.cursor) {
      conditions.push(lt(products.createdAt, new Date(options.cursor)));
    }

    const rows = await db
      .select()
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      products: items.map(row => this.mapProductRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async updateProduct(
    productId: string,
    update: UpdateProductRequest,
  ): Promise<Product | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.categoryId !== undefined) values.categoryId = update.categoryId;
    if (update.name) values.name = update.name;
    if (update.slug) values.slug = update.slug;
    if (update.description) values.description = update.description;
    if (update.price !== undefined) values.price = update.price;
    if (update.compareAtPrice !== undefined)
      values.compareAtPrice = update.compareAtPrice;
    if (update.inventory !== undefined) values.inventory = update.inventory;
    if (update.status) values.status = update.status;
    if (update.imageIds) values.imageIds = update.imageIds;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(products)
      .set(values)
      .where(eq(products.id, productId))
      .returning();

    return row ? this.mapProductRow(row) : null;
  }

  async deleteProduct(productId: string): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, productId));
    return result.length > 0;
  }

  private async getProductImages(imageIds: string[]) {
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

  private mapProductRow(row: typeof products.$inferSelect): Product {
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      slug: row.slug,
      description: row.description,
      price: row.price,
      compareAtPrice: row.compareAtPrice,
      inventory: row.inventory,
      status: row.status as Product['status'],
      imageIds: (row.imageIds as string[]) ?? [],
      metadata: row.metadata as Product['metadata'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

export const productService = new ProductService();
