import type { AssistantAnalyticsEvent } from '@anticlock/contracts';
import type { AuthClaims } from '../lib/auth.js';
import { writeAudit } from '../lib/audit.js';
import { assistantRepository } from './AssistantRepository.js';
import { preferenceService } from './PreferenceService.js';
import { sessionStore } from './SessionStore.js';

export class AnalyticsService {
  track(auth: AuthClaims, conversationId: string | null, event: AssistantAnalyticsEvent) {
    if (auth.kind !== 'mobile') return Promise.resolve();
    return assistantRepository.trackAnalytics(auth.sub, conversationId, event);
  }
}

export const analyticsService = new AnalyticsService();

export class PrivacyService {
  async deleteConversation(auth: AuthClaims, conversationId: string) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }

    await sessionStore.clearConversation(auth.sub, conversationId);
    await assistantRepository.deleteConversation(conversationId, auth.sub);
    await assistantRepository.trackAnalytics(auth.sub, conversationId, {
      type: 'privacy_action',
      action: 'conversation_cleared',
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'assistant.conversation_deleted',
      entityType: 'assistant_conversation',
      entityId: conversationId,
    });
  }

  async deleteAllHistory(auth: AuthClaims) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }

    await sessionStore.deleteAllForUser(auth.sub);
    await assistantRepository.deleteAllConversations(auth.sub);
    await preferenceService.deleteAllUserData(auth.sub);
    await assistantRepository.trackAnalytics(auth.sub, null, {
      type: 'privacy_action',
      action: 'history_deleted',
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'assistant.history_deleted',
      entityType: 'mobile_user',
      entityId: auth.sub,
    });
  }

  async exportData(auth: AuthClaims) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }

    const [conversations, preferences] = await Promise.all([
      assistantRepository.exportConversations(auth.sub),
      preferenceService.exportUserData(auth.sub),
    ]);
    await assistantRepository.trackAnalytics(auth.sub, null, {
      type: 'privacy_action',
      action: 'data_exported',
    });
    return { conversations, preferences };
  }

  async resetPreferences(auth: AuthClaims) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }
    await preferenceService.resetPreferences(auth.sub);
    await assistantRepository.trackAnalytics(auth.sub, null, {
      type: 'privacy_action',
      action: 'preferences_reset',
    });
  }

  async setPersonalization(auth: AuthClaims, enabled: boolean) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }
    await preferenceService.setPersonalizationEnabled(auth.sub, enabled);
    if (!enabled) {
      await assistantRepository.trackAnalytics(auth.sub, null, {
        type: 'privacy_action',
        action: 'personalization_opt_out',
      });
    }
  }

  async clearSessionBuffer(auth: AuthClaims, conversationId: string) {
    if (auth.kind !== 'mobile') {
      throw Object.assign(new Error('A mobile session is required'), {
        code: 'forbidden',
        status: 403,
      });
    }
    await sessionStore.clearConversation(auth.sub, conversationId);
    await assistantRepository.trackAnalytics(auth.sub, conversationId, {
      type: 'privacy_action',
      action: 'conversation_cleared',
    });
  }

  async runExpiryJob() {
    await assistantRepository.archiveStaleConversations(90);
    await preferenceService.purgeOldEvents(90);
    await preferenceService.decayScores();
  }
}

export const privacyService = new PrivacyService();

// Background lifecycle job — runs hourly when API starts in production.
let expiryTimer: ReturnType<typeof setInterval> | null = null;

export function startAssistantLifecycleJob() {
  if (expiryTimer) return;
  const run = () => {
    privacyService.runExpiryJob().catch(err => {
      console.error('assistant lifecycle job failed', err);
    });
  };
  run();
  expiryTimer = setInterval(run, 60 * 60 * 1000);
}
