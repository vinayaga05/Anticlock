import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { requireAuth, type AppEnv } from '../middleware/auth.js';
import { getStreamClient, getStreamServerClient, isStreamConfigured } from '../lib/stream.js';
import { StreamChatService } from '../messages/StreamChatService.js';
import {
  createChannelRequestSchema,
  createChannelResponseSchema,
  createCallRequestSchema,
  createCallResponseSchema,
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
    const user = await service.syncUser(userId);
    const serverClient = getStreamServerClient();
    await serverClient.upsertUsers([{
      id: user.id,
      name: user.displayName,
      image: user.avatarUrl || undefined,
    }]);
    const token = serverClient.generateUserToken({
      user_id: userId,
      validity_in_seconds: 60 * 60,
    });
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

// POST /v1/messages/calls - authorize and prepare a 1:1 audio/video call
messagesRoutes.post('/calls', requireAuth, async (c) => {
  const userId = requireMobileAuth(c);
  if (!isStreamConfigured()) {
    return c.json(
      { error: { code: 'stream_not_configured', message: 'Stream calls are not configured' } },
      503,
    );
  }

  const parsed = createCallRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid call request', details: parsed.error } },
      400,
    );
  }

  try {
    const { otherProfile, viewerProfile, mode } = parsed.data;
    const viewer = await resolveOwnedPublisher(userId, viewerProfile);
    const target = { id: otherProfile.id, type: otherProfile.type } as const;
    const targetProfile = await loadPublisher(target);
    if (!targetProfile) {
      return c.json({ error: { code: 'not_found', message: 'Profile unavailable' } }, 404);
    }
    const targetPrivacy = await getProfilePrivacy(target);
    if (targetPrivacy.ownerUserId === userId) {
      return c.json(
        { error: { code: 'self_call_not_allowed', message: 'You cannot call yourself' } },
        400,
      );
    }
    if (await profilesAreBlocked(viewer.ref, target)) {
      return c.json({ error: { code: 'profile_blocked', message: 'Call unavailable' } }, 403);
    }
    if (targetPrivacy.isPrivate && !(await hasAcceptedFollow(viewer.ref, target))) {
      return c.json(
        { error: { code: 'private_profile', message: 'Follow this private profile before calling' } },
        403,
      );
    }

    const callId = randomUUID();
    const serverClient = getStreamServerClient();
    await serverClient.upsertUsers([
      {
        id: userId,
        name: viewer.publisher.displayName,
        image: viewer.publisher.avatarUrl || undefined,
      },
      {
        id: targetPrivacy.ownerUserId,
        name: targetProfile.displayName,
        image: targetProfile.avatarUrl || undefined,
      },
    ]);
    await serverClient.video.call('default', callId).getOrCreate({
      video: mode === 'video',
      data: {
        created_by_id: userId,
        members: [
          { user_id: userId },
          { user_id: targetPrivacy.ownerUserId },
        ],
        custom: {
          mode,
          caller_name: viewer.publisher.displayName,
          caller_avatar: viewer.publisher.avatarUrl,
          callee_name: targetProfile.displayName,
          callee_avatar: targetProfile.avatarUrl,
        },
      },
    });

    return c.json(createCallResponseSchema.parse({
      callId,
      callType: 'default',
      mode,
      targetUserId: targetPrivacy.ownerUserId,
      profile: targetProfile,
    }));
  } catch (error: any) {
    console.error('Stream call error:', error);
    if (typeof error?.status === 'number' && error.status >= 400 && error.status < 500) {
      return c.json(
        { error: { code: error.code ?? 'call_unavailable', message: error.message ?? 'Call unavailable' } },
        error.status as 400 | 401 | 403 | 404 | 409 | 422,
      );
    }
    return c.json(
      { error: { code: 'call_creation_failed', message: 'Failed to start call' } },
      500,
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
