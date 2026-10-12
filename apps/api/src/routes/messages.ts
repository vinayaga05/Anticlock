import { Hono } from 'hono';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { getStreamClient, isStreamConfigured } from '../lib/stream.js';
import { StreamChatService } from '../messages/StreamChatService.js';
import {
  createChannelRequestSchema,
  createChannelResponseSchema,
  streamTokenResponseSchema,
} from '@anticlock/contracts';
import {
  getProfilePrivacy,
  hasAcceptedFollow,
  profilesAreBlocked,
} from '../social/ProfileFollowService.js';
import { loadPublisher, resolveOwnedPublisher } from '../publishing/publisher.js';

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

  const { otherProfile, viewerProfile } = parsed.data;
  const streamClient = getStreamClient();
  const service = new StreamChatService(streamClient);

  try {
    const viewer = await resolveOwnedPublisher(userId, viewerProfile);
    const target = { id: otherProfile.id, type: otherProfile.type } as const;
    const targetProfile = await loadPublisher(target);
    if (!targetProfile) {
      return c.json({ error: { code: 'not_found', message: 'Profile unavailable' } }, 404);
    }
    const targetPrivacy = await getProfilePrivacy(target);
    if (await profilesAreBlocked(viewer.ref, target)) {
      return c.json(
        { error: { code: 'profile_blocked', message: 'Conversation unavailable' } },
        403,
      );
    }
    // Messaging policy: public profiles may be messaged; private profiles
    // require an accepted follow. A pending request does not grant access.
    if (targetPrivacy.isPrivate && !(await hasAcceptedFollow(viewer.ref, target))) {
      return c.json(
        { error: { code: 'private_profile', message: 'Follow this private profile before messaging' } },
        403,
      );
    }
    const channelId = await service.createOrGetProfileChannel({
      viewerUserId: userId,
      targetUserId: targetPrivacy.ownerUserId,
      viewerProfile: {
        id: viewer.ref.id,
        type: viewer.ref.type,
        name: viewer.publisher.displayName,
        image: viewer.publisher.avatarUrl,
      },
      targetProfile: {
        id: target.id,
        type: target.type,
        name: targetProfile.displayName,
        image: targetProfile.avatarUrl,
      },
    });

    const response = createChannelResponseSchema.parse({
      channelId,
      profile: targetProfile,
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

    if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
      return c.json(
        { error: { code: error.code ?? 'conversation_unavailable', message: error.message ?? 'Conversation unavailable' } },
        error.status as 400 | 401 | 403 | 404 | 409 | 422,
      );
    }

    return c.json(
      { error: { code: 'channel_creation_failed', message: 'Failed to create channel' } },
      500
    );
  }
});

export { messagesRoutes };
