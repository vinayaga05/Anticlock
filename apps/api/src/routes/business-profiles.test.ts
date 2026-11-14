import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import type { BusinessProfile } from '@anticlock/contracts';
import { businessProfileRoutes } from './business-profiles.js';
import { businessProfileService } from '../provider/BusinessProfileService.js';
import { signToken } from '../lib/auth.js';
import { ApiError } from '../lib/httpError.js';
import type { AppEnv } from '../middleware/auth.js';

const USER = '572af106-4f78-46a6-9fa4-0bfd256c0c07';
const BUSINESS = 'ca287311-aa86-4b3b-a3df-fbd37657f7da';
const BOOKING = '11fb46b5-3337-4159-a77a-66b354502e6d';
const business = { id: BUSINESS } as BusinessProfile;
const app = () => new Hono<AppEnv>().route('/v1/business-profiles', businessProfileRoutes);
const url = `/v1/business-profiles/${BUSINESS}`;
async function headers(kind: 'mobile' | 'admin' = 'mobile') {
  return { Authorization: `Bearer ${await signToken({ kind, sub: USER, email: '', name: 'Member', roles: [] })}`, 'Content-Type': 'application/json' };
}
afterEach(() => mock.restoreAll());
describe('dedicated business profile routes', () => {
  it('allows public detail and uses the actual authenticated viewer when supplied', async () => {
    const get = mock.method(businessProfileService, 'getProfile', async () => business);
    assert.equal((await app().request(url)).status, 200);
    assert.equal((await app().request(url, { headers: await headers() })).status, 200);
    assert.deepEqual(get.mock.calls.map(call => call.arguments), [[BUSINESS, undefined, undefined], [BUSINESS, USER, undefined]]);
    assert.equal((await app().request(url, { headers: await headers('admin') })).status, 403);
    assert.equal(get.mock.callCount(), 2);
  });
  it('requires mobile authentication for every write and analytics without calling services', async () => {
    const save = mock.method(businessProfileService, 'save', async () => ({ saved: true }));
    for (const [method, path, body] of [ ['PUT', '/save', { saved: true }], ['POST', '/reports', { reason: 'spam' }], ['PATCH', '', { name: 'New title' }], ['PUT', '/services', { services: [] }], ['POST', '/reviews', { bookingId: BOOKING, body: 'Good service overall', rating: 5 }] ] as const) {
      assert.equal((await app().request(`${url}${path}`, { method, body: JSON.stringify(body) })).status, 401);
      assert.equal((await app().request(`${url}${path}`, { method, headers: await headers('admin'), body: JSON.stringify(body) })).status, 403);
    }
    assert.equal((await app().request(`${url}/analytics`)).status, 401);
    assert.equal(save.mock.callCount(), 0);
  });
  it('persists a save against the authenticated user and rejects forged identities', async () => {
    const save = mock.method(businessProfileService, 'save', async () => ({ saved: true }));
    const response = await app().request(`${url}/save`, { method: 'PUT', headers: await headers(), body: JSON.stringify({ saved: true }) });
    assert.equal(response.status, 200);
    assert.deepEqual(save.mock.calls[0]!.arguments, [BUSINESS, USER, true, undefined]);
    for (const body of [{ saved: 'true' }, { saved: true, userId: 'someone-else' }]) assert.equal((await app().request(`${url}/save`, { method: 'PUT', headers: await headers(), body: JSON.stringify(body) })).status, 400);
    assert.equal(save.mock.callCount(), 1);
  });
  it('validates safe owner fields and returns server permissions errors', async () => {
    const update = mock.method(businessProfileService, 'updateProfile', async () => business);
    const response = await app().request(url, { method: 'PATCH', headers: await headers(), body: JSON.stringify({ name: '  New business  ', brandAccentColor: '#123456' }) });
    assert.equal(response.status, 200);
    assert.deepEqual(update.mock.calls[0]!.arguments, [BUSINESS, USER, { name: 'New business', brandAccentColor: '#123456' }]);
    for (const body of ['{bad', JSON.stringify({ status: 'active' }), JSON.stringify({ documents: { id: 'private' } }), JSON.stringify({ brandAccentColor: 'blue' })]) assert.equal((await app().request(url, { method: 'PATCH', headers: await headers(), body })).status, 400);
    mock.method(businessProfileService, 'updateServices', async () => { throw new ApiError(403, 'forbidden', 'You cannot manage this business.'); });
    const denied = await app().request(`${url}/services`, { method: 'PUT', headers: await headers(), body: JSON.stringify({ services: [{ categoryId: 'fitness.yoga', description: null, price: 500, durationMinutes: 60, modes: ['center'], available: true }] }) });
    assert.equal(denied.status, 403);
  });
  it('validates availability mode, duration and review pagination before querying', async () => {
    const availability = mock.method(businessProfileService, 'availability', async () => ({ date: '2026-11-16', categoryId: 'fitness.yoga', serviceMode: 'center' as const, durationMinutes: 60, timeZone: 'Asia/Kolkata' as const, slots: [], reason: null }));
    const response = await app().request(`${url}/availability?date=2026-11-16&categoryId=fitness.yoga&serviceMode=center&durationMinutes=60`);
    assert.equal(response.status, 200);
    assert.deepEqual(availability.mock.calls[0]!.arguments, [BUSINESS, { date: '2026-11-16', categoryId: 'fitness.yoga', serviceMode: 'center', durationMinutes: 60 }, undefined, undefined, undefined]);
    for (const query of ['date=bad', 'date=2026-11-16&categoryId=yoga&serviceMode=teleport', 'date=2026-11-16&categoryId=yoga&serviceMode=center&durationMinutes=0']) assert.equal((await app().request(`${url}/availability?${query}`)).status, 400);
    for (const query of ['limit=0', 'limit=31', 'limit=x', 'cursor=']) assert.equal((await app().request(`${url}/reviews?${query}`)).status, 400);
    assert.equal(availability.mock.callCount(), 1);
  });
  it('submits verified-booking reviews with no client-supplied author or verification status', async () => {
    const create = mock.method(businessProfileService, 'createReview', async () => ({ id: BOOKING } as never));
    const request = { bookingId: BOOKING, rating: 5, body: '  Excellent professional service  ' };
    const response = await app().request(`${url}/reviews`, { method: 'POST', headers: await headers(), body: JSON.stringify(request) });
    assert.equal(response.status, 201);
    assert.deepEqual(create.mock.calls[0]!.arguments, [BUSINESS, USER, { ...request, body: request.body.trim(), photoMediaIds: [] }, undefined]);
    assert.equal((await app().request(`${url}/reviews`, { method: 'POST', headers: await headers(), body: JSON.stringify({ ...request, authorId: USER, verifiedBooking: true }) })).status, 400);
    assert.equal(create.mock.callCount(), 1);
  });
  it('validates report reasons and keeps storage/database failure details private', async () => {
    const report = mock.method(businessProfileService, 'report', async () => ({ reportId: BOOKING }));
    assert.equal((await app().request(`${url}/reports`, { method: 'POST', headers: await headers(), body: JSON.stringify({ reason: 'safety', details: '  Please investigate  ' }) })).status, 201);
    assert.deepEqual(report.mock.calls[0]!.arguments, [BUSINESS, USER, { reason: 'safety', details: 'Please investigate' }, undefined]);
    assert.equal((await app().request(`${url}/reports`, { method: 'POST', headers: await headers(), body: JSON.stringify({ reason: 'invented' }) })).status, 400);
    mock.method(console, 'error', () => {});
    mock.method(businessProfileService, 'getProfile', async () => { throw new Error('private SQL / KYC key'); });
    const response = await app().request(url);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: { code: 'internal_error', message: 'Unexpected server error' } });
  });
  it('validates chosen social viewers, rejects anonymous/forged refs and forwards owned context', async () => {
    const viewer = { id: BOOKING, type: 'business' as const };
    const resolve = mock.method(businessProfileService, 'resolveViewer', async (_user, ref) => ref);
    const get = mock.method(businessProfileService, 'getProfile', async () => business);
    const query = `?viewerProfileId=${BOOKING}&viewerProfileType=business`;
    assert.equal((await app().request(`${url}${query}`)).status, 401);
    assert.equal(resolve.mock.callCount(), 0);
    assert.equal((await app().request(`${url}${query}`, { headers: await headers() })).status, 200);
    assert.deepEqual(resolve.mock.calls[0]!.arguments, [USER, viewer]);
    assert.deepEqual(get.mock.calls[0]!.arguments, [BUSINESS, USER, viewer]);
    for (const query of [`?viewerProfileId=${BOOKING}`, '?viewerProfileId=x&viewerProfileType=business', `?viewerProfileId=${BOOKING}&viewerProfileType=admin`]) assert.equal((await app().request(`${url}${query}`, { headers: await headers() })).status, 400);
    mock.restoreAll();
    mock.method(businessProfileService, 'resolveViewer', async () => { throw new ApiError(403, 'forbidden', 'This profile is not yours.'); });
    const hidden = mock.method(businessProfileService, 'getProfile', async () => business);
    assert.equal((await app().request(`${url}${query}`, { headers: await headers() })).status, 403);
    assert.equal(hidden.mock.callCount(), 0);
  });
  it('lists saved businesses on a dedicated authenticated route with bounded pagination', async () => {
    const list = mock.method(businessProfileService, 'listSaved', async () => ({ businesses: [], nextCursor: null }));
    assert.equal((await app().request('/v1/business-profiles/saved')).status, 401);
    assert.equal((await app().request('/v1/business-profiles/saved?limit=7', { headers: await headers() })).status, 200);
    assert.deepEqual(list.mock.calls[0]!.arguments, [USER, 7, undefined, undefined]);
    for (const query of ['limit=0', 'limit=51', 'limit=x', 'cursor=']) assert.equal((await app().request(`/v1/business-profiles/saved?${query}`, { headers: await headers() })).status, 400);
    assert.equal(list.mock.callCount(), 1);
  });
});
