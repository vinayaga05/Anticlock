import { Hono } from 'hono';
import {
  CreateOrderRequestSchema,
  CancelOrderRequestSchema,
  OrderListQuerySchema,
  ProductListQuerySchema,
  CreateProductRequestSchema,
  UpdateProductRequestSchema,
  OrderAdminQuerySchema,
  UpdateOrderRequestSchema,
} from '@anticlock/contracts';
import { productService } from '../shop/ProductService.js';
import { orderService } from '../shop/OrderService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';
import { httpError } from '../lib/httpError.js';

function requireMobileAuth(c: { get: (k: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth;
}

export const shopMobileRoutes = new Hono<AppEnv>();
shopMobileRoutes.use('*', requireAuth);

shopMobileRoutes.get('/products', async (c) => {
  try {
    const query = {
      categoryId: c.req.query('categoryId'),
      status: 'published' as const,
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = ProductListQuerySchema.parse(query);
    const result = await productService.listProducts(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/:id', async (c) => {
  try {
    const product = await productService.getProduct(c.req.param('id'));
    if (!product || product.status !== 'published') {
      return c.json(
        { error: { code: 'not_found', message: 'Product not found' } },
        404,
      );
    }
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/orders', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateOrderRequestSchema.parse(await c.req.json());
    const order = await orderService.createOrder(auth.sub, body);
    return c.json({ order }, 201);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/orders', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const query = {
      status: c.req.query('status'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = OrderListQuerySchema.parse(query);
    const result = await orderService.listOrders(auth.sub, validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/orders/:id', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const order = await orderService.getOrder(c.req.param('id'), auth.sub);
    if (!order) {
      return c.json(
        { error: { code: 'not_found', message: 'Order not found' } },
        404,
      );
    }
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/orders/:id/cancel', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const body = CancelOrderRequestSchema.parse(await c.req.json());
    const order = await orderService.cancelOrder(
      c.req.param('id'),
      auth.sub,
      body.reason,
    );
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

export const shopAdminRoutes = new Hono<AppEnv>();
shopAdminRoutes.use('*', requireAuth, requirePermission('catalog.read'));

shopAdminRoutes.get('/products', async (c) => {
  try {
    const query = {
      categoryId: c.req.query('categoryId'),
      status: c.req.query('status') as 'draft' | 'published' | 'archived' | undefined,
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = ProductListQuerySchema.parse(query);
    const result = await productService.listProducts(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.get('/products/:id', async (c) => {
  try {
    const product = await productService.getProduct(c.req.param('id'));
    if (!product) {
      return c.json(
        { error: { code: 'not_found', message: 'Product not found' } },
        404,
      );
    }
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.post('/products', async (c) => {
  try {
    requirePermission('catalog.write');
    const body = CreateProductRequestSchema.parse(await c.req.json());
    const product = await productService.createProduct(body);
    return c.json({ product }, 201);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.patch('/products/:id', async (c) => {
  try {
    requirePermission('catalog.write');
    const body = UpdateProductRequestSchema.parse(await c.req.json());
    const product = await productService.updateProduct(c.req.param('id'), body);
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.delete('/products/:id', async (c) => {
  try {
    requirePermission('catalog.write');
    await productService.deleteProduct(c.req.param('id'));
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.get('/orders', async (c) => {
  try {
    const query = {
      userId: c.req.query('userId'),
      status: c.req.query('status') as any,
      from: c.req.query('from'),
      to: c.req.query('to'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = OrderAdminQuerySchema.parse(query);
    const result = await orderService.listAdminOrders(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.get('/orders/:id', async (c) => {
  try {
    const order = await orderService.getAdminOrder(c.req.param('id'));
    if (!order) {
      return c.json(
        { error: { code: 'not_found', message: 'Order not found' } },
        404,
      );
    }
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.patch('/orders/:id', async (c) => {
  try {
    requirePermission('catalog.write');
    const body = UpdateOrderRequestSchema.parse(await c.req.json());
    const order = await orderService.updateAdminOrder(c.req.param('id'), body);
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});
