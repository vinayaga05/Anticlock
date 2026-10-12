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

// ============================================================================
// Types
// ============================================================================

export type StreamTokenResponse = z.infer<typeof streamTokenResponseSchema>;
export type CreateChannelRequest = z.infer<typeof createChannelRequestSchema>;
export type CreateChannelResponse = z.infer<typeof createChannelResponseSchema>;
