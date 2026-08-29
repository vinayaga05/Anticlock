import { apiRequest, getApiToken } from './client';
import { isApiEnabled } from './config';

export type ReelAnalyticsEvent = {
  eventType: 'view';
  watchedMs: number;
  completed: boolean;
  sessionId?: string;
};

/**
 * React Native does not guarantee `crypto.randomUUID()` on every supported
 * runtime. This RFC 4122 v4-compatible identifier lets the API deduplicate a
 * best-effort event without making telemetry part of playback.
 */
export function createAnalyticsEventId() {
  const hex = (length: number) => {
    let value = '';
    for (let index = 0; index < length; index += 1) {
      value += Math.floor(Math.random() * 16).toString(16);
    }
    return value;
  };

  const variant = ['8', '9', 'a', 'b'][Math.floor(Math.random() * 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

/**
 * Send a non-critical mobile Reel view/completion event. Guests and local
 * mock builds intentionally do nothing, and a network/API failure never
 * reaches the player or changes a Reel's publication status.
 */
export async function recordReelAnalyticsEvent(
  reelId: string,
  event: ReelAnalyticsEvent,
): Promise<boolean> {
  if (!isApiEnabled || !getApiToken()) return false;

  try {
    await apiRequest(
      `/v1/reels/${encodeURIComponent(reelId)}/analytics-events`,
      {
        method: 'POST',
        body: JSON.stringify({
          eventId: createAnalyticsEventId(),
          eventType: 'view',
          watchedMs: Math.max(0, Math.round(event.watchedMs)),
          completed: event.completed,
          ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        }),
      },
    );
    return true;
  } catch {
    return false;
  }
}
