import { ZodError } from 'zod';

export type HttpErrorStatus = 400 | 401 | 403 | 404 | 409 | 410 | 422 | 429 | 500;

export type HttpErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

/** Error with an HTTP status that is safe to show to API clients. */
export class ApiError extends Error {
  constructor(
    public readonly status: Exclude<HttpErrorStatus, 500>,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'ZodError')
  );
}

function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * Map a thrown error to a JSON error response.
 *
 * Client errors (4xx with an explicit status) keep their code and message.
 * Anything else is logged and returned as a generic 500 so database errors
 * (e.g. "Failed query: select …") never leak to clients.
 */
export function httpError(
  err: unknown,
  scope = 'api',
): { status: HttpErrorStatus; body: HttpErrorBody } {
  if (isZodError(err)) {
    const issue = err.issues[0];
    return {
      status: 400,
      body: {
        error: {
          code: 'validation_error',
          message: issue
            ? `${issue.path.join('.') || 'request'}: ${issue.message}`
            : 'Invalid request',
        },
      },
    };
  }

  // Malformed UUID / enum path params reach Postgres as invalid text
  // (SQLSTATE 22P02). That is a lookup miss, not a server fault.
  if (pgErrorCode(err) === '22P02') {
    return { status: 404, body: { error: { code: 'not_found', message: 'Not found' } } };
  }

  const e = err as { status?: unknown; code?: unknown; message?: unknown };
  const status = typeof e?.status === 'number' ? e.status : undefined;
  if (status !== undefined && status >= 400 && status < 500) {
    return {
      status: status as HttpErrorStatus,
      body: {
        error: {
          code: typeof e.code === 'string' ? e.code : 'error',
          message: typeof e.message === 'string' && e.message ? e.message : 'Request failed',
        },
      },
    };
  }

  console.error(`[${scope}]`, err);
  return {
    status: 500,
    body: { error: { code: 'internal_error', message: 'Unexpected server error' } },
  };
}
