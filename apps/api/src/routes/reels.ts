import { Hono } from 'hono';
import {
  CreateReelCommentRequestSchema,
  CreateReelReportRequestSchema,
  CreateReelRequestSchema,
  ImportStreamReelRequestSchema,
  ReelAnalyticsEventRequestSchema,
  ReelListQuerySchema,
  ReelReportListQuerySchema,
  ResolveReelReportRequestSchema,
  ReturnReelToDraftRequestSchema,
  SetReelLikeRequestSchema,
  UpdateReelRequestSchema,
} from '@anticlock/contracts';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';
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

reelsAdminRoutes.get(
  '/reports',
  requirePermission('moderation.act'),
  async c => {
    try {
      const query = ReelReportListQuerySchema.parse(c.req.query());
      const data = await reelService.listReports(c.get('auth'), query);
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/reports/:reportId/resolve',
  requirePermission('moderation.act'),
  async c => {
    try {
      const body = ResolveReelReportRequestSchema.parse(await c.req.json());
      const data = await reelService.resolveReport(
        c.get('auth'),
        c.req.param('reportId'),
        body,
      );
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
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
      const data = await reelService.syncMedia(
        c.get('auth'),
        c.req.param('id'),
      );
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/publish',
  requirePermission('cms.publish'),
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
  '/:id/submit-review',
  requirePermission('cms.write'),
  async c => {
    try {
      // The request has no writable fields. Do not require a body so a plain
      // POST works from tools as well as the Admin UI.
      const data = await reelService.submitForReview(
        c.get('auth'),
        c.req.param('id'),
      );
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/return-to-draft',
  requirePermission('cms.write'),
  async c => {
    try {
      const raw = await c.req.text();
      const body = ReturnReelToDraftRequestSchema.parse(
        raw ? JSON.parse(raw) : {},
      );
      const data = await reelService.returnToDraft(
        c.get('auth'),
        c.req.param('id'),
        body,
      );
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

reelsAdminRoutes.post(
  '/:id/unpublish',
  requirePermission('cms.publish'),
  async c => {
    try {
      const data = await reelService.unpublish(
        c.get('auth'),
        c.req.param('id'),
      );
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

reelsAdminRoutes.get(
  '/:id/analytics',
  requirePermission('cms.read'),
  async c => {
    try {
      const data = await reelService.analytics(c.get('auth'), c.req.param('id'));
      return c.json({ data });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

/** Public feed for mobile Clips */
export const reelsPublicRoutes = new Hono<AppEnv>();

reelsPublicRoutes.get('/', async c => {
  try {
    const data = await reelService.listFeed();
    return c.json({ data });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

/**
 * Mobile-only engagement endpoints. They intentionally live under `/v1` for
 * the app but require a signed mobile session and only accept live Reels.
 */
reelsPublicRoutes.post('/:id/analytics-events', requireAuth, async c => {
  try {
    const body = ReelAnalyticsEventRequestSchema.parse(await c.req.json());
    return c.json(
      await reelService.recordAnalyticsEvent(c.get('auth'), c.req.param('id'), body),
    );
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsPublicRoutes.put('/:id/like', requireAuth, async c => {
  try {
    const body = SetReelLikeRequestSchema.parse(await c.req.json());
    return c.json(
      await reelService.setMobileLike(c.get('auth'), c.req.param('id'), body),
    );
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsPublicRoutes.post('/:id/comments', requireAuth, async c => {
  try {
    const body = CreateReelCommentRequestSchema.parse(await c.req.json());
    return c.json(
      await reelService.createMobileComment(c.get('auth'), c.req.param('id'), body),
      201,
    );
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

reelsPublicRoutes.post('/:id/reports', requireAuth, async c => {
  try {
    const body = CreateReelReportRequestSchema.parse(await c.req.json());
    return c.json(
      await reelService.createMobileReport(c.get('auth'), c.req.param('id'), body),
      201,
    );
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
