import { and, desc, eq, gte, ilike, lt, or } from 'drizzle-orm';
import type {
  Order,
  OrderAdminListItem,
  OrderStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { orders, products, mobileUsers } from '../db/schema.js';

export class OrderService {
  async createOrder(
    mobileUserId: string,
    request: CreateOrderRequest,
  ): Promise<Order> {
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
    if (options.status) conditions.push(eq(orders.status, options.status));
    if (options.cursor) conditions.push(lt(orders.createdAt, new Date(options.cursor)));

    const rows = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      orders: items.map(row => this.mapOrderRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

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
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
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
    userId?: string;
    status?: OrderStatus;
    from?: string;
    to?: string;
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

    const rows = await db
      .select({
        order: orders,
        user: mobileUsers,
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);

    return {
      orders: items.map(({ order, user }) => ({
        ...this.mapOrderRow(order),
        userName: user.displayName,
        userPhone: user.phone,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.order.createdAt.toISOString()
        : null,
    };
  }

  async getOrderAdmin(orderId: string): Promise<OrderAdminListItem | null> {
    const [row] = await db
      .select({
        order: orders,
        user: mobileUsers,
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(eq(orders.id, orderId));

    if (!row) return null;

    return {
      ...this.mapOrderRow(row.order),
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
  }

  private mapOrderRow(row: typeof orders.$inferSelect): Order {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      mobileUserId: row.mobileUserId,
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
}

export const orderService = new OrderService();
