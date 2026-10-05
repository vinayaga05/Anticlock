import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type {
  Product,
  ProductImage,
  CreateProductRequest,
  UpdateProductRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  products,
  productCategories,
  productImages,
  mediaAssets,
} from '../db/schema.js';

export class ProductService {
  async createProduct(request: CreateProductRequest): Promise<Product> {
    const [row] = await db
      .insert(products)
      .values({
        categoryId: request.categoryId,
        slug: request.slug,
        name: request.name,
        description: request.description,
        price: request.price,
        compareAtPrice: request.compareAtPrice ?? null,
        inventory: request.inventory,
        status: request.status ?? 'draft',
        metadata: request.metadata ?? null,
      })
      .returning();

    if (request.imageIds && request.imageIds.length > 0) {
      await db.insert(productImages).values(
        request.imageIds.map((mediaAssetId, index) => ({
          productId: row!.id,
          mediaAssetId,
          sortOrder: index,
        })),
      );
    }

    return this.getProductById(row!.id);
  }

  async getProduct(productId: string): Promise<Product | null> {
    return this.getProductById(productId);
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.slug, slug));

    if (!row) return null;

    return this.getProductById(row.id);
  }

  private async getProductById(productId: string): Promise<Product> {
    const [row] = await db
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!row) {
      throw Object.assign(new Error('Product not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const imageRows = await db
      .select({
        id: productImages.id,
        url: mediaAssets.url,
        alt: productImages.alt,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .innerJoin(mediaAssets, eq(productImages.mediaAssetId, mediaAssets.id))
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder);

    const images: ProductImage[] = imageRows.map((img) => ({
      id: img.id,
      url: img.url,
      alt: img.alt ?? undefined,
      sortOrder: img.sortOrder,
    }));

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
      status: row.status as 'draft' | 'published' | 'archived',
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async listProducts(options: {
    categoryId?: string;
    status?: 'draft' | 'published' | 'archived';
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

    const rows = await db
      .select()
      .from(products)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(products.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const productsWithImages = await Promise.all(
      items.map((row) => this.getProductById(row.id)),
    );

    return {
      products: productsWithImages,
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async updateProduct(
    productId: string,
    request: UpdateProductRequest,
  ): Promise<Product> {
    const updateData: Record<string, unknown> = {};

    if (request.categoryId !== undefined) updateData.categoryId = request.categoryId;
    if (request.slug !== undefined) updateData.slug = request.slug;
    if (request.name !== undefined) updateData.name = request.name;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.price !== undefined) updateData.price = request.price;
    if (request.compareAtPrice !== undefined)
      updateData.compareAtPrice = request.compareAtPrice;
    if (request.inventory !== undefined) updateData.inventory = request.inventory;
    if (request.status !== undefined) updateData.status = request.status;
    if (request.metadata !== undefined) updateData.metadata = request.metadata;

    updateData.updatedAt = new Date();

    const [row] = await db
      .update(products)
      .set(updateData)
      .where(eq(products.id, productId))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Product not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (request.imageIds !== undefined) {
      await db.delete(productImages).where(eq(productImages.productId, productId));

      if (request.imageIds.length > 0) {
        await db.insert(productImages).values(
          request.imageIds.map((mediaAssetId, index) => ({
            productId,
            mediaAssetId,
            sortOrder: index,
          })),
        );
      }
    }

    return this.getProductById(productId);
  }

  async deleteProduct(productId: string): Promise<void> {
    await db.delete(products).where(eq(products.id, productId));
  }

  async decrementInventory(
    productId: string,
    quantity: number,
    tx?: typeof db,
  ): Promise<void> {
    const dbInstance = tx ?? db;

    const [product] = await dbInstance
      .select({ inventory: products.inventory })
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw Object.assign(new Error('Product not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (product.inventory < quantity) {
      throw Object.assign(new Error('Insufficient inventory'), {
        code: 'insufficient_inventory',
        status: 409,
      });
    }

    await dbInstance
      .update(products)
      .set({ inventory: product.inventory - quantity })
      .where(eq(products.id, productId));
  }
}

export const productService = new ProductService();
