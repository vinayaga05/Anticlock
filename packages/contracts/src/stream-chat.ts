import { z } from 'zod';

// ============================================================================
// Stream Chat Integration
// ============================================================================

// POST /v1/messages/token - Get Stream Chat token
export const streamTokenResponseSchema = z.object({
  apiKey: z.string(),
  userId: z.string(),
  token: z.string(),
});

// POST /v1/messages/channels - Create or get 1:1 channel
export const createChannelRequestSchema = z.object({
  otherProfile: z.object({
    id: z.string().uuid(),
    type: z.enum(['personal', 'business']),
  }),
  viewerProfile: z.object({
    id: z.string().uuid(),
    type: z.enum(['personal', 'business']),
  }),
});

export const createChannelResponseSchema = z.object({
  channelId: z.string(),
  profile: z.object({
    id: z.string().uuid(),
    type: z.enum(['personal', 'business']),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    verified: z.boolean(),
  }),
});

const publisherRefSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['personal', 'business']),
});

export const reportConversationRequestSchema = z.object({
  viewerProfile: publisherRefSchema,
  otherProfile: publisherRefSchema,
  reason: z.enum(['spam', 'harassment', 'impersonation', 'unsafe', 'other']),
  details: z.string().trim().max(1000).optional(),
});

// POST /v1/messages/calls - authorize and create a 1:1 Stream call
export const createCallRequestSchema = z.object({
  otherProfile: publisherRefSchema,
  viewerProfile: publisherRefSchema,
  mode: z.enum(['audio', 'video']),
  bookingId: z.string().uuid().optional(),
});

export const createCallResponseSchema = z.object({
  callId: z.string().uuid(),
  callType: z.literal('default'),
  mode: z.enum(['audio', 'video']),
  targetUserId: z.string().uuid(),
  profile: z.object({
    id: z.string().uuid(),
    type: z.enum(['personal', 'business']),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    verified: z.boolean(),
  }),
});

// ============================================================================
// Types
// ============================================================================

export type StreamTokenResponse = z.infer<typeof streamTokenResponseSchema>;
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;
export type CreateChannelResponse = z.infer<typeof createChannelResponseSchema>;
export type ReportConversationRequest = z.infer<typeof reportConversationRequestSchema>;
export type CreateCallRequest = z.infer<typeof createCallRequestSchema>;
export type CreateCallResponse = z.infer<typeof createCallResponseSchema>;
