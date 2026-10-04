import { db } from '../db/client.js';
import {
  conversations,
  conversationParticipants,
  messages,
  mobileUsers,
} from '../db/schema.js';
import { eq, and, desc, sql, lt, inArray } from 'drizzle-orm';
import type {
  Conversation,
  Message,
  ListConversationsQuery,
  GetOrCreateConversation,
  ListMessagesQuery,
  SendMessage,
} from '@anticlock/contracts';

export class MessageService {
  /**
   * Get or create a 1:1 conversation between two users.
   * Returns existing conversation if it exists.
   */
  async getOrCreateConversation(
    userId: string,
    otherUserId: string
  ): Promise<{ conversationId: string; isNew: boolean }> {
    if (userId === otherUserId) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Check if conversation exists
    const existing = await db
      .select({ conversationId: conversationParticipants.conversationId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.mobileUserId, userId))
      .innerJoin(
        conversationParticipants as any,
        and(
          eq(conversationParticipants.conversationId, (conversationParticipants as any).conversationId),
          eq((conversationParticipants as any).mobileUserId, otherUserId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return { conversationId: existing[0].conversationId, isNew: false };
    }

    // Create new conversation with both participants
    const [conv] = await db
      .insert(conversations)
      .values({
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: conversations.id });

    await db.insert(conversationParticipants).values([
      {
        conversationId: conv.id,
        mobileUserId: userId,
        joinedAt: new Date(),
      },
      {
        conversationId: conv.id,
        mobileUserId: otherUserId,
        joinedAt: new Date(),
      },
    ]);

    return { conversationId: conv.id, isNew: true };
  }

  /**
   * List conversations for a user with pagination.
   */
  async listConversations(
    userId: string,
    query: ListConversationsQuery
  ): Promise<{ conversations: Conversation[]; nextCursor: string | null }> {
    const limit = query.limit ?? 20;

    // Get conversations where user is a participant
    const userConvs = await db
      .select({
        conversationId: conversationParticipants.conversationId,
        lastMessageAt: conversations.lastMessageAt,
        lastMessageText: conversations.lastMessageText,
        conversationCreatedAt: conversations.createdAt,
        conversationUpdatedAt: conversations.updatedAt,
        otherUserId: sql<string>`(
          SELECT mobile_user_id 
          FROM ${conversationParticipants} cp2 
          WHERE cp2.conversation_id = ${conversationParticipants.conversationId} 
            AND cp2.mobile_user_id != ${userId}
          LIMIT 1
        )`,
        otherDisplayName: sql<string>`(
          SELECT display_name 
          FROM ${mobileUsers} mu 
          WHERE mu.id = (
            SELECT mobile_user_id 
            FROM ${conversationParticipants} cp2 
            WHERE cp2.conversation_id = ${conversationParticipants.conversationId} 
              AND cp2.mobile_user_id != ${userId}
            LIMIT 1
          )
        )`,
        otherAvatarUrl: sql<string | null>`(
          SELECT avatar_url 
          FROM ${mobileUsers} mu 
          WHERE mu.id = (
            SELECT mobile_user_id 
            FROM ${conversationParticipants} cp2 
            WHERE cp2.conversation_id = ${conversationParticipants.conversationId} 
              AND cp2.mobile_user_id != ${userId}
            LIMIT 1
          )
        )`,
        userLastReadAt: conversationParticipants.lastReadAt,
      })
      .from(conversationParticipants)
      .innerJoin(
        conversations,
        eq(conversationParticipants.conversationId, conversations.id)
      )
      .where(
        and(
          eq(conversationParticipants.mobileUserId, userId),
          query.cursor
            ? lt(conversations.lastMessageAt, new Date(query.cursor))
            : undefined
        )
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit + 1);

    const hasMore = userConvs.length > limit;
    const items = hasMore ? userConvs.slice(0, limit) : userConvs;

    // Calculate unread counts
    const conversationIds = items.map(c => c.conversationId);
    const unreadCounts = conversationIds.length > 0
      ? await db
          .select({
            conversationId: messages.conversationId,
            count: sql<number>`COUNT(*)::int`,
          })
          .from(messages)
          .where(
            and(
              inArray(messages.conversationId, conversationIds),
              sql`${messages.createdAt} > COALESCE((
                SELECT last_read_at 
                FROM ${conversationParticipants} 
                WHERE conversation_id = ${messages.conversationId} 
                  AND mobile_user_id = ${userId}
              ), '1970-01-01'::timestamptz)`
            )
          )
          .groupBy(messages.conversationId)
      : [];

    const unreadMap = new Map(
      unreadCounts.map(u => [u.conversationId, u.count])
    );

    const result: Conversation[] = items.map(c => ({
      id: c.conversationId,
      lastMessageText: c.lastMessageText ?? null,
      lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
      unreadCount: unreadMap.get(c.conversationId) ?? 0,
      otherParticipant: {
        id: c.otherUserId,
        displayName: c.otherDisplayName,
        avatarUrl: c.otherAvatarUrl,
      },
      createdAt: c.conversationCreatedAt.toISOString(),
      updatedAt: c.conversationUpdatedAt.toISOString(),
    }));

    return {
      conversations: result,
      nextCursor: hasMore ? items[items.length - 1].lastMessageAt?.toISOString() ?? null : null,
    };
  }

  /**
   * List messages in a conversation with pagination (cursor = message ID).
   */
  async listMessages(
    conversationId: string,
    userId: string,
    query: ListMessagesQuery
  ): Promise<{ messages: Message[]; nextCursor: string | null }> {
    // Verify user is participant
    const participant = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.mobileUserId, userId)
        )
      )
      .limit(1);

    if (participant.length === 0) {
      throw new Error('Not authorized to view this conversation');
    }

    const limit = query.limit ?? 50;

    const msgs = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          query.cursor ? lt(messages.id, query.cursor) : undefined
        )
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit + 1);

    const hasMore = msgs.length > limit;
    const items = hasMore ? msgs.slice(0, limit) : msgs;

    return {
      messages: items.map(m => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        type: m.type as 'text',
        body: m.body,
        readAt: m.readAt?.toISOString() ?? null,
        createdAt: m.createdAt.toISOString(),
      })),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  /**
   * Send a message in a conversation.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    data: SendMessage
  ): Promise<Message> {
    // Verify sender is participant
    const participant = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.mobileUserId, senderId)
        )
      )
      .limit(1);

    if (participant.length === 0) {
      throw new Error('Not authorized to send message in this conversation');
    }

    // Validate message body
    if (data.body.length === 0) {
      throw new Error('Message body cannot be empty');
    }
    if (data.body.length > 5000) {
      throw new Error('Message body too long (max 5000 characters)');
    }

    // Insert message
    const [message] = await db
      .insert(messages)
      .values({
        conversationId,
        senderId,
        type: 'text',
        body: data.body,
        createdAt: new Date(),
      })
      .returning();

    // Update conversation last message
    await db
      .update(conversations)
      .set({
        lastMessageText: data.body,
        lastMessageAt: message.createdAt,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      type: message.type as 'text',
      body: message.body,
      readAt: message.readAt?.toISOString() ?? null,
      createdAt: message.createdAt.toISOString(),
    };
  }

  /**
   * Mark all messages in a conversation as read by a user.
   */
  async markConversationRead(
    conversationId: string,
    userId: string
  ): Promise<void> {
    const now = new Date();

    // Update last_read_at for the participant
    await db
      .update(conversationParticipants)
      .set({ lastReadAt: now })
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.mobileUserId, userId)
        )
      );
  }

  /**
   * Check if a user is a participant in a conversation.
   */
  async isParticipant(conversationId: string, userId: string): Promise<boolean> {
    const participant = await db
      .select()
      .from(conversationParticipants)
      .where(
        and(
          eq(conversationParticipants.conversationId, conversationId),
          eq(conversationParticipants.mobileUserId, userId)
        )
      )
      .limit(1);

    return participant.length > 0;
  }

  /**
   * Get all participant IDs in a conversation (for broadcasting).
   */
  async getParticipantIds(conversationId: string): Promise<string[]> {
    const participants = await db
      .select({ userId: conversationParticipants.mobileUserId })
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, conversationId));

    return participants.map(p => p.userId);
  }

  /**
   * Get unread count for a user in a conversation.
   */
  async getUnreadCount(conversationId: string, userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          sql`${messages.createdAt} > COALESCE((
            SELECT last_read_at 
            FROM ${conversationParticipants} 
            WHERE conversation_id = ${conversationId} 
              AND mobile_user_id = ${userId}
          ), '1970-01-01'::timestamptz)`
        )
      );

    return result?.count ?? 0;
  }
}

export const messageService = new MessageService();
