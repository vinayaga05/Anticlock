import { API_BASE_URL, isApiEnabled } from './config';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let bearerToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(token: string | null) {
  bearerToken = token;
}

export function getApiToken() {
  return bearerToken;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!isApiEnabled) {
    throw new ApiError(0, 'api_disabled', 'API_BASE_URL is not configured');
  }

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof ArrayBuffer)) {
    headers.set('Content-Type', 'application/json');
  }
  if (bearerToken) headers.set('Authorization', `Bearer ${bearerToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!res.ok) {
    let code = 'request_failed';
    let message = res.statusText;
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && bearerToken) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export async function apiStream<TEvent>(
  path: string,
  body: unknown,
  onEvent: (event: TEvent) => void,
  init: { signal?: AbortSignal } = {},
): Promise<void> {
  if (!isApiEnabled) {
    throw new ApiError(0, 'api_disabled', 'API_BASE_URL is not configured');
  }

  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (bearerToken) headers.set('Authorization', `Bearer ${bearerToken}`);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: init.signal,
  });

  if (!res.ok) {
    throw new ApiError(res.status, 'stream_failed', res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new ApiError(0, 'stream_unavailable', 'Streaming is not supported');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      try {
        onEvent(JSON.parse(payload) as TEvent);
      } catch {
        /* ignore malformed chunks */
      }
    }
  }
}
