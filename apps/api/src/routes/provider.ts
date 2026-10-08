import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { ZodError } from 'zod';
import {
  CreateProviderApplicationRequestSchema,
  MarketplaceProviderListQuerySchema,
  UpdateProviderBusinessRequestSchema,
  ProviderApplicationReviewRequestSchema,
  ProviderFormSchemaBodySchema,
  ProviderKycUploadRequestSchema,
  ResolveFormSchemaQuerySchema,
  SetProviderApplicationServicesRequestSchema,
  UpdateProviderApplicationRequestSchema,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { providerFormSchemas } from '../db/schema.js';
import {
  mapSchemaRow,
  resolveFormSchema,
} from '../provider/FormSchemaService.js';
import { providerApplicationService } from '../provider/ProviderApplicationService.js';
import { providerBusinessService } from '../provider/ProviderBusinessService.js';
import {
  requireAuth,
  requirePermission,
  type AppEnv,
} from '../middleware/auth.js';

function requireMobileAuth(c: { get: (k: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth;
}

function httpError(err: unknown) {
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return {
      status: 400 as const,
      body: {
        error: {
          code: 'validation_error',
          message: issue
            ? `${issue.path.join('.') || 'request'}: ${issue.message}`
            : 'Invalid request',
          details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
        },
      },
    };
  }
  const e = err as { status?: number; code?: string; message?: string; details?: unknown };
  if (!e.status || e.status >= 500) {
    console.error('[provider routes]', err);
  }
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 409 | 410 | 500,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.status && e.status < 500 ? (e.message ?? 'Request failed') : 'Unexpected error',
        ...(e.details ? { details: e.details } : {}),
      },
    },
  };
}

export const providerMobileRoutes = new Hono<AppEnv>();
providerMobileRoutes.use('*', requireAuth);

providerMobileRoutes.get('/applications/me', async c => {
  try {
    const auth = requireMobileAuth(c);
    const application = await providerApplicationService.getMyApplication(auth.sub);
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.get('/applications', async c => {
  try {
    const auth = requireMobileAuth(c);
    const applications = await providerApplicationService.getMyApplications(auth.sub);
    return c.json({ applications });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.get('/applications/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const application = await providerApplicationService.getApplication(
      auth.sub,
      c.req.param('id'),
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.post('/applications', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = CreateProviderApplicationRequestSchema.parse(await c.req.json());
    const application = await providerApplicationService.createApplication(
      auth.sub,
      body,
    );
    return c.json({ application }, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.patch('/applications/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = UpdateProviderApplicationRequestSchema.parse(await c.req.json());
    const application = await providerApplicationService.updateApplication(
      auth.sub,
      c.req.param('id'),
      body,
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.delete('/applications/:id', async c => {
  try {
    const auth = requireMobileAuth(c);
    await providerApplicationService.deleteApplication(
      auth.sub,
      c.req.param('id'),
    );
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.put('/applications/:id/services', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = SetProviderApplicationServicesRequestSchema.parse(
      await c.req.json(),
    );
    const application = await providerApplicationService.setServices(
      auth.sub,
      c.req.param('id'),
      body,
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.post('/applications/:id/reopen', async c => {
  try {
    const auth = requireMobileAuth(c);
    const application = await providerApplicationService.reopenApplication(
      auth.sub,
      c.req.param('id'),
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.delete('/applications/:id/documents/:fieldKey', async c => {
  try {
    const auth = requireMobileAuth(c);
    const application = await providerApplicationService.deleteDocument(
      auth.sub,
      c.req.param('id'),
      decodeURIComponent(c.req.param('fieldKey')),
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.get('/businesses', async c => {
  try {
    const auth = requireMobileAuth(c);
    const businesses = await providerBusinessService.listMyBusinesses(auth.sub);
    return c.json({ businesses });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.get('/businesses/:providerId', async c => {
  try {
    const auth = requireMobileAuth(c);
    const business = await providerBusinessService.getMyBusiness(
      auth.sub,
      c.req.param('providerId'),
    );
    return c.json({ business });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.patch('/businesses/:providerId', async c => {
  try {
    const auth = requireMobileAuth(c);
    const body = UpdateProviderBusinessRequestSchema.parse(await c.req.json());
    const business = await providerBusinessService.updateMyBusiness(
      auth.sub,
      c.req.param('providerId'),
      body,
    );
    return c.json({ business });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.post('/applications/:id/submit', async c => {
  try {
    const auth = requireMobileAuth(c);
    const application = await providerApplicationService.submitApplication(
      auth.sub,
      c.req.param('id'),
    );
    return c.json({ application });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.post('/applications/:id/kyc-upload-session', async c => {
  try {
    const auth = requireMobileAuth(c);
    const raw = (await c.req.json()) as Record<string, unknown>;
    const body = ProviderKycUploadRequestSchema.parse(raw);
    const optionalInt = (v: unknown) =>
      typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : undefined;
    const session = await providerApplicationService.createKycUploadSession(
      auth.sub,
      c.req.param('id'),
      {
        ...body,
        durationMs: optionalInt(raw.durationMs),
        width: optionalInt(raw.width),
        height: optionalInt(raw.height),
      },
    );
    return c.json(session, 201);
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

providerMobileRoutes.post(
  '/applications/:id/kyc-upload-sessions/:sessionId/complete',
  async c => {
    try {
      const auth = requireMobileAuth(c);
      const { fieldKey, purpose } = (await c.req.json()) as {
        fieldKey: string;
        purpose?: string;
      };
      const result = await providerApplicationService.completeKycUpload(
        auth.sub,
        c.req.param('id'),
        c.req.param('sessionId'),
        fieldKey,
        purpose === 'profile' ? 'profile' : 'document',
      );
      return c.json(result);
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

providerMobileRoutes.put(
  '/applications/:id/kyc-upload-sessions/:sessionId/content',
  async c => {
    try {
      const auth = requireMobileAuth(c);
      const applicationId = c.req.param('id');
      const sessionId = c.req.param('sessionId');
      await providerApplicationService.uploadKycLocalContent(
        auth.sub,
        applicationId,
        sessionId,
        Buffer.from(await c.req.arrayBuffer()),
      );
      return c.json({ ok: true });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

providerMobileRoutes.get('/form-schemas/resolve', async c => {
  try {
    const providerKind = c.req.query('providerKind');
    const categoryIdsRaw = c.req.query('categoryIds') ?? '';
    const categoryIds = categoryIdsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    ResolveFormSchemaQuerySchema.parse({ providerKind, categoryIds });
    const schema = await resolveFormSchema(
      providerKind as 'business' | 'individual',
      categoryIds,
    );
    return c.json({ schema });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

export const providerAdminRoutes = new Hono<AppEnv>();
providerAdminRoutes.use('*', requireAuth);

providerAdminRoutes.get(
  '/form-schemas',
  requirePermission('catalog.read'),
  async c => {
    const rows = await db
      .select()
      .from(providerFormSchemas)
      .orderBy(desc(providerFormSchemas.updatedAt));
    return c.json({ data: rows.map(mapSchemaRow) });
  },
);

providerAdminRoutes.get(
  '/form-schemas/:id',
  requirePermission('catalog.read'),
  async c => {
    const [row] = await db
      .select()
      .from(providerFormSchemas)
      .where(eq(providerFormSchemas.id, c.req.param('id')));
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ schema: mapSchemaRow(row) });
  },
);

providerAdminRoutes.post(
  '/form-schemas',
  requirePermission('catalog.write'),
  async c => {
    const body = ProviderFormSchemaBodySchema.parse(await c.req.json());
    const [row] = await db
      .insert(providerFormSchemas)
      .values({
        scope: body.scope,
        categoryId: body.categoryId ?? null,
        providerKinds: body.providerKinds,
        version: body.version,
        status: body.status,
        sections: body.sections,
        fields: body.fields,
      })
      .returning();
    return c.json({ schema: mapSchemaRow(row!) }, 201);
  },
);

providerAdminRoutes.put(
  '/form-schemas/:id',
  requirePermission('catalog.write'),
  async c => {
    const body = ProviderFormSchemaBodySchema.parse(await c.req.json());
    const [row] = await db
      .update(providerFormSchemas)
      .set({
        scope: body.scope,
        categoryId: body.categoryId ?? null,
        providerKinds: body.providerKinds,
        version: body.version,
        status: body.status,
        sections: body.sections,
        fields: body.fields,
        updatedAt: new Date(),
      })
      .where(eq(providerFormSchemas.id, c.req.param('id')))
      .returning();
    if (!row) return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404);
    return c.json({ schema: mapSchemaRow(row) });
  },
);

providerAdminRoutes.get(
  '/applications',
  requirePermission('provider.read'),
  async c => {
    const status = c.req.query('status')?.trim() || undefined;
    const data = await providerApplicationService.listApplicationsAdmin(status);
    return c.json({ data, meta: { nextCursor: null } });
  },
);

providerAdminRoutes.get(
  '/applications/:id',
  requirePermission('provider.read'),
  async c => {
    try {
      const application = await providerApplicationService.getApplicationAdmin(
        c.req.param('id'),
      );
      return c.json({ application });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

providerAdminRoutes.post(
  '/applications/:id/review',
  requirePermission('provider.verify'),
  async c => {
    try {
      const body = ProviderApplicationReviewRequestSchema.parse(await c.req.json());
      const application = await providerApplicationService.reviewApplication(
        c.get('auth'),
        c.req.param('id'),
        body,
      );
      return c.json({ application });
    } catch (err) {
      const { status, body } = httpError(err);
      return c.json(body, status);
    }
  },
);

/** Public marketplace: approved, active businesses only. */
export const marketplaceRoutes = new Hono<AppEnv>();

marketplaceRoutes.get('/providers', async c => {
  try {
    const query = MarketplaceProviderListQuerySchema.parse({
      q: c.req.query('q') || undefined,
      categoryId: c.req.query('categoryId') || undefined,
      treeId: c.req.query('treeId') || undefined,
      city: c.req.query('city') || undefined,
      limit: c.req.query('limit') || undefined,
      offset: c.req.query('offset') || undefined,
    });
    const result = await providerBusinessService.listMarketplaceProviders(query);
    return c.json({ data: result.data, meta: { nextOffset: result.nextOffset } });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

marketplaceRoutes.get('/providers/:id', async c => {
  try {
    const provider = await providerBusinessService.getMarketplaceProvider(c.req.param('id'));
    return c.json({ provider });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});
