import { Hono } from 'hono';
import { z } from 'zod';
import { BusinessAvailabilityQuerySchema, CreateBusinessReviewRequestSchema, UpdateBusinessProfileRequestSchema, UpdateBusinessServicesRequestSchema } from '@anticlock/contracts';
import { optionalAuth, type AppEnv } from '../middleware/auth.js';
import { ApiError, httpError } from '../lib/httpError.js';
import { businessProfileService } from '../provider/BusinessProfileService.js';
import type { PublisherRef } from '../publishing/publisher.js';

type BusinessEnv = AppEnv & { Variables: { businessViewer?: PublisherRef } };
export const businessProfileRoutes = new Hono<BusinessEnv>();
businessProfileRoutes.use('*', optionalAuth, async (c, next) => {
  const auth = c.get('auth');
  if (auth && auth.kind !== 'mobile') return c.json({ error: { code: 'forbidden', message: 'Mobile session required.' } }, 403);
  if (c.req.method !== 'GET' && !auth) return c.json({ error: { code: 'unauthorized', message: 'Sign in to continue.' } }, 401);
  if (c.req.query('viewerProfileId') !== undefined || c.req.query('viewerProfileType') !== undefined) {
    try {
      if (!auth) throw new ApiError(401, 'unauthorized', 'Sign in to choose a viewer profile.');
      const input = z.object({ id: z.string().uuid(), type: z.enum(['personal', 'business']) }).parse({ id: c.req.query('viewerProfileId'), type: c.req.query('viewerProfileType') });
      c.set('businessViewer', await businessProfileService.resolveViewer(auth.sub, input));
    } catch (error) { const mapped = httpError(error, 'business-viewer'); return c.json(mapped.body, mapped.status); }
  }
  await next();
});
async function body(c: { req: { json(): Promise<unknown> } }) {
  try { return await c.req.json(); } catch { throw new ApiError(400, 'validation_error', 'A valid JSON request is required.'); }
}
const reviewQuery = z.object({ limit: z.coerce.number().int().min(1).max(30).default(10), cursor: z.string().min(1).max(512).optional() });
const reportRequest = z.object({ reason: z.enum(['spam', 'misleading', 'inappropriate', 'safety', 'other']), details: z.string().trim().max(2000).optional() }).strict();
businessProfileRoutes.get('/saved', async c => {
  try {
    if (!c.get('auth')) throw new ApiError(401, 'unauthorized', 'Sign in to view saved businesses.');
    const query = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20), cursor: z.string().min(1).max(512).optional() }).parse(c.req.query());
    return c.json(await businessProfileService.listSaved(c.get('auth').sub, query.limit, query.cursor, c.get('businessViewer')));
  } catch (error) { const mapped = httpError(error, 'saved-businesses'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.get('/:id', async c => {
  try { return c.json({ business: await businessProfileService.getProfile(c.req.param('id'), c.get('auth')?.sub, c.get('businessViewer')) }); }
  catch (error) { const mapped = httpError(error, 'business-profile'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.get('/:id/availability', async c => {
  try { const query = BusinessAvailabilityQuerySchema.parse(c.req.query()); return c.json({ availability: await businessProfileService.availability(c.req.param('id'), query, c.get('auth')?.sub, undefined, c.get('businessViewer')) }); }
  catch (error) { const mapped = httpError(error, 'business-availability'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.get('/:id/reviews', async c => {
  try { const query = reviewQuery.parse(c.req.query()); return c.json(await businessProfileService.listReviews(c.req.param('id'), c.get('auth')?.sub, query.limit, query.cursor, c.get('businessViewer'))); }
  catch (error) { const mapped = httpError(error, 'business-reviews'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.post('/:id/reviews', async c => {
  try { return c.json({ review: await businessProfileService.createReview(c.req.param('id'), c.get('auth').sub, CreateBusinessReviewRequestSchema.parse(await body(c)), c.get('businessViewer')) }, 201); }
  catch (error) { const mapped = httpError(error, 'business-reviews'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.put('/:id/save', async c => {
  try { const request = z.object({ saved: z.boolean() }).strict().parse(await body(c)); return c.json(await businessProfileService.save(c.req.param('id'), c.get('auth').sub, request.saved, c.get('businessViewer'))); }
  catch (error) { const mapped = httpError(error, 'business-save'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.post('/:id/reports', async c => {
  try { return c.json(await businessProfileService.report(c.req.param('id'), c.get('auth').sub, reportRequest.parse(await body(c)), c.get('businessViewer')), 201); }
  catch (error) { const mapped = httpError(error, 'business-report'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.patch('/:id', async c => {
  try { return c.json({ business: await businessProfileService.updateProfile(c.req.param('id'), c.get('auth').sub, UpdateBusinessProfileRequestSchema.parse(await body(c))) }); }
  catch (error) { const mapped = httpError(error, 'business-update'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.put('/:id/services', async c => {
  try { return c.json({ business: await businessProfileService.updateServices(c.req.param('id'), c.get('auth').sub, UpdateBusinessServicesRequestSchema.parse(await body(c))) }); }
  catch (error) { const mapped = httpError(error, 'business-services'); return c.json(mapped.body, mapped.status); }
});
businessProfileRoutes.get('/:id/analytics', async c => {
  try {
    if (!c.get('auth')) throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
    return c.json({ analytics: await businessProfileService.analytics(c.req.param('id'), c.get('auth').sub) });
  } catch (error) { const mapped = httpError(error, 'business-analytics'); return c.json(mapped.body, mapped.status); }
});
