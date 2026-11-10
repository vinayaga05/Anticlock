import { Hono } from 'hono';
import {
  CreateExploreEventRequestSchema,
  ExploreAdminListQuerySchema,
  ExploreEventListQuerySchema,
  ExploreReviewRequestSchema,
  UpdateExploreEventRequestSchema,
} from '@anticlock/contracts';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';
import { httpError } from '../lib/httpError.js';
import { resolveOwnedPublisher } from '../publishing/publisher.js';
import { exploreEventService } from '../explore/ExploreEventService.js';

function requireMobileAuth(c: { get: (key: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth;
}

async function viewer(c: any, userId: string) {
  return resolveOwnedPublisher(userId, {
    id: c.req.query('viewerProfileId') ?? userId,
    type: c.req.query('viewerProfileType') ?? 'personal',
  });
}

export const exploreMobileRoutes = new Hono<AppEnv>();
exploreMobileRoutes.use('*', requireAuth);

exploreMobileRoutes.post('/events', async c => {
  try {
    const auth = requireMobileAuth(c);
    const input = CreateExploreEventRequestSchema.parse(await c.req.json());
    return c.json({ event: await exploreEventService.create(auth.sub, input) }, 201);
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.get('/events/mine', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json({ events: await exploreEventService.mine(auth.sub) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.get('/events/saved', async c => {
  try {
    const auth = requireMobileAuth(c);
    const owned = await viewer(c, auth.sub);
    return c.json({ events: await exploreEventService.saved(auth.sub, owned.ref) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.get('/events', async c => {
  try {
    const auth = requireMobileAuth(c);
    const query = ExploreEventListQuerySchema.parse({
      search: c.req.query('search'),
      categoryId: c.req.query('categoryId'),
      following: c.req.query('following'),
      startsAfter: c.req.query('startsAfter'),
      startsBefore: c.req.query('startsBefore'),
      freeOnly: c.req.query('freeOnly'),
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor'),
      viewerProfileId: c.req.query('viewerProfileId'),
      viewerProfileType: c.req.query('viewerProfileType'),
    });
    const owned = await viewer(c, auth.sub);
    return c.json(await exploreEventService.list(auth.sub, owned.ref, query));
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.get('/events/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const owned = await viewer(c, auth.sub);
    return c.json({ event: await exploreEventService.get(auth.sub, owned.ref, c.req.param('id')) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.patch('/events/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const input = UpdateExploreEventRequestSchema.parse(await c.req.json());
    return c.json({ event: await exploreEventService.update(auth.sub, c.req.param('id'), input) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.post('/events/:id/submit', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json({ event: await exploreEventService.submit(auth.sub, c.req.param('id')) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.post('/events/:id/archive', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json({ event: await exploreEventService.archive(auth.sub, c.req.param('id')) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.delete('/events/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    return c.json(await exploreEventService.remove(auth.sub, c.req.param('id')));
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.post('/events/:id/register', async c => {
  try {
    const auth = requireMobileAuth(c);
    const owned = await viewer(c, auth.sub);
    return c.json({ event: await exploreEventService.register(auth.sub, owned.ref, c.req.param('id')) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

exploreMobileRoutes.delete('/events/:id/register', async c => {
  try {
    const auth = requireMobileAuth(c);
    const owned = await viewer(c, auth.sub);
    return c.json({ event: await exploreEventService.unregister(auth.sub, owned.ref, c.req.param('id')) });
  } catch (error) {
    const { status, body } = httpError(error, 'explore');
    return c.json(body, status);
  }
});

for (const method of ['post', 'delete'] as const) {
  exploreMobileRoutes[method]('/events/:id/save', async c => {
    try {
      const auth = requireMobileAuth(c);
      const owned = await viewer(c, auth.sub);
      return c.json({ event: await exploreEventService.setSaved(
        auth.sub, owned.ref, c.req.param('id'), method === 'post',
      ) });
    } catch (error) {
      const { status, body } = httpError(error, 'explore');
      return c.json(body, status);
    }
  });
}

export const exploreAdminRoutes = new Hono<AppEnv>();
exploreAdminRoutes.use('*', requireAuth);

exploreAdminRoutes.get(
  '/events',
  requirePermission('catalog.read'),
  async c => {
    try {
      const query = ExploreAdminListQuerySchema.parse({
        status: c.req.query('status'),
        search: c.req.query('search'),
        limit: c.req.query('limit'),
        cursor: c.req.query('cursor'),
      });
      return c.json(await exploreEventService.adminList(query));
    } catch (error) {
      const { status, body } = httpError(error, 'explore');
      return c.json(body, status);
    }
  },
);

exploreAdminRoutes.post(
  '/events/:id/review',
  requirePermission('moderation.act'),
  async c => {
    try {
      const auth = c.get('auth');
      const input = ExploreReviewRequestSchema.parse(await c.req.json());
      const event = await exploreEventService.review(c.req.param('id'), input, {
        id: auth.sub,
        email: auth.email,
      });
      return c.json({ event });
    } catch (error) {
      const { status, body } = httpError(error, 'explore');
      return c.json(body, status);
    }
  },
);
