import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { adminRoutes, catalogRoutes } from './routes/admin.js';
import {
  mediaAdminRoutes,
  mediaPublicRoutes,
  stubDomainRoutes,
} from './routes/media.js';
import {
  reelsAdminRoutes,
  reelsPublicRoutes,
  streamWebhookRoutes,
} from './routes/reels.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: [
      process.env.ADMIN_ORIGIN ?? 'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.get('/health', c =>
  c.json({ ok: true, service: 'anticlock-api', version: '0.1.0' }),
);

app.route('/auth', authRoutes);
app.route('/v1/catalog', catalogRoutes);
app.route('/v1/media', mediaPublicRoutes);
app.route('/v1/reels', reelsPublicRoutes);
app.route('/admin', adminRoutes);
app.route('/admin/media', mediaAdminRoutes);
app.route('/admin/stubs', stubDomainRoutes);
app.route('/admin/reels', reelsAdminRoutes);
app.route('/webhooks/cloudflare/stream', streamWebhookRoutes);

app.onError((err, c) => {
  console.error(err);
  if (err.name === 'ZodError') {
    return c.json(
      { error: { code: 'validation_error', message: err.message, details: err } },
      400,
    );
  }
  return c.json(
    { error: { code: 'internal_error', message: 'Unexpected server error' } },
    500,
  );
});

const port = Number(process.env.API_PORT ?? 4000);
serve({ fetch: app.fetch, port }, info => {
  console.log(`Anticlock API listening on http://localhost:${info.port}`);
});

export default app;
