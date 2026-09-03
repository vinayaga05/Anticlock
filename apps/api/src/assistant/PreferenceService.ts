import { and, eq, sql } from 'drizzle-orm';
import type { TrackUserBehaviorEvent } from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  userBehaviorEvents,
  userPreferenceScores,
  userPreferenceSettings,
} from '../db/schema.js';
import { sessionStore } from './SessionStore.js';

const HEALTH_ENTITY_PREFIXES = ['health.', 'health'];

function isSensitiveEntity(entityType?: string, entityId?: string) {
  const id = (entityId ?? '').toLowerCase();
  const type = (entityType ?? '').toLowerCase();
  return (
    HEALTH_ENTITY_PREFIXES.some(p => id.startsWith(p) || type.includes('health')) ||
    type === 'health_category'
  );
}

export class PreferenceService {
  async getSettings(userId: string) {
    const rows = await db
      .select()
      .from(userPreferenceSettings)
      .where(eq(userPreferenceSettings.mobileUserId, userId))
      .limit(1);
    return (
      rows[0] ?? {
        mobileUserId: userId,
        personalizationEnabled: true,
        explicitPrefs: {} as Record<string, unknown>,
        updatedAt: new Date(),
      }
    );
  }

  async setPersonalizationEnabled(userId: string, enabled: boolean) {
    await db
      .insert(userPreferenceSettings)
      .values({
        mobileUserId: userId,
        personalizationEnabled: enabled,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferenceSettings.mobileUserId,
        set: {
          personalizationEnabled: enabled,
          updatedAt: new Date(),
        },
      });
    await sessionStore.setPreference(
      userId,
      'personalization_enabled',
      enabled ? '1' : '0',
    );
  }

  async resetPreferences(userId: string) {
    await db
      .delete(userPreferenceScores)
      .where(eq(userPreferenceScores.mobileUserId, userId));
    await db
      .insert(userPreferenceSettings)
      .values({
        mobileUserId: userId,
        personalizationEnabled: true,
        explicitPrefs: {},
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferenceSettings.mobileUserId,
        set: {
          explicitPrefs: {},
          personalizationEnabled: true,
          updatedAt: new Date(),
        },
      });
  }

  async deleteAllUserData(userId: string) {
    await db
      .delete(userBehaviorEvents)
      .where(eq(userBehaviorEvents.mobileUserId, userId));
    await db
      .delete(userPreferenceScores)
      .where(eq(userPreferenceScores.mobileUserId, userId));
    await db
      .delete(userPreferenceSettings)
      .where(eq(userPreferenceSettings.mobileUserId, userId));
  }

  async exportUserData(userId: string) {
    const [settings, scores, events] = await Promise.all([
      this.getSettings(userId),
      db
        .select()
        .from(userPreferenceScores)
        .where(eq(userPreferenceScores.mobileUserId, userId)),
      db
        .select({
          id: userBehaviorEvents.id,
          type: userBehaviorEvents.type,
          entityType: userBehaviorEvents.entityType,
          entityId: userBehaviorEvents.entityId,
          createdAt: userBehaviorEvents.createdAt,
        })
        .from(userBehaviorEvents)
        .where(eq(userBehaviorEvents.mobileUserId, userId))
        .limit(500),
    ]);
    return { settings, scores, events };
  }

  /**
   * Weekly exponential decay: score *= 0.9 for rows older than 7 days.
   */
  async decayScores() {
    await db.execute(sql`
      UPDATE user_preference_scores
      SET score = score * 0.9,
          confidence = GREATEST(0, confidence * 0.95),
          updated_at = now()
      WHERE last_interaction_at < now() - interval '7 days'
        AND score > 0.01
    `);
  }

  async ingestBehavior(userId: string, event: TrackUserBehaviorEvent) {
    const settings = await this.getSettings(userId);
    if (!settings.personalizationEnabled) {
      // Still store the event for export/audit, but skip preference updates.
    }

    if (event.idempotencyKey) {
      const existing = await db
        .select({ id: userBehaviorEvents.id })
        .from(userBehaviorEvents)
        .where(
          and(
            eq(userBehaviorEvents.mobileUserId, userId),
            eq(userBehaviorEvents.idempotencyKey, event.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing[0]) return { deduped: true };
    }

    // Never store precise GPS or raw chat in metadata
    const metadata = { ...(event.metadata ?? {}) };
    delete metadata.lat;
    delete metadata.lng;
    delete metadata.coordinates;
    delete metadata.message;
    delete metadata.chat;

    await db.insert(userBehaviorEvents).values({
      mobileUserId: userId,
      type: event.type,
      entityType: event.entityType,
      entityId: event.entityId,
      metadata,
      idempotencyKey: event.idempotencyKey,
    });

    if (!settings.personalizationEnabled) return { deduped: false };

    // Do not infer sensitive health traits into preference scores.
    if (isSensitiveEntity(event.entityType, event.entityId)) {
      return { deduped: false, sensitiveSkipped: true };
    }

    if (event.entityType && event.entityId) {
      const bump =
        event.type === 'item_hidden'
          ? -0.4
          : event.type === 'content_saved' || event.type === 'booking_intent'
            ? 0.35
            : 0.15;

      await db.execute(sql`
        INSERT INTO user_preference_scores (
          mobile_user_id, entity_type, entity_id, score, confidence, evidence_count,
          last_interaction_at, updated_at
        ) VALUES (
          ${userId}::uuid, ${event.entityType}, ${event.entityId},
          ${bump}, 0.2, 1, now(), now()
        )
        ON CONFLICT (mobile_user_id, entity_type, entity_id)
        DO UPDATE SET
          score = user_preference_scores.score + ${bump},
          confidence = LEAST(1, user_preference_scores.confidence + 0.05),
          evidence_count = user_preference_scores.evidence_count + 1,
          last_interaction_at = now(),
          updated_at = now()
      `);

      await sessionStore.setPreference(
        userId,
        `interest:${event.entityType}:${event.entityId}`,
        String(bump),
      );
    }

    return { deduped: false };
  }

  async purgeOldEvents(retentionDays = 90) {
    await db.execute(sql`
      DELETE FROM user_behavior_events
      WHERE created_at < now() - (${retentionDays}::text || ' days')::interval
    `);
  }
}

export const preferenceService = new PreferenceService();
