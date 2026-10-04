import { Hono } from 'hono';
import {
  CreateOrderRequestSchema,
  CreateProductRequestSchema,
  OrderAdminQuerySchema,
  OrderListQuerySchema,
  ProductListQuerySchema,
  UpdateOrderRequestSchema,
  UpdateProductRequestSchema,
} from '@anticlock/contracts';
import { productService } from '../shop/ProductService.js';
import { orderService } from '../shop/OrderService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';

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

function httpError(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 409 | 500,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.message ?? 'Unexpected error',
      },
    },
  };
}

export const shopMobileRoutes = new Hono<AppEnv>();
shopMobileRoutes.use('*', requireAuth);

// Products
shopMobileRoutes.get('/products', async c => {
  try {
    const query = {
      categoryId: c.req.query('categoryId'),
      status: c.req.query('status') || 'published',
      search: c.req.query('search'),
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
      cursor: c.req.query('cursor'),
    };
    const validated = ProductListQuerySchema.parse(query);
    const result = await productService.listProducts(validated);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/:id', async c => {
  try {
    const product = await productService.getProductWithImages(c.req.param('id'));
    if (!product) {
      return c.json(
        { error: { code: 'not_found', message: 'Product not found' } },
        404,
      );
    }
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

// Orders
shopMobileRoutes.post('/orders', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateOrderRequestSchema.parse(await c.req.json());
    const order = await orderService.createOrder(auth.sub, body);
    return c.json({ order }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/orders', async c => {
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
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/orders/:id', async c => {
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
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/orders/:id/cancel', async c => {
  try {
    const auth = requireMobileAuth(c);
    const order = await orderService.cancelOrder(c.req.param('id'), auth.sub);
    if (!order) {
      return c.json(
        { error: { code: 'not_found', message: 'Order not found or cannot be cancelled' } },
        404,
      );
    }
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const shopAdminRoutes = new Hono<AppEnv>();
shopAdminRoutes.use('*', requireAuth);

// Products Admin
shopAdminRoutes.get(
  '/products',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        categoryId: c.req.query('categoryId'),
        status: c.req.query('status'),
        search: c.req.query('search'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = ProductListQuerySchema.parse(query);
      const result = await productService.listProducts(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.get(
  '/products/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const product = await productService.getProductWithImages(c.req.param('id'));
      if (!product) {
        return c.json(
          { error: { code: 'not_found', message: 'Product not found' } },
          404,
        );
      }
      return c.json({ product });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.post(
  '/products',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = CreateProductRequestSchema.parse(await c.req.json());
      const product = await productService.createProduct(body);
      return c.json({ product }, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.patch(
  '/products/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateProductRequestSchema.parse(await c.req.json());
      const product = await productService.updateProduct(c.req.param('id'), body);
      if (!product) {
        return c.json(
          { error: { code: 'not_found', message: 'Product not found' } },
          404,
        );
      }
      return c.json({ product });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.delete(
  '/products/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const deleted = await productService.deleteProduct(c.req.param('id'));
      if (!deleted) {
        return c.json(
          { error: { code: 'not_found', message: 'Product not found' } },
          404,
        );
      }
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

// Orders Admin
shopAdminRoutes.get(
  '/orders',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = {
        userId: c.req.query('userId'),
        status: c.req.query('status'),
        from: c.req.query('from'),
        to: c.req.query('to'),
        search: c.req.query('search'),
        limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
        cursor: c.req.query('cursor'),
      };
      const validated = OrderAdminQuerySchema.parse(query);
      const result = await orderService.listOrdersAdmin(validated);
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.get(
  '/orders/:id',
  requirePermission('catalog.read'),
  async c => {
    try {
      const order = await orderService.getOrderAdmin(c.req.param('id'));
      if (!order) {
        return c.json(
          { error: { code: 'not_found', message: 'Order not found' } },
          404,
        );
      }
      return c.json({ order });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

shopAdminRoutes.patch(
  '/orders/:id',
  requirePermission('catalog.write'),
  async c => {
    try {
      const body = UpdateOrderRequestSchema.parse(await c.req.json());
      const order = await orderService.updateOrderAdmin(c.req.param('id'), body);
      if (!order) {
        return c.json(
          { error: { code: 'not_found', message: 'Order not found' } },
          404,
        );
      }
      return c.json({ order });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);
