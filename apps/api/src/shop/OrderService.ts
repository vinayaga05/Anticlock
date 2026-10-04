import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
import type {
  Order,
  OrderAdminListItem,
  OrderStatus,
  CreateOrderRequest,
  UpdateOrderRequest,
  OrderItem,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { orders, mobileUsers, products } from '../db/schema.js';
import { productService } from './ProductService.js';

const FREE_SHIPPING_THRESHOLD = 50000;
const FLAT_SHIPPING_RATE = 500;
const TAX_RATE = 0.18;

export class OrderService {
  async createOrder(
    mobileUserId: string,
    request: CreateOrderRequest,
  ): Promise<Order> {
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

    if (options.cursor) {
      conditions.push(lt(orders.createdAt, new Date(options.cursor)));
    }

    if (options.status) {
      conditions.push(eq(orders.status, options.status));
    }

    const rows = await db
      .select()
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      orders: items.map((row) => this.mapOrderRow(row)),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

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
      .update(orders)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
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
    userId?: string;
    status?: OrderStatus;
    from?: string;
    to?: string;
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

    const rows = await db
      .select({
        order: orders,
        userName: mobileUsers.displayName,
        userPhone: mobileUsers.phone,
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      orders: items.map((row) => ({
        ...this.mapOrderRow(row.order),
        userName: row.userName,
        userPhone: row.userPhone,
      })),
      nextCursor: hasMore
        ? items[items.length - 1]!.order.createdAt.toISOString()
        : null,
    };
  }

  async getAdminOrder(orderId: string): Promise<OrderAdminListItem | null> {
    const [row] = await db
      .select({
        order: orders,
        userName: mobileUsers.displayName,
        userPhone: mobileUsers.phone,
      })
      .from(orders)
      .innerJoin(mobileUsers, eq(orders.mobileUserId, mobileUsers.id))
      .where(eq(orders.id, orderId));

    if (!row) return null;

    return {
      ...this.mapOrderRow(row.order),
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
  }

  private mapOrderRow(row: typeof orders.$inferSelect): Order {
    return {
      id: row.id,
      orderNumber: row.orderNumber,
      mobileUserId: row.mobileUserId,
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
}

export const orderService = new OrderService();
