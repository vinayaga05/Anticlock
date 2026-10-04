import { z } from 'zod';

// ============================================================================
// Enums & Base Types
// ============================================================================

export const MessageType = z.enum(['text']);

export const conversationSchema = z.object({
  id: z.string().uuid(),
  lastMessageText: z.string().nullable(),
  lastMessageAt: z.string().datetime().nullable(),
  unreadCount: z.number().int().min(0),
  otherParticipant: z.object({
    id: z.string().uuid(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderId: z.string().uuid(),
  type: MessageType,
  body: z.string(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const participantSchema = z.object({
  conversationId: z.string().uuid(),
  mobileUserId: z.string().uuid(),
  lastReadAt: z.string().datetime().nullable(),
  joinedAt: z.string().datetime(),
});

// ============================================================================
// Request Schemas
// ============================================================================

// List my conversations
export const listConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().uuid().optional(),
});

// Get or create conversation with a user
export const getOrCreateConversationSchema = z.object({
  otherUserId: z.string().uuid(),
});

// List messages in a conversation
export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().uuid().optional(), // message ID to paginate before
});

// Send a message
export const sendMessageSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
});

// Mark conversation as read
export const markConversationReadSchema = z.object({
  conversationId: z.string().uuid(),
});

// Admin: List conversations (moderation)
export const adminListConversationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().uuid().optional(),
  reported: z.coerce.boolean().optional(), // if reports exist
});

// Admin: Get conversation detail
export const adminConversationDetailSchema = z.object({
  conversationId: z.string().uuid(),
});

// ============================================================================
// Response Schemas
// ============================================================================

export const listConversationsResponseSchema = z.object({
  conversations: z.array(conversationSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const conversationDetailResponseSchema = z.object({
  conversation: conversationSchema,
});

export const listMessagesResponseSchema = z.object({
  messages: z.array(messageSchema),
  nextCursor: z.string().uuid().nullable(),
});

export const sendMessageResponseSchema = z.object({
  message: messageSchema,
});

export const markReadResponseSchema = z.object({
  success: z.boolean(),
});

// Admin schemas
export const adminListConversationsResponseSchema = z.object({
  conversations: z.array(
    conversationSchema.extend({
      participants: z.array(
        z.object({
          mobileUserId: z.string().uuid(),
          displayName: z.string(),
          lastReadAt: z.string().datetime().nullable(),
        })
      ),
      messageCount: z.number().int(),
    })
  ),
  nextCursor: z.string().uuid().nullable(),
});

export const adminConversationDetailResponseSchema = z.object({
  conversation: conversationSchema.extend({
    participants: z.array(participantSchema),
    messages: z.array(messageSchema),
  }),
});

// ============================================================================
// Types
// ============================================================================

export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;
export type Participant = z.infer<typeof participantSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type GetOrCreateConversation = z.infer<typeof getOrCreateConversationSchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type SendMessage = z.infer<typeof sendMessageSchema>;
export type MarkConversationRead = z.infer<typeof markConversationReadSchema>;
export type AdminListConversationsQuery = z.infer<typeof adminListConversationsQuerySchema>;
export type AdminConversationDetail = z.infer<typeof adminConversationDetailSchema>;
export type ListConversationsResponse = z.infer<typeof listConversationsResponseSchema>;
export type ConversationDetailResponse = z.infer<typeof conversationDetailResponseSchema>;
export type ListMessagesResponse = z.infer<typeof listMessagesResponseSchema>;
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;
export type MarkReadResponse = z.infer<typeof markReadResponseSchema>;
export type AdminListConversationsResponse = z.infer<typeof adminListConversationsResponseSchema>;
export type AdminConversationDetailResponse = z.infer<typeof adminConversationDetailResponseSchema>;
