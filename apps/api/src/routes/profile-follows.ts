import { Hono } from 'hono';
import {
  CreateProfileFollowRequestSchema,
  ProfileFollowTargetSchema,
  ProfilePrivacyUpdateSchema,
  ProfileRefSchema,
} from '@anticlock/contracts';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { normalizePublisherType, resolveOwnedPublisher, type PublisherRef } from '../publishing/publisher.js';
import { profileFollowService } from '../social/ProfileFollowService.js';

function httpError(error: unknown) {
  const err = error as { status?: number; code?: string; message?: string };
  return {
    status: (err.status ?? 500) as 400 | 403 | 404 | 409 | 500,
    body: { error: { code: err.code ?? 'error', message: err.message ?? 'Unexpected error' } },
  };
}

function mobileUserId(auth: { kind: string; sub: string }) {
  if (auth.kind !== 'mobile') throw Object.assign(new Error('Mobile session required'), { status: 403, code: 'forbidden' });
  return auth.sub;
}

function routeRef(type: string, id: string): PublisherRef {
  const profileType = normalizePublisherType(type);
  if (!profileType || !/^[0-9a-f-]{36}$/i.test(id)) throw Object.assign(new Error('Profile not found'), { status: 404, code: 'not_found' });
  return { type: profileType, id };
}

/** Profile-scoped social graph. Every mutation verifies the acting profile belongs to auth. */
export const profileFollowRoutes = new Hono<AppEnv>();
profileFollowRoutes.use('*', requireAuth);

profileFollowRoutes.post('/', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const result = await profileFollowService.follow(userId, CreateProfileFollowRequestSchema.parse(await c.req.json()));
    return c.json({ data: result }, result.relationship.isRequested ? 202 : 201);
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

/** Unfollow accepted relationships and cancel pending outgoing requests. */
profileFollowRoutes.delete('/', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const body = CreateProfileFollowRequestSchema.parse(await c.req.json());
    return c.json({ data: await profileFollowService.unfollow(userId, { id: body.followerProfileId, type: body.followerProfileType }, { id: body.followedProfileId, type: body.followedProfileType }) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

profileFollowRoutes.get('/requests/:type/:id', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    return c.json({ data: await profileFollowService.incoming(userId, routeRef(c.req.param('type'), c.req.param('id'))) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

for (const action of ['accept', 'reject'] as const) {
  profileFollowRoutes.post(`/requests/:type/:id/${action}`, async c => {
    try {
      const userId = mobileUserId(c.get('auth'));
      const follower = ProfileRefSchema.parse(await c.req.json());
      const followed = routeRef(c.req.param('type'), c.req.param('id'));
      const data = action === 'accept'
        ? await profileFollowService.accept(userId, followed, follower)
        : await profileFollowService.reject(userId, followed, follower);
      return c.json({ data });
    } catch (error) {
      const { status, body } = httpError(error);
      return c.json(body, status);
    }
  });
}

profileFollowRoutes.post('/blocks', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const body = CreateProfileFollowRequestSchema.pick({ followerProfileId: true, followerProfileType: true, followedProfileId: true, followedProfileType: true }).parse(await c.req.json());
    await profileFollowService.block(userId, { id: body.followerProfileId, type: body.followerProfileType }, { id: body.followedProfileId, type: body.followedProfileType });
    return c.json({ data: { blocked: true } }, 201);
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

profileFollowRoutes.delete('/blocks', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const body = CreateProfileFollowRequestSchema.parse(await c.req.json());
    return c.json({ data: await profileFollowService.unblock(userId, { id: body.followerProfileId, type: body.followerProfileType }, { id: body.followedProfileId, type: body.followedProfileType }) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

profileFollowRoutes.patch('/privacy/:type/:id', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    return c.json({ data: await profileFollowService.updatePrivacy(userId, routeRef(c.req.param('type'), c.req.param('id')), ProfilePrivacyUpdateSchema.parse(await c.req.json())) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

profileFollowRoutes.get('/connections/:type/:id/:direction', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const direction = c.req.param('direction');
    if (direction !== 'followers' && direction !== 'following') {
      throw Object.assign(new Error('Not found'), { status: 404, code: 'not_found' });
    }
    const target = routeRef(c.req.param('type'), c.req.param('id'));
    const viewerType = normalizePublisherType(c.req.query('viewerProfileType')) ?? 'personal';
    const viewerId = c.req.query('viewerProfileId') ?? userId;
    const viewer = (await resolveOwnedPublisher(userId, { id: viewerId, type: viewerType })).ref;
    return c.json({ data: await profileFollowService.listConnections(userId, target, viewer, direction) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});

/** Viewer-specific status for the active identity. Defaults safely to personal. */
profileFollowRoutes.get('/relationship/:type/:id', async c => {
  try {
    const userId = mobileUserId(c.get('auth'));
    const target = routeRef(c.req.param('type'), c.req.param('id'));
    const actorType = normalizePublisherType(c.req.query('followerProfileType')) ?? 'personal';
    const actorId = c.req.query('followerProfileId') ?? userId;
    const actor = await resolveOwnedPublisher(userId, { id: actorId, type: actorType });
    return c.json({ data: await profileFollowService.relationship(actor.ref, target) });
  } catch (error) {
    const { status, body } = httpError(error);
    return c.json(body, status);
  }
});
