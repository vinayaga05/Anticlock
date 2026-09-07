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
import {
  providerAdminRoutes,
  providerMobileRoutes,
} from './routes/provider.js';
import { assistantRoutes } from './routes/assistant.js';
import { interestRoutes } from './routes/interests.js';
import { contentMobileRoutes, contentPublicRoutes } from './routes/content.js';
import { profileBlockRoutes } from './routes/blocks.js';
import { contentSafetyRoutes } from './routes/contentSafety.js';
import { startAssistantLifecycleJob } from './assistant/PrivacyService.js';
import { redisHealthCheck } from './lib/redis.js';
import {
  loadAiProviderConfig,
  logAiProviderStartup,
} from './config/ai-provider.config.js';

const isProduction = process.env.NODE_ENV === 'production';

function assertProductionConfiguration() {
  if (!isProduction) return;

  const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_ORIGIN', 'API_PUBLIC_URL'];
  const missing = required.filter(name => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(
      `Missing required production configuration: ${missing.join(', ')}`,
    );
  }

  if ((process.env.JWT_SECRET?.trim().length ?? 0) < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
}

function corsOrigins() {
  const adminOrigin = process.env.ADMIN_ORIGIN ?? 'http://localhost:3000';
  if (isProduction) return [adminOrigin];
  return [adminOrigin, 'http://localhost:3001', 'http://127.0.0.1:3000'];
}

assertProductionConfiguration();

const aiConfig = loadAiProviderConfig();
logAiProviderStartup(aiConfig);

const app = new Hono();

app.use(
  '*',
  cors({
    origin: corsOrigins(),
    allowHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Anticlock-Context-Type', 'X-Anticlock-Context-ID'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.get('/health', async c =>
  c.json({
    ok: true,
    service: 'anticlock-api',
    version: '0.1.0',
    redis: await redisHealthCheck(),
  }),
);

app.route('/auth', authRoutes);
app.route('/v1/catalog', catalogRoutes);
app.route('/v1/media', mediaPublicRoutes);
app.route('/v1/reels', reelsPublicRoutes);
app.route('/v1/provider', providerMobileRoutes);
app.route('/v1/assistant', assistantRoutes);
app.route('/v1/interests', interestRoutes);
app.route('/v1/content', contentMobileRoutes);
app.route('/v1/content', contentPublicRoutes);
app.route('/v1/content', contentSafetyRoutes);
app.route('/v1/blocks', profileBlockRoutes);
app.route('/admin', adminRoutes);
app.route('/admin/provider', providerAdminRoutes);
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
const hostname = process.env.API_HOST ?? '0.0.0.0';
serve({ fetch: app.fetch, port, hostname }, info => {
  console.log(`Anticlock API listening on http://${hostname}:${info.port}`);
  startAssistantLifecycleJob();
});

export default app;
