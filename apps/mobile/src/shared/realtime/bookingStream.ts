import { AppState, type AppStateStatus } from 'react-native';
import type { BookingStatus } from '@anticlock/contracts';
import { getApiToken } from '@/shared/api/client';
import { getApiBaseUrl, isApiEnabled } from '@/shared/api/config';
import { readStoredSession } from '@/shared/services/auth/authService';
import { backoffDelay } from './liveClipMerge';

export type LiveBookingEvent =
  | {
      type: 'booking.changed';
      bookingId: string;
      status: BookingStatus;
      at: string;
    }
  | { type: 'resync' };

type Listener = (event: LiveBookingEvent) => void;
type NativeWebSocketConstructor = new (
  url: string,
  protocols?: string | string[] | null,
  options?: { headers?: Record<string, string> },
) => WebSocket;

const SILENCE_LIMIT_MS = 70_000;
const listeners = new Set<Listener>();
let users = 0;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let watchdog: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let appState: AppStateStatus = AppState.currentState;
let appStateSub: { remove: () => void } | null = null;

function emit(event: LiveBookingEvent) {
  [...listeners].forEach(listener => {
    try {
      listener(event);
    } catch {
      // A broken observer must not interrupt the shared connection.
    }
  });
}

function token() {
  return getApiToken() ?? readStoredSession()?.token ?? null;
}

function shouldRun() {
  return users > 0 && appState === 'active' && isApiEnabled;
}

function clearTimers() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (watchdog) clearTimeout(watchdog);
  reconnectTimer = null;
  watchdog = null;
}

function closeConnection() {
  clearTimers();
  const current = socket;
  socket = null;
  if (current) {
    current.onopen = null;
    current.onmessage = null;
    current.onerror = null;
    current.onclose = null;
    current.close();
  }
}

function scheduleReconnect() {
  if (!shouldRun() || reconnectTimer) return;
  attempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffDelay(attempt));
}

function armWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    closeConnection();
    scheduleReconnect();
  }, SILENCE_LIMIT_MS);
}

function connect() {
  if (!shouldRun() || socket) return;
  const bearer = token();
  if (!bearer) {
    scheduleReconnect();
    return;
  }
  const url = `${getApiBaseUrl().replace(/^http/, 'ws')}/v1/bookings/stream`;
  const NativeWebSocket = WebSocket as unknown as NativeWebSocketConstructor;
  const current = new NativeWebSocket(url, null, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  socket = current;
  current.onopen = () => {
    if (socket !== current) return;
    attempt = 0;
    armWatchdog();
  };
  current.onmessage = message => {
    if (socket !== current) return;
    armWatchdog();
    try {
      const event = JSON.parse(String(message.data)) as Record<string, unknown>;
      if (event.type === 'ready') {
        emit({ type: 'resync' });
      } else if (
        event.type === 'booking.changed' &&
        typeof event.bookingId === 'string' &&
        typeof event.status === 'string'
      ) {
        emit(event as LiveBookingEvent);
      }
    } catch {
      // Ignore malformed server messages and keep the connection alive.
    }
  };
  const ended = () => {
    if (socket !== current) return;
    socket = null;
    if (watchdog) clearTimeout(watchdog);
    watchdog = null;
    scheduleReconnect();
  };
  current.onerror = ended;
  current.onclose = ended;
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
  }
}

export function startLiveBookings() {
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
      attempt = 0;
    }
  };
}

export function subscribeLiveBookings(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
