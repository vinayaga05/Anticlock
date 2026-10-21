import { AppState, type AppStateStatus } from 'react-native';
import { getApiToken } from '@/shared/api/client';
import { getApiBaseUrl, isApiEnabled } from '@/shared/api/config';
import { readStoredSession } from '@/shared/services/auth/authService';
import { backoffDelay, parseSseChunk } from './liveClipMerge';

/**
 * One shared live connection to GET /v1/content/stream.
 *
 * - Server-Sent Events over XMLHttpRequest (RN fetch has no streaming body).
 * - Reconnects with exponential backoff and jitter; a silent connection
 *   (no heartbeat for 70s) is treated as dead.
 * - Disconnects in the background and reconnects on foreground.
 * - Every (re)connect and foreground emits `resync`, so screens fetch what
 *   they missed with `?since=`. After repeated failures it also emits
 *   `resync` on a timer, which acts as a polling fallback.
 */
export type LiveContentEvent =
  | {
      type: 'post.published';
      id: string;
      format: string;
      publisherProfileType: string;
      publisherProfileId: string;
      item: unknown;
    }
  | {
      type: 'post.removed';
      id: string;
      format: string;
      publisherProfileType: string;
      publisherProfileId: string;
    }
  | { type: 'resync' };

type Listener = (event: LiveContentEvent) => void;

const SILENCE_LIMIT_MS = 70_000;
const POLL_FALLBACK_MS = 30_000;
const FAILURES_BEFORE_POLL = 3;

const listeners = new Set<Listener>();
let users = 0;
let xhr: XMLHttpRequest | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let attempt = 0;
let appState: AppStateStatus = AppState.currentState;
let appStateSub: { remove: () => void } | null = null;
let viewerQuery = '';

function emit(event: LiveContentEvent) {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // a broken listener must not break the stream
    }
  }
}

function token() {
  return getApiToken() ?? readStoredSession()?.token ?? null;
}

function clearTimers() {
  if (retryTimer) clearTimeout(retryTimer);
  if (watchdog) clearTimeout(watchdog);
  retryTimer = null;
  watchdog = null;
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function closeConnection() {
  clearTimers();
  const current = xhr;
  xhr = null;
  if (current) {
    current.onprogress = null;
    current.onload = null;
    current.onerror = null;
    current.onabort = null;
    current.abort();
  }
}

function armWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    closeConnection();
    scheduleReconnect();
  }, SILENCE_LIMIT_MS);
}

function shouldRun() {
  return users > 0 && appState === 'active' && isApiEnabled;
}

function scheduleReconnect() {
  if (!shouldRun() || retryTimer) return;
  attempt += 1;
  if (attempt >= FAILURES_BEFORE_POLL && !pollTimer) {
    pollTimer = setInterval(() => emit({ type: 'resync' }), POLL_FALLBACK_MS);
  }
  retryTimer = setTimeout(() => {
    retryTimer = null;
    connect();
  }, backoffDelay(attempt));
}

function connect() {
  if (!shouldRun() || xhr) return;
  const bearer = token();
  if (!bearer) {
    scheduleReconnect();
    return;
  }
  const request = new XMLHttpRequest();
  xhr = request;
  let seen = 0;
  let carry = '';
  let opened = false;
  request.open('GET', `${getApiBaseUrl()}/v1/content/stream${viewerQuery}`);
  request.setRequestHeader('Accept', 'text/event-stream');
  request.setRequestHeader('Authorization', `Bearer ${bearer}`);
  request.responseType = 'text';
  armWatchdog();
  request.onprogress = () => {
    if (xhr !== request) return;
    armWatchdog();
    const text = request.responseText ?? '';
    if (text.length <= seen) return;
    const parsed = parseSseChunk(carry, text.slice(seen));
    seen = text.length;
    carry = parsed.carry;
    for (const message of parsed.messages) {
      if (message.event === 'ready') {
        if (!opened) {
          opened = true;
          attempt = 0;
          stopPolling();
          emit({ type: 'resync' });
        }
        continue;
      }
      if (message.event !== 'post.published' && message.event !== 'post.removed') {
        continue;
      }
      try {
        const data = JSON.parse(message.data) as Record<string, unknown>;
        if (typeof data.id !== 'string') continue;
        emit({
          type: message.event,
          id: data.id,
          format: String(data.format ?? ''),
          publisherProfileType: String(data.publisherProfileType ?? ''),
          publisherProfileId: String(data.publisherProfileId ?? ''),
          item: data.item,
        } as LiveContentEvent);
      } catch {
        // ignore malformed payloads
      }
    }
  };
  const ended = () => {
    if (xhr !== request) return;
    xhr = null;
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    scheduleReconnect();
  };
  request.onload = ended;
  request.onerror = ended;
  request.send();
}

function onAppState(next: AppStateStatus) {
  const wasActive = appState === 'active';
  appState = next;
  if (next === 'active' && !wasActive) {
    attempt = 0;
    connect();
    emit({ type: 'resync' });
  } else if (next !== 'active') {
    closeConnection();
    stopPolling();
  }
}

/** Viewer profile the server filters for (personal vs business identity). */
export function setLiveViewerProfile(
  profile: { type: string; id: string } | undefined,
) {
  const next = profile
    ? `?viewerProfileType=${encodeURIComponent(profile.type)}&viewerProfileId=${encodeURIComponent(profile.id)}`
    : '';
  if (next === viewerQuery) return;
  viewerQuery = next;
  if (xhr) {
    closeConnection();
    connect();
  }
}

/** Keeps the shared stream open while at least one owner is mounted. */
export function startLiveContent(): () => void {
  users += 1;
  if (users === 1) {
    appState = AppState.currentState;
    appStateSub = AppState.addEventListener('change', onAppState);
  }
  connect();
  return () => {
    users = Math.max(0, users - 1);
    if (users === 0) {
      appStateSub?.remove();
      appStateSub = null;
      closeConnection();
      stopPolling();
      attempt = 0;
    }
  };
}

export function subscribeLiveContent(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
