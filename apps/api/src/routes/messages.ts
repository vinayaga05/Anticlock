import { Hono } from 'hono';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { getStreamClient, isStreamConfigured } from '../lib/stream.js';
import { StreamChatService } from '../messages/StreamChatService.js';
import {
  createChannelRequestSchema,
  createChannelResponseSchema,
  streamTokenResponseSchema,
} from '@anticlock/contracts';

const messagesRoutes = new Hono<AppEnv>();

// Helper to require mobile auth
function requireMobileAuth(c: { get: (k: 'auth') => { kind: string; sub: string } }) {
  const auth = c.get('auth');
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth.sub;
}

// POST /v1/messages/token - Get Stream Chat token
messagesRoutes.post('/token', requireAuth, async (c) => {
  const userId = requireMobileAuth(c);
  
  if (!isStreamConfigured()) {
    return c.json(
      { error: { code: 'stream_not_configured', message: 'Stream Chat is not configured' } },
      503
    );
  }

  const streamClient = getStreamClient();
  const service = new StreamChatService(streamClient);

  try {
    const token = await service.createUserToken(userId);
    const apiKey = process.env.STREAM_API_KEY!;

    const response = streamTokenResponseSchema.parse({
      apiKey,
      userId,
      token,
    });

    return c.json(response);
  } catch (error) {
    console.error('Stream token error:', error);
    return c.json(
      { error: { code: 'token_generation_failed', message: 'Failed to generate Stream token' } },
      500
    );
  }
});

// POST /v1/messages/channels - Create or get 1:1 channel
messagesRoutes.post('/channels', requireAuth, async (c) => {
  const userId = requireMobileAuth(c);
  
  if (!isStreamConfigured()) {
    return c.json(
      { error: { code: 'stream_not_configured', message: 'Stream Chat is not configured' } },
      503
    );
  }

  const body = await c.req.json();
  
  const parsed = createChannelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid request', details: parsed.error } },
      400
    );
  }

  const { otherUserId } = parsed.data;
  const streamClient = getStreamClient();
  const service = new StreamChatService(streamClient);

  try {
    const channelId = await service.createOrGetChannel(userId, otherUserId);

    const response = createChannelResponseSchema.parse({
      channelId,
    });

    return c.json(response);
  } catch (error: any) {
    console.error('Stream channel error:', error);
    
    if (error.message === 'Cannot create conversation with yourself') {
      return c.json(
        { error: { code: 'self_chat_not_allowed', message: error.message } },
        400
      );
    }
    
    if (error.message === 'Other user not found') {
      return c.json(
        { error: { code: 'user_not_found', message: error.message } },
        404
      );
    }

    return c.json(
      { error: { code: 'channel_creation_failed', message: 'Failed to create channel' } },
      500
    );
  }
});

export { messagesRoutes };
