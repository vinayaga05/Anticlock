import { Hono } from 'hono';
import { ComplaintListQuerySchema, CreateComplaintRequestSchema } from '@anticlock/contracts';
import { complaintService } from '../complaints/ComplaintService.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { ApiError, httpError } from '../lib/httpError.js';

export const complaintsMobileRoutes = new Hono<AppEnv>();
complaintsMobileRoutes.use('*', requireAuth, async (c, next) => {
  if (c.get('auth').kind !== 'mobile') {
    return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
  }
  await next();
});

complaintsMobileRoutes.get('/', async c => {
  try {
    const rawLimit = c.req.query('limit');
    const query = ComplaintListQuerySchema.parse({
      limit: rawLimit === undefined ? undefined : Number(rawLimit),
      cursor: c.req.query('cursor'),
    });
    return c.json(await complaintService.listComplaints(c.get('auth').sub, query));
  } catch (error) {
    const { status, body } = httpError(error, 'complaints');
    return c.json(body, status);
  }
});

complaintsMobileRoutes.post('/', async c => {
  try {
    let json: unknown;
    try { json = await c.req.json(); }
    catch { throw new ApiError(400, 'validation_error', 'A valid JSON complaint is required.'); }
    const request = CreateComplaintRequestSchema.parse(json);
    const complaint = await complaintService.createComplaint(c.get('auth').sub, request);
    return c.json({ complaint }, 201);
  } catch (error) {
    const { status, body } = httpError(error, 'complaints');
    return c.json(body, status);
  }
});
