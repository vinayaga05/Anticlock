<<<<<<< HEAD
import { and, desc, eq, gte, ilike, lt, or } from 'drizzle-orm';
=======
import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
>>>>>>> origin/main
import type {
  Order,
  OrderAdminListItem,
  OrderStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
<<<<<<< HEAD
import { orders, products, mobileUsers } from '../db/schema.js';
=======
import { orders, mobileUsers, products } from '../db/schema.js';
import { productService } from './ProductService.js';

const FREE_SHIPPING_THRESHOLD = 50000;
const FLAT_SHIPPING_RATE = 500;
const TAX_RATE = 0.18;
>>>>>>> origin/main

export class OrderService {
  async createOrder(
    mobileUserId: string,
    request: CreateOrderRequest,
  ): Promise<Order> {
<<<<<<< HEAD
    // Fetch products to validate and build order items
    const productIds = request.items.map(item => item.productId);
    const productRows = await db
      .select()
      .from(products)
      .where(
        and(
          or(...productIds.map(id => eq(products.id, id)))!,
          eq(products.status, 'published'),
        ),
      );

    if (productRows.length !== productIds.length) {
      throw Object.assign(new Error('Some products are not available'), {
        code: 'invalid_products',
        status: 400,
      });
    }

    const productMap = new Map(productRows.map(p => [p.id, p]));
    const orderItems: OrderItem[] = [];
    let subtotal = 0;

    for (const item of request.items) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      // Check inventory if tracked
      if (product.inventory !== null && product.inventory < item.quantity) {
        throw Object.assign(
          new Error(`Insufficient inventory for ${product.name}`),
          {
            code: 'insufficient_inventory',
            status: 400,
          },
        );
      }

      const totalPrice = product.price * item.quantity;
      subtotal += totalPrice;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice,
        imageUrl:
          (product.imageIds as string[])[0]
            ? await this.getImageUrl((product.imageIds as string[])[0]!)
            : null,
      });

      // Decrement inventory if tracked
      if (product.inventory !== null) {
        await db
          .update(products)
          .set({ inventory: product.inventory - item.quantity })
          .where(eq(products.id, product.id));
      }
    }

    // Calculate shipping and tax (simplified)
    const shippingCost = subtotal > 50000 ? 0 : 500; // Free shipping over ₹500
    const tax = Math.round(subtotal * 0.18); // 18% GST
    const total = subtotal + shippingCost + tax;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    const [row] = await db
      .insert(orders)
      .values({
        orderNumber,
        mobileUserId,
        status: 'pending',
        paymentStatus: 'pending',
        items: orderItems as unknown[],
        subtotal,
        shippingCost,
        tax,
        total,
        shippingAddress: request.shippingAddress as Record<string, unknown>,
        notes: request.notes ?? null,
      })
      .returning();

    return this.mapOrderRow(row!);
=======
    let orderItems: OrderItem[] = [];
    let subtotal = 0;
    let shipping = 0;
    let tax = 0;
    let total = 0;
    let orderNumber = '';
    let orderId = '';

    await db.transaction(async (tx) => {
      for (const cartItem of request.items) {
        const product = await productService.getProduct(cartItem.productId);

        if (!product) {
          throw Object.assign(new Error(`Product ${cartItem.productId} not found`), {
            code: 'product_not_found',
            status: 404,
          });
        }

        if (product.status !== 'published') {
          throw Object.assign(new Error(`Product ${product.name} is not available`), {
            code: 'product_unavailable',
            status: 400,
          });
        }

        if (product.inventory < cartItem.quantity) {
          throw Object.assign(
            new Error(`Insufficient inventory for ${product.name}`),
            {
              code: 'insufficient_inventory',
              status: 409,
            },
          );
        }

        await productService.decrementInventory(cartItem.productId, cartItem.quantity, tx as any);

        const itemTotal = product.price * cartItem.quantity;
        subtotal += itemTotal;

        orderItems.push({
          productId: product.id,
          productName: product.name,
          productSlug: product.slug,
          quantity: cartItem.quantity,
          price: product.price,
          imageUrl: product.images[0]?.url,
        });
      }

      shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_RATE;
      tax = Math.round(subtotal * TAX_RATE);
      total = subtotal + shipping + tax;

      orderNumber = this.generateOrderNumber();

      const [row] = await tx
        .insert(orders)
        .values({
          orderNumber,
          mobileUserId,
          items: orderItems as unknown as Record<string, unknown>[],
          subtotal,
          shipping,
          tax,
          total,
          shippingAddress: request.shippingAddress as Record<string, unknown>,
          status: 'pending',
          paymentStatus: 'pending',
          metadata: request.metadata ?? null,
        })
        .returning();

      orderId = row!.id;
    });

    const [order] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, orderId));

    return this.mapOrderRow(order!);
>>>>>>> origin/main
  }

  async getOrder(orderId: string, mobileUserId: string): Promise<Order | null> {
    const [row] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.mobileUserId, mobileUserId)));

    return row ? this.mapOrderRow(row) : null;
  }

  async listOrders(
    mobileUserId: string,
    options: {
      status?: OrderStatus;
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ orders: Order[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const conditions = [eq(orders.mobileUserId, mobileUserId)];
<<<<<<< HEAD
    if (options.status) conditions.push(eq(orders.status, options.status));
    if (options.cursor) conditions.push(lt(orders.createdAt, new Date(options.cursor)));
=======

    if (options.cursor) {
      conditions.push(lt(orders.createdAt, new Date(options.cursor)));
    }

    if (options.status) {
      conditions.push(eq(orders.status, options.status));
    }
>>>>>>> origin/main

    const rows = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
<<<<<<< HEAD
    const items = rows.slice(0, limit);

    return {
      orders: items.map(row => this.mapOrderRow(row)),
=======
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      orders: items.map((row) => this.mapOrderRow(row)),
>>>>>>> origin/main
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

<<<<<<< HEAD
  async updateOrder(
    orderId: string,
    mobileUserId: string,
    update: UpdateOrderRequest,
  ): Promise<Order | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.status) {
      values.status = update.status;
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
      if (update.status === 'delivered') {
        values.deliveredAt = new Date();
      }
    }
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.notes) values.notes = update.notes;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(orders)
      .set(values)
      .where(and(eq(orders.id, orderId), eq(orders.mobileUserId, mobileUserId)))
      .returning();

    return row ? this.mapOrderRow(row) : null;
  }

  async cancelOrder(orderId: string, mobileUserId: string): Promise<Order | null> {
    const [row] = await db
=======
  async cancelOrder(
    orderId: string,
    mobileUserId: string,
    reason?: string,
  ): Promise<Order> {
    const [row] = await db
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.mobileUserId, mobileUserId)));

    if (!row) {
      throw Object.assign(new Error('Order not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (!['pending', 'confirmed'].includes(row.status)) {
      throw Object.assign(new Error('Order cannot be cancelled'), {
        code: 'cannot_cancel',
        status: 400,
      });
    }

    const [updated] = await db
>>>>>>> origin/main
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
<<<<<<< HEAD
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.mobileUserId, mobileUserId),
          or(eq(orders.status, 'pending'), eq(orders.status, 'confirmed'))!,
        ),
      )
      .returning();

    return row ? this.mapOrderRow(row) : null;
  }

  async listOrdersAdmin(filters: {
=======
        metadata: {
          ...(row.metadata as Record<string, unknown>),
          cancelReason: reason,
        },
      })
      .where(eq(orders.id, orderId))
      .returning();

    return this.mapOrderRow(updated!);
  }

  async listAdminOrders(options: {
>>>>>>> origin/main
    userId?: string;
    status?: OrderStatus;
    from?: string;
    to?: string;
<<<<<<< HEAD
    search?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ orders: OrderAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);

    const conditions = [];
    if (filters.userId) conditions.push(eq(orders.mobileUserId, filters.userId));
    if (filters.status) conditions.push(eq(orders.status, filters.status));
    if (filters.from) conditions.push(gte(orders.createdAt, new Date(filters.from)));
    if (filters.to) conditions.push(lt(orders.createdAt, new Date(filters.to)));
    if (filters.search) {
      conditions.push(ilike(orders.orderNumber, `%${filters.search}%`));
    }
    if (filters.cursor) conditions.push(lt(orders.createdAt, new Date(filters.cursor)));
=======
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ orders: OrderAdminListItem[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 50, 100);

    const conditions = [];

    if (options.cursor) {
      conditions.push(lt(orders.createdAt, new Date(options.cursor)));
    }

    if (options.userId) {
      conditions.push(eq(orders.mobileUserId, options.userId));
    }

    if (options.status) {
      conditions.push(eq(orders.status, options.status));
    }

    if (options.from) {
      conditions.push(gte(orders.createdAt, new Date(options.from)));
    }

    if (options.to) {
      conditions.push(lte(orders.createdAt, new Date(options.to)));
    }
>>>>>>> origin/main

    const rows = await db
      .select({
        order: orders,
<<<<<<< HEAD
        user: mobileUsers,
=======
        userName: mobileUsers.displayName,
        userPhone: mobileUsers.phone,
>>>>>>> origin/main
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
<<<<<<< HEAD
    const items = rows.slice(0, limit);

    return {
      orders: items.map(({ order, user }) => ({
        ...this.mapOrderRow(order),
        userName: user.displayName,
        userPhone: user.phone,
=======
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      orders: items.map((row) => ({
        ...this.mapOrderRow(row.order),
        userName: row.userName,
        userPhone: row.userPhone,
>>>>>>> origin/main
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.order.createdAt.toISOString()
        : null,
    };
  }

<<<<<<< HEAD
  async getOrderAdmin(orderId: string): Promise<OrderAdminListItem | null> {
    const [row] = await db
      .select({
        order: orders,
        user: mobileUsers,
=======
  async getAdminOrder(orderId: string): Promise<OrderAdminListItem | null> {
    const [row] = await db
      .select({
        order: orders,
        userName: mobileUsers.displayName,
        userPhone: mobileUsers.phone,
>>>>>>> origin/main
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(eq(orders.id, orderId));

    if (!row) return null;

    return {
      ...this.mapOrderRow(row.order),
<<<<<<< HEAD
      userName: row.user.displayName,
      userPhone: row.user.phone,
    };
  }

  async updateOrderAdmin(
    orderId: string,
    update: UpdateOrderRequest,
  ): Promise<Order | null> {
    const values: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (update.status) {
      values.status = update.status;
      if (update.status === 'cancelled') {
        values.cancelledAt = new Date();
      }
      if (update.status === 'delivered') {
        values.deliveredAt = new Date();
      }
    }
    if (update.paymentStatus) values.paymentStatus = update.paymentStatus;
    if (update.notes) values.notes = update.notes;
    if (update.metadata) values.metadata = update.metadata;

    const [row] = await db
      .update(orders)
      .set(values)
      .where(eq(orders.id, orderId))
      .returning();

    return row ? this.mapOrderRow(row) : null;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }

  private async getImageUrl(imageId: string): Promise<string | null> {
    const [asset] = await db
      .select({ storageKey: products.imageIds })
      .from(products)
      .limit(1);
    return asset?.storageKey ? String(asset.storageKey) : null;
=======
      userName: row.userName,
      userPhone: row.userPhone,
    };
  }

  async updateAdminOrder(
    orderId: string,
    request: UpdateOrderRequest,
  ): Promise<Order> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (request.status !== undefined) {
      updateData.status = request.status;
      if (request.status === 'delivered') {
        updateData.completedAt = new Date();
      }
    }

    if (request.paymentStatus !== undefined) {
      updateData.paymentStatus = request.paymentStatus;
    }

    if (request.metadata !== undefined) {
      updateData.metadata = request.metadata;
    }

    const [row] = await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, orderId))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Order not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    return this.mapOrderRow(row);
>>>>>>> origin/main
  }

  private mapOrderRow(row: typeof orders.$inferSelect): Order {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      mobileUserId: row.mobileUserId,
<<<<<<< HEAD
      status: row.status as Order['status'],
      paymentStatus: row.paymentStatus as Order['paymentStatus'],
      items: row.items as Order['items'],
      subtotal: row.subtotal,
      shippingCost: row.shippingCost,
      tax: row.tax,
      total: row.total,
      shippingAddress: row.shippingAddress as Order['shippingAddress'],
      notes: row.notes ?? undefined,
      metadata: row.metadata as Order['metadata'],
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
    };
  }
=======
      items: row.items as unknown as OrderItem[],
      subtotal: row.subtotal,
      shipping: row.shipping,
      tax: row.tax,
      total: row.total,
      shippingAddress: row.shippingAddress as any,
      status: row.status as OrderStatus,
      paymentStatus: row.paymentStatus as
        | 'pending'
        | 'paid'
        | 'refunded'
        | 'failed',
      metadata: row.metadata as Record<string, unknown> | undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `ORD-${timestamp}-${random}`;
  }
>>>>>>> origin/main
}

export const orderService = new OrderService();
