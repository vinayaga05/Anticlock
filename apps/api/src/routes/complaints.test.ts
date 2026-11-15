import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import { CreateComplaintRequestSchema, ComplaintListQuerySchema } from '@anticlock/contracts';
import { complaintsMobileRoutes } from './complaints.js';
import { complaintService, decodeComplaintCursor, encodeComplaintCursor } from '../complaints/ComplaintService.js';
import { signToken } from '../lib/auth.js';
import { ApiError } from '../lib/httpError.js';
import type { AppEnv } from '../middleware/auth.js';

const USER = '49aba8f1-2d97-4e6b-adf8-429697f72129';
const COMPLAINT = '26d0a11d-a212-4cdc-a4b6-e6cd82b90c7a';
const complaint = {
  id: COMPLAINT,
  title: 'Street light needs repair',
  description: 'The light near the main entrance has stopped working.',
  author: { id: USER, displayName: 'Community member', avatarUrl: null },
  createdAt: '2026-11-13T12:00:00.123Z',
};

function app() {
  const instance = new Hono<AppEnv>();
  instance.route('/v1/complaints', complaintsMobileRoutes);
  return instance;
}

async function headers(kind: 'mobile' | 'admin' = 'mobile') {
  return {
    Authorization: `Bearer ${await signToken({ kind, sub: USER, email: '', name: 'Member', roles: [] })}`,
    'Content-Type': 'application/json',
  };
}

afterEach(() => mock.restoreAll());

describe('complaints routes', () => {
  it('requires a valid mobile session for reading and creating complaints', async () => {
    const list = mock.method(complaintService, 'listComplaints', async () => ({ complaints: [], nextCursor: null }));
    const create = mock.method(complaintService, 'createComplaint', async () => complaint);
    for (const method of ['GET', 'POST']) {
      const body = method === 'POST' ? JSON.stringify({ title: complaint.title, description: complaint.description }) : undefined;
      const missing = await app().request('/v1/complaints', { method, body });
      assert.equal(missing.status, 401);
      const invalid = await app().request('/v1/complaints', { method, body, headers: { Authorization: 'Bearer invalid' } });
      assert.equal(invalid.status, 401);
      const admin = await app().request('/v1/complaints', { method, body, headers: await headers('admin') });
      assert.equal(admin.status, 403);
    }
    assert.equal(list.mock.callCount(), 0);
    assert.equal(create.mock.callCount(), 0);
  });

  it('creates trimmed text using only the authenticated author and passes a retry key', async () => {
    const create = mock.method(complaintService, 'createComplaint', async () => complaint);
    const response = await app().request('/v1/complaints', {
      method: 'POST', headers: await headers(),
      body: JSON.stringify({
        title: `  ${complaint.title}  `,
        description: `\n ${complaint.description} \n`,
        clientRequestId: 'request-for-complaint-1',
        authorId: 'forged-author', author: { displayName: 'Forged' },
      }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { complaint });
    assert.equal(create.mock.callCount(), 1);
    assert.deepEqual(create.mock.calls[0]!.arguments, [USER, {
      title: complaint.title,
      description: complaint.description,
      clientRequestId: 'request-for-complaint-1',
    }]);
  });

  it('rejects invalid text and malformed JSON before writing', async () => {
    const create = mock.method(complaintService, 'createComplaint', async () => complaint);
    for (const body of [
      '{}', '{broken-json',
      JSON.stringify({ title: '  ', description: complaint.description }),
      JSON.stringify({ title: 'Ok title', description: 'too short' }),
      JSON.stringify({ title: 'x'.repeat(121), description: complaint.description }),
      JSON.stringify({ title: 'Ok title', description: 'x'.repeat(3001) }),
      JSON.stringify({ title: complaint.title, description: complaint.description, clientRequestId: 'short' }),
    ]) {
      const response = await app().request('/v1/complaints', { method: 'POST', headers: await headers(), body });
      assert.equal(response.status, 400, body.slice(0, 40));
      assert.equal((await response.json()).error.code, 'validation_error');
    }
    assert.equal(create.mock.callCount(), 0);
  });

  it('returns a shared feed with its cursor and validates page sizes', async () => {
    const cursor = encodeComplaintCursor({ id: COMPLAINT, createdAt: new Date(complaint.createdAt) });
    const list = mock.method(complaintService, 'listComplaints', async () => ({ complaints: [complaint], nextCursor: cursor }));
    const response = await app().request(`/v1/complaints?limit=7&cursor=${cursor}`, { headers: await headers() });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { complaints: [complaint], nextCursor: cursor });
    assert.deepEqual(list.mock.calls[0]!.arguments, [USER, { limit: 7, cursor }]);
    const first = await app().request('/v1/complaints', { headers: await headers() });
    assert.equal(first.status, 200);
    assert.deepEqual(list.mock.calls[1]!.arguments, [USER, { limit: 20, cursor: undefined }]);
    for (const query of ['limit=0', 'limit=51', 'limit=1.5', 'limit=invalid', 'limit=', 'cursor=']) {
      assert.equal((await app().request(`/v1/complaints?${query}`, { headers: await headers() })).status, 400);
    }
    assert.equal(list.mock.callCount(), 2);
  });

  it('returns actionable inactive-account and retry-conflict errors', async () => {
    mock.method(complaintService, 'listComplaints', async () => { throw new ApiError(403, 'forbidden', 'An active mobile account is required.'); });
    const inactive = await app().request('/v1/complaints', { headers: await headers() });
    assert.equal(inactive.status, 403);
    mock.method(complaintService, 'createComplaint', async () => { throw new ApiError(409, 'idempotency_conflict', 'This request was already used.'); });
    const conflicting = await app().request('/v1/complaints', {
      method: 'POST', headers: await headers(), body: JSON.stringify({ title: complaint.title, description: complaint.description }),
    });
    assert.equal(conflicting.status, 409);
    assert.equal((await conflicting.json()).error.code, 'idempotency_conflict');
  });

  it('does not disclose database errors or request details on unexpected failure', async () => {
    mock.method(console, 'error', () => {});
    mock.method(complaintService, 'listComplaints', async () => { throw new Error('SQL failure with private-email@example.test'); });
    const response = await app().request('/v1/complaints', { headers: await headers() });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: 'internal_error', message: 'Unexpected server error' } });
  });
});

describe('complaint contracts and cursors', () => {
  it('enforces trimmed bounds and retry-key length without accepting client author fields', () => {
    const parsed = CreateComplaintRequestSchema.parse({ title: '  Example  ', description: '  Complaint description  ', authorId: USER });
    assert.deepEqual(parsed, { title: 'Example', description: 'Complaint description' });
    assert.equal(CreateComplaintRequestSchema.safeParse({ title: ' xx ', description: 'Long enough description' }).success, false);
    assert.equal(CreateComplaintRequestSchema.safeParse({ title: 'Valid title', description: ' '.repeat(11) }).success, false);
    assert.equal(CreateComplaintRequestSchema.safeParse({ title: 'Valid title', description: complaint.description, clientRequestId: 'x'.repeat(101) }).success, false);
    assert.deepEqual(ComplaintListQuerySchema.parse({}), { limit: 20 });
  });

  it('round-trips both parts of a millisecond-precise deterministic cursor', () => {
    const date = new Date(complaint.createdAt);
    const decoded = decodeComplaintCursor(encodeComplaintCursor({ id: COMPLAINT, createdAt: date }));
    assert.equal(decoded.id, COMPLAINT);
    assert.equal(decoded.createdAt.toISOString(), complaint.createdAt);
  });

  it('uses Unicode character minimums consistent with PostgreSQL text constraints', () => {
    const valid = { title: complaint.title, description: complaint.description, clientRequestId: 'valid-request-key' };
    assert.equal(CreateComplaintRequestSchema.safeParse({ ...valid, title: '😀😀' }).success, false);
    assert.equal(CreateComplaintRequestSchema.safeParse({ ...valid, description: '😀'.repeat(5) }).success, false);
    assert.equal(CreateComplaintRequestSchema.safeParse({ ...valid, clientRequestId: '😀'.repeat(4) }).success, false);
    assert.equal(CreateComplaintRequestSchema.safeParse({ title: '😀'.repeat(3), description: '😀'.repeat(10), clientRequestId: '😀'.repeat(8) }).success, true);
  });

  it('rejects malformed cursors before they can reach a database comparison', () => {
    for (const value of [
      '', 'not-a-cursor', '%%%', Buffer.from('null').toString('base64url'),
      Buffer.from(JSON.stringify({ id: COMPLAINT, createdAt: 'invalid-date' })).toString('base64url'),
      Buffer.from(JSON.stringify({ id: 'bad-id', createdAt: complaint.createdAt })).toString('base64url'),
    ]) {
      assert.throws(() => decodeComplaintCursor(value), { status: 400, code: 'invalid_cursor' });
    }
  });
});
