import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  AssistantMessageRequestSchema,
  TrackAssistantAnalyticsRequestSchema,
  TrackUserBehaviorEventSchema,
} from '@anticlock/contracts';
import { assistantService } from '../assistant/AssistantService.js';
import { preferenceService } from '../assistant/PreferenceService.js';
import { privacyService } from '../assistant/PrivacyService.js';
import { requireAuth, type AppEnv } from '../middleware/auth.js';

function httpError(err: unknown) {
  if (err && typeof err === 'object' && (err as { name?: string }).name === 'ZodError') {
    const issues = (err as { issues?: Array<{ path?: (string | number)[]; message?: string }> })
      .issues;
    const first = issues?.[0];
    const field = first?.path?.join('.') || 'request';
    return {
      status: 400 as const,
      body: {
        error: {
          code: 'validation_error',
          message: first?.message
            ? `${field}: ${first.message}`
            : 'Invalid request. Please try again.',
        },
      },
    };
  }

  const e = err as { status?: number; code?: string; message?: string };
  const status = (e.status ?? 500) as 400 | 403 | 404 | 409 | 429 | 500;
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

export const assistantRoutes = new Hono<AppEnv>();
assistantRoutes.use('*', requireAuth);

assistantRoutes.post('/chat', async c => {
  try {
    const body = AssistantMessageRequestSchema.parse(await c.req.json());
    const auth = c.get('auth');
    const idempotencyKey = c.req.header('Idempotency-Key')?.trim();
    const clientIp =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    return streamSSE(c, async stream => {
      try {
        for await (const event of assistantService.chat(auth, body, {
          idempotencyKey,
          clientIp,
        })) {
          await stream.writeSSE({ data: JSON.stringify(event) });
        }
      } catch (err) {
        const { body: errorBody } = httpError(err);
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            code: errorBody.error.code,
            message: errorBody.error.message,
          }),
        });
      }
    });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.get('/conversations', async c => {
  try {
    const data = await assistantService.listConversations(c.get('auth'));
    return c.json({
      data: data.map(row => ({
        id: row.id,
        title: row.title,
        status: row.status,
        personaVersion: row.personaVersion,
        currentScreen: row.currentScreen,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        archivedAt: row.archivedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.get('/conversations/export', async c => {
  try {
    const data = await privacyService.exportData(c.get('auth'));
    return c.json({ data, exportedAt: new Date().toISOString() });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.get('/conversations/:id', async c => {
  try {
    const limit = Number(c.req.query('limit') ?? 50);
    const offset = Number(c.req.query('offset') ?? 0);
    const result = await assistantService.getConversation(
      c.get('auth'),
      c.req.param('id'),
      limit,
      offset,
    );
    return c.json({
      conversation: {
        ...result.conversation,
        createdAt: result.conversation.createdAt.toISOString(),
        updatedAt: result.conversation.updatedAt.toISOString(),
        archivedAt: result.conversation.archivedAt?.toISOString() ?? null,
      },
      messages: result.messages.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls,
        toolResults: m.toolResults,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.delete('/conversations/:id', async c => {
  try {
    await privacyService.deleteConversation(c.get('auth'), c.req.param('id'));
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.post('/conversations/:id/clear', async c => {
  try {
    await privacyService.clearSessionBuffer(c.get('auth'), c.req.param('id'));
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.delete('/history', async c => {
  try {
    await privacyService.deleteAllHistory(c.get('auth'));
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.post('/analytics', async c => {
  try {
    const body = TrackAssistantAnalyticsRequestSchema.parse(await c.req.json());
    await assistantService.trackEvent(
      c.get('auth'),
      body.conversationId,
      body.event,
    );
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.post('/behavior-events', async c => {
  try {
    const auth = c.get('auth');
    if (auth.kind !== 'mobile') {
      return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
    }
    const body = TrackUserBehaviorEventSchema.parse(await c.req.json());
    // Non-blocking for clients: await briefly but never throw preference failures hard
    const result = await preferenceService.ingestBehavior(auth.sub, body);
    return c.json({ ok: true, ...result });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.get('/preferences', async c => {
  try {
    const auth = c.get('auth');
    if (auth.kind !== 'mobile') {
      return c.json({ error: { code: 'forbidden', message: 'Mobile session required' } }, 403);
    }
    const settings = await preferenceService.getSettings(auth.sub);
    return c.json({ data: settings });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.put('/preferences/personalization', async c => {
  try {
    const auth = c.get('auth');
    const body = (await c.req.json()) as { enabled?: boolean };
    await privacyService.setPersonalization(auth, Boolean(body.enabled));
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});

assistantRoutes.post('/preferences/reset', async c => {
  try {
    await privacyService.resetPreferences(c.get('auth'));
    return c.json({ ok: true });
  } catch (err) {
    const { status, body } = httpError(err);
    return c.json(body, status);
  }
});
