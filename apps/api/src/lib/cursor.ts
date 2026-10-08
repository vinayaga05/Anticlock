import { ApiError } from './httpError.js';

/**
 * Parse a timestamp pagination cursor supplied by a client.
 * Throws a 400 ApiError for anything that is not a valid date so a malformed
 * cursor never reaches Postgres (which would otherwise surface as a 500).
 */
export function parseCursorDate(cursor: string): Date {
  const date = new Date(cursor);
  if (!cursor || Number.isNaN(date.getTime())) {
    throw new ApiError(400, 'invalid_cursor', 'Invalid pagination cursor');
  }
  return date;
}

/**
 * Same as parseCursorDate but returns an ISO string, for use inside raw
 * drizzle `sql` templates. postgres-js (as configured by drizzle) cannot
 * serialise a JS Date passed as a raw template parameter.
 */
export function parseCursorIso(cursor: string): string {
  return parseCursorDate(cursor).toISOString();
}
