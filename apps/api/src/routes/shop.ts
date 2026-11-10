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
  CreateUserProductRequestSchema,
  UpdateUserProductRequestSchema,
  ExploreReviewRequestSchema,
} from '@anticlock/contracts';
import { productService } from '../shop/ProductService.js';
import { orderService } from '../shop/OrderService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';
import { httpError } from '../lib/httpError.js';
import { resolveOwnedPublisher } from '../publishing/publisher.js';

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
    const result = await productService.listProducts({
      ...validated,
      requestedVisibility: 'public',
    });
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/categories', async c => {
  try {
    return c.json({ categories: await productService.listCategories() });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/mine', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json(await productService.listMine(auth.sub));
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/explore', async c => {
  try {
    const auth = requireMobileAuth(c);
    const viewerProfileId = c.req.query('viewerProfileId');
    const viewerProfileType = c.req.query('viewerProfileType') as 'personal' | 'business' | undefined;
    const owned = await resolveOwnedPublisher(auth.sub, {
      id: viewerProfileId,
      type: viewerProfileType,
    });
    return c.json(await productService.listExploreProducts({
      userId: auth.sub,
      viewer: owned.ref,
      categoryId: c.req.query('categoryId'),
      search: c.req.query('search'),
      following: c.req.query('following') === 'true',
      maxPrice: c.req.query('maxPrice') ? Number(c.req.query('maxPrice')) : undefined,
      limit: c.req.query('limit') ? Number(c.req.query('limit')) : undefined,
    }));
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/saved', async c => {
  try {
    const auth = requireMobileAuth(c);
    const owned = await resolveOwnedPublisher(auth.sub, {
      id: c.req.query('viewerProfileId'),
      type: c.req.query('viewerProfileType') as 'personal' | 'business' | undefined,
    });
    return c.json(await productService.listSaved(auth.sub, owned.ref));
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/products', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateUserProductRequestSchema.parse(await c.req.json());
    return c.json({ product: await productService.createUserProduct(auth.sub, body) }, 201);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.get('/products/:id', async (c) => {
  try {
    const auth = requireMobileAuth(c);
    const viewerProfileId = c.req.query('viewerProfileId');
    const viewerProfileType = c.req.query('viewerProfileType') as 'personal' | 'business' | undefined;
    const owned = await resolveOwnedPublisher(auth.sub, {
      id: viewerProfileId,
      type: viewerProfileType,
    });
    const product = await productService.getProductForViewer(c.req.param('id'), auth.sub, owned.ref);
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.patch('/products/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = UpdateUserProductRequestSchema.parse(await c.req.json());
    return c.json({ product: await productService.updateUserProduct(auth.sub, c.req.param('id'), body) });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/products/:id/submit', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json({ product: await productService.submitUserProduct(auth.sub, c.req.param('id')) });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.post('/products/:id/archive', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json({ product: await productService.archiveUserProduct(auth.sub, c.req.param('id')) });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopMobileRoutes.delete('/products/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    await productService.deleteUserProduct(auth.sub, c.req.param('id'));
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

for (const method of ['post', 'delete'] as const) {
  shopMobileRoutes[method]('/products/:id/save', async c => {
    try {
      const auth = requireMobileAuth(c);
      const owned = await resolveOwnedPublisher(auth.sub, {
        id: c.req.query('viewerProfileId'),
        type: c.req.query('viewerProfileType') as 'personal' | 'business' | undefined,
      });
      return c.json({ product: await productService.setSaved(
        auth.sub, owned.ref, c.req.param('id'), method === 'post',
      ) });
    } catch (err) {
      const { status, body } = httpError(err, 'shop');
      return c.json(body, status);
    }
  });
}

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
      reviewStatus: c.req.query('reviewStatus'),
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

shopAdminRoutes.post('/products', requirePermission('catalog.write'), async (c) => {
  try {
    const body = CreateProductRequestSchema.parse(await c.req.json());
    const product = await productService.createProduct(body);
    return c.json({ product }, 201);
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.patch('/products/:id', requirePermission('catalog.write'), async (c) => {
  try {
    const body = UpdateProductRequestSchema.parse(await c.req.json());
    const product = await productService.updateProduct(c.req.param('id'), body);
    return c.json({ product });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.delete('/products/:id', requirePermission('catalog.write'), async (c) => {
  try {
    await productService.deleteProduct(c.req.param('id'));
    return c.json({ success: true });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});

shopAdminRoutes.post(
  '/products/:id/review',
  requirePermission('moderation.act'),
  async c => {
    try {
      const auth = c.get('auth');
      const body = ExploreReviewRequestSchema.parse(await c.req.json());
      const product = await productService.reviewUserProduct(c.req.param('id'), body, {
        id: auth.sub,
        email: auth.email,
      });
      return c.json({ product });
    } catch (err) {
      const { status, body } = httpError(err, 'shop');
      return c.json(body, status);
    }
  },
);

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

shopAdminRoutes.patch('/orders/:id', requirePermission('catalog.write'), async (c) => {
  try {
    const body = UpdateOrderRequestSchema.parse(await c.req.json());
    const order = await orderService.updateAdminOrder(c.req.param('id'), body);
    return c.json({ order });
  } catch (err) {
    const { status, body } = httpError(err, 'shop');
    return c.json(body, status);
  }
});
