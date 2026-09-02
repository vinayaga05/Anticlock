import type { AssistantResultCard } from '@anticlock/contracts';
import { getRedis } from '../lib/redis.js';

const SESSION_TTL_SEC = 30 * 60;
const PREFS_TTL_SEC = 90 * 24 * 60 * 60;
const MAX_MESSAGES = 8;
const MAX_ACTIONS = 5;

export type SessionMessage = {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
};

export type AssistantSession = {
  conversationId: string;
  currentScreen?: string;
  personaVersion: string;
  lastResponseId?: string;
  recentActions: string[];
};

function sessionKey(userId: string, conversationId: string) {
  return `session:${userId}:${conversationId}`;
}

function messagesKey(userId: string, conversationId: string) {
  return `session:${userId}:${conversationId}:messages`;
}

function actionsKey(userId: string, conversationId: string) {
  return `session:${userId}:${conversationId}:actions`;
}

function prefsKey(userId: string) {
  return `session:${userId}:prefs`;
}

export class SessionStore {
  private redis = getRedis();

  private async ensureConnected() {
    if (this.redis.status !== 'ready') await this.redis.connect();
  }

  async getSession(
    userId: string,
    conversationId: string,
  ): Promise<AssistantSession | null> {
    await this.ensureConnected();
    const data = await this.redis.hgetall(sessionKey(userId, conversationId));
    if (!data || !data.conversationId) return null;

    const actions = await this.redis.lrange(
      actionsKey(userId, conversationId),
      0,
      MAX_ACTIONS - 1,
    );

    return {
      conversationId: data.conversationId,
      currentScreen: data.currentScreen || undefined,
      personaVersion: data.personaVersion || '1',
      lastResponseId: data.lastResponseId || undefined,
      recentActions: actions,
    };
  }

  async upsertSession(
    userId: string,
    conversationId: string,
    patch: Partial<AssistantSession>,
  ): Promise<AssistantSession> {
    await this.ensureConnected();
    const key = sessionKey(userId, conversationId);
    const existing = (await this.getSession(userId, conversationId)) ?? {
      conversationId,
      personaVersion: process.env.ASSISTANT_PERSONA_VERSION ?? '1',
      recentActions: [],
    };

    const next: AssistantSession = { ...existing, ...patch, conversationId };
    await this.redis.hset(key, {
      conversationId: next.conversationId,
      personaVersion: next.personaVersion,
      ...(next.currentScreen ? { currentScreen: next.currentScreen } : {}),
      ...(next.lastResponseId ? { lastResponseId: next.lastResponseId } : {}),
    });
    await this.redis.expire(key, SESSION_TTL_SEC);
    await this.redis.expire(messagesKey(userId, conversationId), SESSION_TTL_SEC);
    await this.redis.expire(actionsKey(userId, conversationId), SESSION_TTL_SEC);
    return next;
  }

  async appendMessage(
    userId: string,
    conversationId: string,
    message: SessionMessage,
  ): Promise<void> {
    await this.ensureConnected();
    const key = messagesKey(userId, conversationId);
    await this.redis.lpush(key, JSON.stringify(message));
    await this.redis.ltrim(key, 0, MAX_MESSAGES - 1);
    await this.redis.expire(key, SESSION_TTL_SEC);
  }

  async getMessages(
    userId: string,
    conversationId: string,
  ): Promise<SessionMessage[]> {
    await this.ensureConnected();
    const raw = await this.redis.lrange(
      messagesKey(userId, conversationId),
      0,
      MAX_MESSAGES - 1,
    );
    return raw
      .map(r => {
        try {
          return JSON.parse(r) as SessionMessage;
        } catch {
          return null;
        }
      })
      .filter((m): m is SessionMessage => m !== null)
      .reverse();
  }

  async appendAction(
    userId: string,
    conversationId: string,
    action: string,
  ): Promise<void> {
    await this.ensureConnected();
    const key = actionsKey(userId, conversationId);
    await this.redis.lpush(key, action);
    await this.redis.ltrim(key, 0, MAX_ACTIONS - 1);
    await this.redis.expire(key, SESSION_TTL_SEC);
  }

  async getPreferences(userId: string): Promise<Record<string, string>> {
    await this.ensureConnected();
    return this.redis.hgetall(prefsKey(userId));
  }

  async setPreference(
    userId: string,
    key: string,
    value: string,
  ): Promise<void> {
    await this.ensureConnected();
    const pKey = prefsKey(userId);
    await this.redis.hset(pKey, key, value);
    await this.redis.expire(pKey, PREFS_TTL_SEC);
  }

  async clearConversation(userId: string, conversationId: string): Promise<void> {
    await this.ensureConnected();
    await this.redis.del(
      sessionKey(userId, conversationId),
      messagesKey(userId, conversationId),
      actionsKey(userId, conversationId),
    );
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.ensureConnected();
    const keys = await this.redis.keys(`session:${userId}:*`);
    if (keys.length) await this.redis.del(...keys);
    await this.redis.del(prefsKey(userId));
  }

  async checkRateLimit(userId: string, limit = 30, windowSec = 60): Promise<boolean> {
    await this.ensureConnected();
    const key = `ratelimit:assistant:${userId}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSec);
    return count <= limit;
  }

  async checkIpRateLimit(ip: string, limit = 60, windowSec = 60): Promise<boolean> {
    await this.ensureConnected();
    const key = `ratelimit:assistant:ip:${ip}`;
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, windowSec);
    return count <= limit;
  }

  async claimIdempotencyKey(
    userId: string,
    key: string,
    ttlSec = 300,
  ): Promise<boolean> {
    await this.ensureConnected();
    const redisKey = `idempotency:assistant:${userId}:${key}`;
    const result = await this.redis.set(redisKey, '1', 'EX', ttlSec, 'NX');
    return result === 'OK';
  }
}

export const sessionStore = new SessionStore();

export type { AssistantResultCard };
