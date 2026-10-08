import { Hono } from 'hono';
import {
  CreateProfileBlockRequestSchema,
  ProfileBlockTargetSchema,
} from '@anticlock/contracts';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { blockService } from '../blocks/BlockService.js';
import { httpError } from '../lib/httpError.js';

/** Durable, account-scoped block preferences for personal and business profiles. */
export const profileBlockRoutes = new Hono<AppEnv>();
profileBlockRoutes.use('*', requireAuth);

profileBlockRoutes.get('/', async c => {
  try {
    return c.json({ data: await blockService.list(c.get('auth')) });
  } catch (err) {
    const { status, body } = httpError(err, 'blocks');
    return c.json(body, status);
  }
});

profileBlockRoutes.post('/', async c => {
  try {
    const target = CreateProfileBlockRequestSchema.parse(await c.req.json());
    const result = await blockService.create(c.get('auth'), target);
    if (result.created) {
      const auth = c.get('auth');
      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email || null,
        action: 'mobile_user.profile_blocked',
        entityType: result.block.type === 'business' ? 'provider' : 'mobile_user',
        entityId: result.block.id,
        metadata: { targetType: result.block.type },
      });
    }
    return c.json({ data: result.block, created: result.created }, result.created ? 201 : 200);
  } catch (err) {
    const { status, body } = httpError(err, 'blocks');
    return c.json(body, status);
  }
});

profileBlockRoutes.delete('/:type/:id', async c => {
  try {
    const target = ProfileBlockTargetSchema.parse({
      type: c.req.param('type'),
      id: c.req.param('id'),
    });
    const result = await blockService.remove(c.get('auth'), target);
    if (result.removed) {
      const auth = c.get('auth');
      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email || null,
        action: 'mobile_user.profile_unblocked',
        entityType: target.type === 'business' ? 'provider' : 'mobile_user',
        entityId: target.id,
        metadata: { targetType: target.type },
      });
    }
    return c.json({ data: result });
  } catch (err) {
    const { status, body } = httpError(err, 'blocks');
    return c.json(body, status);
  }
});
