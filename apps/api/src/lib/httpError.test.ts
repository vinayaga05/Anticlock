import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { ApiError, httpError } from './httpError.js';
import { parseCursorDate, parseCursorIso } from './cursor.js';

describe('httpError', () => {
  it('maps Zod errors to 400 validation_error', () => {
    const result = z.object({ name: z.string() }).safeParse({});
    assert.equal(result.success, false);
    const { status, body } = httpError(result.error, 'test');
    assert.equal(status, 400);
    assert.equal(body.error.code, 'validation_error');
    assert.match(body.error.message, /^name: /);
  });

  it('keeps 4xx client errors', () => {
    const { status, body } = httpError(new ApiError(409, 'already_enrolled', 'Already enrolled'), 'test');
    assert.equal(status, 409);
    assert.deepEqual(body.error, { code: 'already_enrolled', message: 'Already enrolled' });
  });

  it('hides database errors behind a generic 500', () => {
    const original = console.error;
    console.error = () => {};
    try {
      const dbError = Object.assign(new Error('Failed query: select "id" from "courses"'), { code: '42P01' });
      const { status, body } = httpError(dbError, 'test');
      assert.equal(status, 500);
      assert.equal(body.error.code, 'internal_error');
      assert.doesNotMatch(body.error.message, /select|Failed query/i);
    } finally {
      console.error = original;
    }
  });

  it('treats invalid uuid text (22P02) as not found, including drizzle-wrapped causes', () => {
    const wrapped = Object.assign(new Error('Failed query'), {
      cause: Object.assign(new Error('invalid input syntax for type uuid'), { code: '22P02' }),
    });
    const { status, body } = httpError(wrapped, 'test');
    assert.equal(status, 404);
    assert.equal(body.error.code, 'not_found');
  });
});

describe('cursor parsing', () => {
  it('accepts ISO timestamps', () => {
    assert.equal(parseCursorIso('2026-10-08T07:30:00.000Z'), '2026-10-08T07:30:00.000Z');
    assert.ok(parseCursorDate('2026-01-01') instanceof Date);
  });

  it('rejects malformed cursors with a 400', () => {
    for (const bad of ['garbage', '', '2026-13-45']) {
      assert.throws(
        () => parseCursorIso(bad),
        (err: unknown) => err instanceof ApiError && err.status === 400 && err.code === 'invalid_cursor',
      );
    }
  });
});
