export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'anticlock_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiClientError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (
    !headers.has('Content-Type') &&
    init.body &&
    !(init.body instanceof FormData) &&
    !(init.body instanceof ArrayBuffer) &&
    !(init.body instanceof Blob)
  ) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
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
    throw new ApiClientError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Direct binary PUT (local upload target or custom headers). */
export async function apiPutBinary(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress?: (percentage: number) => void,
) {
  const h = new Headers(headers);
  const token = getToken();
  if (token && url.includes('/admin/media/')) {
    h.set('Authorization', `Bearer ${token}`);
  }

  // Fetch does not expose upload byte progress. Use XHR in the Admin browser
  // for a direct R2 PUT, keeping credentials off the cross-origin request.
  if (typeof XMLHttpRequest !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('PUT', url);
      h.forEach((value, key) => request.setRequestHeader(key, value));

      request.upload.onprogress = event => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      request.onerror = () => {
        reject(new ApiClientError(0, 'upload_failed', 'Network upload failed'));
      };
      request.onabort = () => {
        reject(new ApiClientError(0, 'upload_aborted', 'Upload was cancelled'));
      };
      request.onload = () => {
        if (request.status >= 200 && request.status < 300) {
          onProgress?.(100);
          resolve();
          return;
        }

        let message = request.statusText || 'Upload failed';
        try {
          const data = JSON.parse(request.responseText) as {
            error?: { message?: string };
          };
          message = data.error?.message ?? message;
        } catch {
          /* The R2 error body is not guaranteed to be JSON. */
        }
        reject(new ApiClientError(request.status, 'upload_failed', message));
      };
      request.send(body);
    });
    return;
  }

  const res = await fetch(url, { method: 'PUT', headers: h, body });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: { message?: string } };
      message = data.error?.message ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiClientError(res.status, 'upload_failed', message);
  }
  onProgress?.(100);
}
