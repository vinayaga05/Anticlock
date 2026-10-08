import { Hono } from 'hono';
import { CreateContentPostReportRequestSchema } from '@anticlock/contracts';
import { contentReportService } from '../content/ContentReportService.js';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { httpError } from '../lib/httpError.js';

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
    const { status, body } = httpError(err, 'contentSafety');
    return c.json(body, status);
  }
});
