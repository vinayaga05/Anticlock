import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import {
  CreateProviderApplicationRequestSchema,
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
  const e = err as { status?: number; code?: string; message?: string };
  return {
    status: (e.status ?? 500) as 400 | 403 | 404 | 409 | 500,
    body: {
      error: {
        code: e.code ?? 'error',
        message: e.message ?? 'Unexpected error',
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
    const body = ProviderKycUploadRequestSchema.parse(await c.req.json());
    const session = await providerApplicationService.createKycUploadSession(
      auth.sub,
      c.req.param('id'),
      body,
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
      const { fieldKey } = (await c.req.json()) as { fieldKey: string };
      const result = await providerApplicationService.completeKycUpload(
        auth.sub,
        c.req.param('id'),
        c.req.param('sessionId'),
        fieldKey,
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
    const data = await providerApplicationService.listApplicationsAdmin();
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
