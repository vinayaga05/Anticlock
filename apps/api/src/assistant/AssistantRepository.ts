import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  assistantAnalyticsEvents,
  assistantConversations,
  assistantMessages,
} from '../db/schema.js';
import type { AssistantAnalyticsEvent } from '@anticlock/contracts';

export class AssistantRepository {
  async createConversation(mobileUserId: string, currentScreen?: string) {
    const personaVersion = process.env.ASSISTANT_PERSONA_VERSION ?? '1';
    const [row] = await db
      .insert(assistantConversations)
      .values({
        mobileUserId,
        personaVersion,
        currentScreen: currentScreen ?? null,
        title: 'New conversation',
      })
      .returning();
    return row;
  }

  async getConversation(id: string, mobileUserId: string) {
    const [row] = await db
      .select()
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.id, id),
          eq(assistantConversations.mobileUserId, mobileUserId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listConversations(mobileUserId: string, limit = 20) {
    return db
      .select()
      .from(assistantConversations)
      .where(
        and(
          eq(assistantConversations.mobileUserId, mobileUserId),
          eq(assistantConversations.status, 'active'),
        ),
      )
      .orderBy(desc(assistantConversations.updatedAt))
      .limit(limit);
  }

  async updateConversation(
    id: string,
    patch: Partial<{
      title: string;
      lastResponseId: string | null;
      currentScreen: string | null;
      status: string;
      archivedAt: Date | null;
      metadata: Record<string, unknown>;
    }>,
  ) {
    const [row] = await db
      .update(assistantConversations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(assistantConversations.id, id))
      .returning();
    return row;
  }

  async insertMessage(input: {
    conversationId: string;
    role: string;
    content?: string | null;
    toolCalls?: unknown[] | null;
    toolResults?: unknown[] | null;
  }) {
    const [row] = await db
      .insert(assistantMessages)
      .values({
        conversationId: input.conversationId,
        role: input.role,
        content: input.content ?? null,
        toolCalls: input.toolCalls ?? null,
        toolResults: input.toolResults ?? null,
      })
      .returning();
    return row;
  }

  async listMessages(conversationId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(asc(assistantMessages.createdAt))
      .limit(limit)
      .offset(offset);
  }

  /** Latest N messages in chronological order (for model context). */
  async listRecentMessages(conversationId: string, limit = 50) {
    const rows = await db
      .select()
      .from(assistantMessages)
      .where(eq(assistantMessages.conversationId, conversationId))
      .orderBy(desc(assistantMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async deleteConversation(id: string, mobileUserId: string) {
    await db
      .delete(assistantConversations)
      .where(
        and(
          eq(assistantConversations.id, id),
          eq(assistantConversations.mobileUserId, mobileUserId),
        ),
      );
  }

  async deleteAllConversations(mobileUserId: string) {
    await db
      .delete(assistantConversations)
      .where(eq(assistantConversations.mobileUserId, mobileUserId));
  }

  async exportConversations(mobileUserId: string) {
    const conversations = await db
      .select()
      .from(assistantConversations)
      .where(eq(assistantConversations.mobileUserId, mobileUserId))
      .orderBy(desc(assistantConversations.createdAt));

    const result = [];
    for (const conv of conversations) {
      const messages = await this.listMessages(conv.id, 500);
      result.push({ conversation: conv, messages });
    }
    return result;
  }

  async archiveStaleConversations(days = 90) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    await db
      .update(assistantConversations)
      .set({ status: 'archived', archivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(assistantConversations.status, 'active'),
          sql`${assistantConversations.updatedAt} < ${cutoff}`,
        ),
      );
  }

  async trackAnalytics(
    mobileUserId: string,
    conversationId: string | null,
    event: AssistantAnalyticsEvent,
  ) {
    await db.insert(assistantAnalyticsEvents).values({
      mobileUserId,
      conversationId,
      type: event.type,
      payload: event as Record<string, unknown>,
    });
  }

  /**
   * Server-owned run diagnostics. This intentionally bypasses the shared
   * client analytics contract so mobile clients cannot forge trace events.
   */
  async trackServerTrace(
    mobileUserId: string,
    conversationId: string | null,
    type: string,
    payload: Record<string, unknown>,
  ) {
    await db.insert(assistantAnalyticsEvents).values({
      mobileUserId,
      conversationId,
      type,
      payload,
    });
  }
}

export const assistantRepository = new AssistantRepository();
