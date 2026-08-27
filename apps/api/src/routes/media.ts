import { Hono } from 'hono';
import {
  AttachMediaUsageRequestSchema,
  CompleteUploadRequestSchema,
  CreateUploadSessionRequestSchema,
  MediaListQuerySchema,
} from '@anticlock/contracts';
import { requireAuth, requirePermission, type AppEnv } from '../middleware/auth.js';
import { mediaService } from '../media/MediaService.js';
import { mediaAccessPolicy } from '../media/MediaAccessPolicy.js';

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

export const mediaAdminRoutes = new Hono<AppEnv>();

mediaAdminRoutes.use('*', requireAuth);

mediaAdminRoutes.post(
  '/upload-sessions',
  requirePermission('media.write'),
  async c => {
    try {
      const body = CreateUploadSessionRequestSchema.parse(await c.req.json());
      const result = await mediaService.createUploadSession(c.get('auth'), body);
      return c.json(result, 201);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.put(
  '/upload-sessions/:id/content',
  requirePermission('media.write'),
  async c => {
    try {
      const buf = Buffer.from(await c.req.arrayBuffer());
      const result = await mediaService.putLocalContent(
        c.get('auth'),
        c.req.param('id'),
        buf,
      );
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.post(
  '/upload-sessions/:id/complete',
  requirePermission('media.write'),
  async c => {
    try {
      const raw = await c.req.json().catch(() => ({}));
      const body = CompleteUploadRequestSchema.parse(raw);
      const result = await mediaService.completeUpload(
        c.get('auth'),
        c.req.param('id'),
        body.checksumSha256,
      );
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.get('/', requirePermission('media.read'), async c => {
  try {
    const query = MediaListQuerySchema.parse({
      q: c.req.query('q'),
      kind: c.req.query('kind'),
      status: c.req.query('status'),
      accessLevel: c.req.query('accessLevel'),
      limit: c.req.query('limit'),
    });
    const result = await mediaService.list(c.get('auth'), query);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

mediaAdminRoutes.get(
  '/by-checksum/:sha256',
  requirePermission('media.read'),
  async c => {
    try {
      const asset = await mediaService.byChecksum(
        c.get('auth'),
        c.req.param('sha256'),
      );
      return c.json({ asset });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.post('/usages', requirePermission('media.write'), async c => {
  try {
    const body = AttachMediaUsageRequestSchema.parse(await c.req.json());
    const result = await mediaService.attachUsage(c.get('auth'), body);
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

mediaAdminRoutes.delete(
  '/usages/:id',
  requirePermission('media.write'),
  async c => {
    try {
      const result = await mediaService.detachUsage(
        c.get('auth'),
        c.req.param('id'),
      );
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.get(
  '/file/:bucket/:key{.+}',
  requirePermission('media.read'),
  async c => {
    try {
      const bucket = c.req.param('bucket');
      const key = decodeURIComponent(c.req.param('key'));
      const asset = await mediaService.findAssetByKey(bucket, key);
      if (!asset) {
        return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
      }
      const buf = await mediaService.getFileBuffer(bucket, key);
      return new Response(new Uint8Array(buf), {
        headers: {
          'Content-Type': asset.mimeType ?? 'application/octet-stream',
          'Cache-Control': 'private, max-age=60',
        },
      });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.get('/:id', requirePermission('media.read'), async c => {
  try {
    const result = await mediaService.get(c.get('auth'), c.req.param('id'));
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

mediaAdminRoutes.post(
  '/:id/archive',
  requirePermission('media.write'),
  async c => {
    try {
      const asset = await mediaService.archive(c.get('auth'), c.req.param('id'));
      return c.json({ asset });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

mediaAdminRoutes.delete('/:id', requirePermission('media.delete'), async c => {
  try {
    const result = await mediaService.delete(c.get('auth'), c.req.param('id'));
    return c.json(result);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const mediaPublicRoutes = new Hono();

mediaPublicRoutes.get('/file/:bucket/:key{.+}', async c => {
  try {
    const bucket = c.req.param('bucket');
    const key = decodeURIComponent(c.req.param('key'));
    if (bucket !== 'public-media') {
      return c.json(
        { error: { code: 'forbidden', message: 'Private bucket' } },
        403,
      );
    }
    const asset = await mediaService.findAssetByKey(bucket, key);
    if (
      !asset ||
      !mediaAccessPolicy.canDownloadAnonymous(
        asset.accessLevel as 'public' | 'private',
        asset.processingStatus,
      )
    ) {
      return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    }
    const buf = await mediaService.getFileBuffer(bucket, key);
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': asset.mimeType ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const stubDomainRoutes = new Hono<AppEnv>();
stubDomainRoutes.use('*', requireAuth);

stubDomainRoutes.get('/providers', requirePermission('provider.read'), async c => {
  const data = await mediaService.listProviders(c.get('auth'));
  return c.json({ data });
});

stubDomainRoutes.put(
  '/providers/:id/profile-media',
  requirePermission('provider.write'),
  async c => {
    try {
      const { mediaId } = (await c.req.json()) as { mediaId: string };
      await mediaService.attachUsage(c.get('auth'), {
        mediaId,
        entityType: 'PROVIDER',
        entityId: c.req.param('id'),
        usageType: 'PROFILE',
        sortOrder: 0,
      });
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

stubDomainRoutes.get('/products', requirePermission('orders.manage'), async c => {
  const data = await mediaService.listProducts(c.get('auth'));
  return c.json({ data });
});

stubDomainRoutes.put(
  '/products/:id/gallery',
  requirePermission('orders.manage'),
  async c => {
    try {
      const { mediaIds } = (await c.req.json()) as { mediaIds: string[] };
      await mediaService.setGallery(
        c.get('auth'),
        c.req.param('id'),
        mediaIds ?? [],
      );
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

stubDomainRoutes.get('/banners', requirePermission('cms.read'), async c => {
  const data = await mediaService.listBanners(c.get('auth'));
  return c.json({ data });
});

stubDomainRoutes.put(
  '/banners/:id/hero-media',
  requirePermission('cms.write'),
  async c => {
    try {
      const { mediaId } = (await c.req.json()) as { mediaId: string };
      await mediaService.attachUsage(c.get('auth'), {
        mediaId,
        entityType: 'BANNER',
        entityId: c.req.param('id'),
        usageType: 'HERO',
        sortOrder: 0,
      });
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);
