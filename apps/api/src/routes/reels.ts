import { Hono } from 'hono';
import {
  CreateReelRequestSchema,
  ImportStreamReelRequestSchema,
  ReelListQuerySchema,
  UpdateReelRequestSchema,
} from '@anticlock/contracts';
import { requireAuth, requirePermission, type AppEnv } from '../middleware/auth.js';
import { reelService } from '../reels/ReelService.js';
import {
  applyStreamWebhook,
  verifyStreamWebhookSignature,
} from '../reels/streamWebhook.js';

function httpError(err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  const status = (e.status ?? 500) as 400 | 403 | 404 | 409 | 410 | 500;
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

export const reelsAdminRoutes = new Hono<AppEnv>();
reelsAdminRoutes.use('*', requireAuth);

reelsAdminRoutes.get('/meta', requirePermission('cms.read'), c =>
  c.json({ streamConfigured: reelService.streamEnabled() }),
);

reelsAdminRoutes.get('/', requirePermission('cms.read'), async c => {
  try {
    const query = ReelListQuerySchema.parse(c.req.query());
    const data = await reelService.listAdmin(c.get('auth'), query);
    return c.json({ data });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsAdminRoutes.post('/', requirePermission('cms.write'), async c => {
  try {
    const body = CreateReelRequestSchema.parse(await c.req.json());
    const data = await reelService.create(c.get('auth'), body);
    return c.json({ data }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsAdminRoutes.post(
  '/import-stream',
  requirePermission('cms.write'),
  async c => {
    try {
      const body = ImportStreamReelRequestSchema.parse(await c.req.json());
      const data = await reelService.importStream(c.get('auth'), body);
      return c.json({ data }, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.get('/:id', requirePermission('cms.read'), async c => {
  try {
    const data = await reelService.getAdmin(c.get('auth'), c.req.param('id'));
    return c.json({ data });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsAdminRoutes.patch('/:id', requirePermission('cms.write'), async c => {
  try {
    const body = UpdateReelRequestSchema.parse(await c.req.json());
    const data = await reelService.update(
      c.get('auth'),
      c.req.param('id'),
      body,
    );
    return c.json({ data });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsAdminRoutes.post(
  '/:id/upload-session',
  requirePermission('cms.write'),
  async c => {
    try {
      const data = await reelService.createUploadSession(
        c.get('auth'),
        c.req.param('id'),
      );
      return c.json(data, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/sync-media',
  requirePermission('cms.write'),
  async c => {
    try {
      const data = await reelService.syncMedia(c.get('auth'), c.req.param('id'));
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/publish',
  requirePermission('cms.write'),
  async c => {
    try {
      const data = await reelService.publish(c.get('auth'), c.req.param('id'));
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/unpublish',
  requirePermission('cms.write'),
  async c => {
    try {
      const data = await reelService.unpublish(c.get('auth'), c.req.param('id'));
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/archive',
  requirePermission('cms.write'),
  async c => {
    try {
      const data = await reelService.archive(c.get('auth'), c.req.param('id'));
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

/** Public feed for mobile Clips */
export const reelsPublicRoutes = new Hono();

reelsPublicRoutes.get('/', async c => {
  try {
    const data = await reelService.listFeed();
    return c.json({ data });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

/** Cloudflare Stream webhook (signature-verified) */
export const streamWebhookRoutes = new Hono();

streamWebhookRoutes.post('/', async c => {
  const rawBody = await c.req.text();
  const secret = process.env.STREAM_WEBHOOK_SECRET?.trim();
  if (secret) {
    const ok = verifyStreamWebhookSignature(
      rawBody,
      c.req.header('Webhook-Signature'),
      secret,
    );
    if (!ok) {
      return c.json(
        { error: { code: 'invalid_signature', message: 'Invalid signature' } },
        403,
      );
    }
  } else if (process.env.NODE_ENV === 'production') {
    return c.json(
      {
        error: {
          code: 'misconfigured',
          message: 'STREAM_WEBHOOK_SECRET is required in production',
        },
      },
      500,
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json(
      { error: { code: 'invalid_json', message: 'Invalid JSON body' } },
      400,
    );
  }

  const result = await applyStreamWebhook(
    payload as {
      uid?: string;
      readyToStream?: boolean;
      status?: { state?: string };
      duration?: number;
    },
  );
  return c.json({ ok: true, ...result });
});
