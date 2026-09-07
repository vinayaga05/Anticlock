import { Hono } from 'hono';
import { CreateContentPostReportRequestSchema } from '@anticlock/contracts';
import { contentReportService } from '../content/ContentReportService.js';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';

function httpError(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  const status = (e.status ?? 500) as 400 | 403 | 404 | 409 | 500;
  return {
    status,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.message ?? 'Unexpected error',
      },
    },
  };
}

/** Safety writes for profile-published video posts. */
export const contentSafetyRoutes = new Hono<AppEnv>();
contentSafetyRoutes.use('*', requireAuth);

contentSafetyRoutes.post('/posts/:id/reports', async c => {
  try {
    const body = CreateContentPostReportRequestSchema.parse(await c.req.json());
    const auth = c.get('auth');
    const data = await contentReportService.create(auth, c.req.param('id'), body);
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email || null,
      action: 'content_post.report',
      entityType: 'content_post',
      entityId: data.contentPostId,
      metadata: { reason: body.reason },
    });
    return c.json({ data }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});
