import { Hono } from 'hono';
import { UpdateMyInterestsRequestSchema } from '@anticlock/contracts';
import { interestService } from '../interests/InterestService.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { writeAudit } from '../lib/audit.js';

function mobileUserId(c: { get: (key: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth.sub;
}

function errorResponse(c: { json: Function }, error: unknown) {
  if (error instanceof Error && error.name === 'ZodError') {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid interest selection.' } },
      400,
    );
  }
  const e = error as { status?: number; code?: string; message?: string };
  return c.json(
    { error: { code: e.code ?? 'request_failed', message: e.message ?? 'Request failed' } },
    e.status ?? 500,
  );
}

export const interestRoutes = new Hono<AppEnv>();
interestRoutes.use('*', requireAuth);

interestRoutes.get('/me', async c => {
  try {
    return c.json(await interestService.getForUser(mobileUserId(c)));
  } catch (error) {
    return errorResponse(c, error);
  }
});

interestRoutes.put('/me', async c => {
  try {
    const userId = mobileUserId(c);
    const input = UpdateMyInterestsRequestSchema.parse(await c.req.json());
    const data = await interestService.updateForUser(userId, input);
    await writeAudit({
      actorId: userId,
      actorEmail: c.get('auth').email,
      action: 'mobile_user.interests_updated',
      entityType: 'mobile_user',
      entityId: userId,
      metadata: { selectedCount: input.interestIds.length },
    });
    return c.json(data);
  } catch (error) {
    return errorResponse(c, error);
  }
});
