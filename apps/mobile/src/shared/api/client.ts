import { getApiBaseUrl, isApiEnabled } from './config';

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

const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;

function consumeSseLines(
  chunk: string,
  carry: string,
  onEvent: (payload: string) => void,
): string {
  const combined = carry + chunk;
  const parts = combined.split('\n');
  const rest = parts.pop() ?? '';
  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload) continue;
    onEvent(payload);
  }
  return rest;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<T> {
  if (!isApiEnabled) {
    throw new ApiError(0, 'api_disabled', 'API_BASE_URL is not configured');
  }

  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && !(init.body instanceof ArrayBuffer)) {
    headers.set('Content-Type', 'application/json');
  }
  if (bearerToken) headers.set('Authorization', `Bearer ${bearerToken}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(
        0,
        'request_timeout',
        'Request timed out. Check your network or API server.',
      );
    }
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the server. Check your network or API URL.',
    );
  } finally {
    clearTimeout(timeout);
  }

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

/**
 * SSE client for Genie. React Native's fetch often has no ReadableStream
 * (`response.body.getReader`), so we use XMLHttpRequest which supports
 * incremental `onprogress` text responses.
 */
export async function apiStream<TEvent>(
  path: string,
  body: unknown,
  onEvent: (event: TEvent) => void,
  init: { signal?: AbortSignal } = {},
): Promise<void> {
  if (!isApiEnabled) {
    throw new ApiError(0, 'api_disabled', 'API_BASE_URL is not configured');
  }

  const emit = (payload: string) => {
    try {
      onEvent(JSON.parse(payload) as TEvent);
    } catch {
      /* ignore malformed chunks */
    }
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let seen = 0;
    let carry = '';
    let settled = false;

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    const succeed = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const ingest = () => {
      const text = xhr.responseText ?? '';
      if (text.length <= seen) return;
      const chunk = text.slice(seen);
      seen = text.length;
      carry = consumeSseLines(chunk, carry, emit);
    };

    xhr.open('POST', `${getApiBaseUrl()}${path}`);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (bearerToken) {
      xhr.setRequestHeader('Authorization', `Bearer ${bearerToken}`);
    }
    xhr.responseType = 'text';

    xhr.onprogress = ingest;
    xhr.onload = () => {
      ingest();
      if (carry.trim().startsWith('data:')) {
        emit(carry.trim().slice(5).trim());
        carry = '';
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        succeed();
        return;
      }

      if (xhr.status === 401 && bearerToken) {
        onUnauthorized?.();
      }

      let code = 'stream_failed';
      let message = xhr.statusText || `Request failed (${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as {
          error?: { code?: string; message?: string };
        };
        code = parsed.error?.code ?? code;
        message = parsed.error?.message ?? message;
      } catch {
        /* keep defaults */
      }
      fail(new ApiError(xhr.status, code, message));
    };

    xhr.onerror = () => {
      fail(
        new ApiError(
          0,
          'network_error',
          'Could not reach the server. Check your network or API URL.',
        ),
      );
    };

    xhr.onabort = () => {
      const abortErr = new Error('Aborted');
      abortErr.name = 'AbortError';
      fail(abortErr);
    };

    if (init.signal) {
      if (init.signal.aborted) {
        xhr.abort();
        return;
      }
      init.signal.addEventListener(
        'abort',
        () => {
          xhr.abort();
        },
        { once: true },
      );
    }

    try {
      xhr.send(JSON.stringify(body));
    } catch (err) {
      fail(
        err instanceof Error
          ? err
          : new ApiError(0, 'network_error', 'Could not start stream request'),
      );
    }
  });
}
