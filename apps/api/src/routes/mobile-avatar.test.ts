import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import { Hono } from 'hono';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UpdateMobileProfileRequestSchema } from '@anticlock/contracts';
import { authRoutes } from './auth.js';
import { db } from '../db/client.js';
import { signToken, type AuthClaims } from '../lib/auth.js';
import { MediaService, mediaService } from '../media/MediaService.js';
import { mediaRepository } from '../media/MediaRepository.js';
import { LocalObjectStorageProvider } from '../media/LocalObjectStorageProvider.js';
import { MAX_AVATAR_BYTES, managedAvatarReference, validateAvatarUpload } from '../media/validateAvatarUpload.js';

const USER = 'dc2b4aab-3255-457d-b088-74a56a80809f';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDlKKKK+vPDP//Z', 'base64');
const WEBP = Buffer.from('UklGRjwAAABXRUJQVlA4IDAAAADwAQCdASoBAAEAAUAmJaACdLoB+AAETAAA/vDXA/9Js8TZ4mz5JH/xZyMR2XgAAAA=', 'base64');
const auth: AuthClaims = { sub: USER, kind: 'mobile', email: '', name: 'Member', roles: [], permissions: [] };
const originalEnv = { ...process.env };
const flush = () => new Promise(resolve => setImmediate(resolve));

afterEach(() => { mock.restoreAll(); mock.timers.reset(); process.env = { ...originalEnv }; });

function app() { const instance = new Hono(); instance.route('/auth', authRoutes); return instance; }
async function headers(kind: 'mobile' | 'admin' = 'mobile') {
  return { Authorization: `Bearer ${await signToken({ ...auth, kind })}` };
}
function form(bytes: Buffer = PNG, mime = 'image/png') {
  const data = new FormData(); data.set('file', new Blob([new Uint8Array(bytes)], { type: mime }), 'photo.png'); return data;
}
function mockDatabase(owner = true) {
  mock.method(db, 'select', () => ({ from: () => ({ where: () => ({ limit: async () => owner ? [{ id: USER }] : [] }) }) }) as any);
  const create = mock.method(mediaRepository, 'createAsset', async values => ({ ...values, createdAt: new Date() }) as any);
  const update = mock.method(mediaRepository, 'updateAsset', async (id, values) => ({ id, ...values }) as any);
  const profileWrite = mock.method(db, 'update', () => { throw new Error('An upload must never update a profile'); });
  return { create, update, profileWrite };
}

describe('mobile avatar route', () => {
  it('requires mobile authentication without granting admin upload rights', async () => {
    const upload = mock.method(mediaService, 'uploadMobileAvatar', async () => ({ avatarUrl: 'https://api.example.test/avatar' }));
    assert.equal((await app().request('/auth/mobile/avatar', { method: 'POST', body: form() })).status, 401);
    assert.equal((await app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers('admin'), body: form() })).status, 403);
    assert.equal(upload.mock.callCount(), 0);
  });

  it('passes only the signed-in owner and selected file to the upload helper', async () => {
    const upload = mock.method(mediaService, 'uploadMobileAvatar', async () => ({ avatarUrl: 'https://api.example.test/v1/media/file/public-media/stable-avatar' }));
    const data = form(); data.set('ownerId', 'another-user');
    const response = await app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers(), body: data });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { avatarUrl: 'https://api.example.test/v1/media/file/public-media/stable-avatar' });
    assert.equal(upload.mock.calls[0]!.arguments[0].sub, USER);
    assert.deepEqual(upload.mock.calls[0]!.arguments[1], { bytes: PNG, contentType: 'image/png', filename: 'photo.png' });
  });

  it('rejects missing, duplicate, malformed, and oversized multipart files before storage', async () => {
    const upload = mock.method(mediaService, 'uploadMobileAvatar', async () => ({ avatarUrl: 'https://api.example.test/avatar' }));
    const duplicate = form(); duplicate.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'other.png');
    const responses = await Promise.all([
      app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers(), body: new FormData() }),
      app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers(), body: duplicate }),
      app().request('/auth/mobile/avatar', { method: 'POST', headers: { ...await headers(), 'Content-Type': 'application/json' }, body: '{}' }),
      app().request('/auth/mobile/avatar', { method: 'POST', headers: { ...await headers(), 'Content-Type': 'multipart/form-data' }, body: 'missing boundary' }),
      app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers(), body: form(Buffer.alloc(MAX_AVATAR_BYTES + 1)) }),
    ]);
    assert.ok(responses.every(response => response.status === 400));
    const bodyLimit = await app().request('/auth/mobile/avatar', { method: 'POST', headers: await headers(), body: form(Buffer.alloc(MAX_AVATAR_BYTES + 128 * 1024)) });
    assert.equal(bodyLimit.status, 413);
    assert.equal(upload.mock.callCount(), 0);
  });
});

describe('mobile avatar validation and storage', () => {
  it('accepts actual JPEG, PNG, and WebP bytes with dimensions and checksum', () => {
    for (const [bytes, mime] of [[PNG, 'image/png'], [JPEG, 'image/jpeg'], [WEBP, 'image/webp'], [JPEG, 'image/jpg']] as const) {
      const result = validateAvatarUpload(bytes, mime);
      assert.equal(result.width, 1); assert.equal(result.height, 1);
      assert.equal(result.mimeType, mime === 'image/jpg' ? 'image/jpeg' : mime);
      assert.equal(result.byteSize, bytes.length); assert.match(result.checksumSha256, /^[a-f0-9]{64}$/);
    }
  });

  it('rejects spoofed types, arbitrary bytes, empty files, oversized files, and truncated images', () => {
    for (const [bytes, mime] of [[PNG, 'image/jpeg'], [PNG, 'image/gif'], [Buffer.from('<script>bad()</script>'), 'image/png'], [PNG.subarray(0, 20), 'image/png'], [JPEG.subarray(0, -2), 'image/jpeg'], [WEBP.subarray(0, -1), 'image/webp']] as const) {
      assert.throws(() => validateAvatarUpload(bytes, mime), { status: 400 });
    }
    assert.throws(() => validateAvatarUpload(Buffer.alloc(0), 'image/png'), { code: 'empty_upload' });
    assert.throws(() => validateAvatarUpload(Buffer.alloc(MAX_AVATAR_BYTES + 1), 'image/png'), { code: 'file_too_large' });
    const huge = Buffer.from(PNG); huge.writeUInt32BE(10001, 16);
    assert.throws(() => validateAvatarUpload(huge, 'image/png'), { code: 'invalid_image' });
  });

  it('rejects missing/inactive users and non-mobile identities without any storage write', async () => {
    process.env.MEDIA_STORAGE = 'local';
    const dbCalls = mockDatabase(false);
    const put = mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => {});
    const service = new MediaService();
    for (const session of [auth, { ...auth, sub: 'temporary-guest' }, { ...auth, kind: 'admin' as const }]) {
      await assert.rejects(service.uploadMobileAvatar(session, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' }), { status: 403 });
    }
    assert.equal(put.mock.callCount(), 0); assert.equal(dbCalls.create.mock.callCount(), 0);
  });

  it('stores a local avatar under its owner and returns a durable URL without changing the profile', async () => {
    process.env.MEDIA_STORAGE = 'local'; process.env.API_PUBLIC_URL = 'http://localhost:4000';
    const dbCalls = mockDatabase();
    const put = mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => {});
    const result = await new MediaService().uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: '../photo.png' });
    const values = dbCalls.create.mock.calls[0]!.arguments[0];
    const upload = put.mock.calls[0]!.arguments[0];
    assert.match(upload.key, new RegExp(`^public/avatars/${USER}/[a-f0-9-]+/original\\.png$`));
    assert.equal(upload.bucket, 'public-media'); assert.deepEqual(upload.body, PNG);
    assert.equal(values.createdBy, null); assert.equal(values.originalFilename, 'photo.png');
    assert.equal(values.storageProvider, 'local'); assert.equal(values.processingStatus, 'uploading');
    assert.equal(dbCalls.update.mock.calls.at(-1)!.arguments[1].processingStatus, 'ready');
    assert.equal(dbCalls.profileWrite.mock.callCount(), 0);
    const url = new URL(result.avatarUrl);
    assert.equal(url.origin, 'http://localhost:4000'); assert.equal(url.search, '');
    assert.equal(decodeURIComponent(url.pathname), `/v1/media/file/public-media/${upload.key}`);
  });

  it('uses the existing R2 public bucket and propagates cancellation without returning a signed URL', async () => {
    process.env.MEDIA_STORAGE = 'r2'; process.env.R2_ACCOUNT_ID = 'test-avatar-account';
    process.env.R2_ACCESS_KEY_ID = 'test-avatar-key'; process.env.R2_SECRET_ACCESS_KEY = 'test-avatar-secret';
    process.env.R2_BUCKET_PUBLIC = 'test-avatar-bucket'; process.env.API_PUBLIC_URL = 'https://api.example.test';
    const dbCalls = mockDatabase();
    const send = mock.method(S3Client.prototype, 'send', async () => ({}));
    const result = await new MediaService().uploadMobileAvatar(auth, { bytes: WEBP, contentType: 'image/webp', filename: 'photo.webp' });
    const command = send.mock.calls[0]!.arguments[0] as PutObjectCommand;
    assert.ok(command instanceof PutObjectCommand); assert.equal(command.input.Bucket, 'test-avatar-bucket');
    assert.match(command.input.Key!, new RegExp(`^public/avatars/${USER}/`));
    assert.ok((send.mock.calls[0]!.arguments[1] as { abortSignal: AbortSignal }).abortSignal instanceof AbortSignal);
    assert.equal(new URL(result.avatarUrl).origin, 'https://api.example.test');
    assert.equal(new URL(result.avatarUrl).search, ''); assert.equal(dbCalls.profileWrite.mock.callCount(), 0);
  });

  it('marks a failed storage upload unavailable and never returns a usable avatar URL', async () => {
    process.env.MEDIA_STORAGE = 'local';
    const dbCalls = mockDatabase();
    mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => { throw new Error('Storage unavailable'); });
    const cleanup = mock.method(LocalObjectStorageProvider.prototype, 'deleteObject', async () => {});
    await assert.rejects(new MediaService().uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' }), /Storage unavailable/);
    assert.equal(dbCalls.update.mock.calls.at(-1)!.arguments[1].processingStatus, 'failed');
    assert.equal(cleanup.mock.callCount(), 1); assert.equal(dbCalls.profileWrite.mock.callCount(), 0);
  });

  it('aborts a stalled storage upload after 40 seconds and keeps the asset unavailable', async () => {
    process.env.MEDIA_STORAGE = 'local';
    const dbCalls = mockDatabase();
    const put = mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => new Promise<void>(() => {}));
    mock.method(LocalObjectStorageProvider.prototype, 'deleteObject', async () => {});
    mock.timers.enable({ apis: ['setTimeout'] });
    const uploading = new MediaService().uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' });
    const failed = assert.rejects(uploading, { status: 408, code: 'upload_timeout' });
    await flush();
    assert.equal(put.mock.callCount(), 1);
    mock.timers.tick(40000);
    await failed;
    assert.equal(put.mock.calls[0]!.arguments[0].signal!.aborted, true);
    assert.equal(dbCalls.update.mock.calls.at(-1)!.arguments[1].processingStatus, 'failed');
    assert.equal(dbCalls.profileWrite.mock.callCount(), 0);
  });

  it('profile-save validation rejects device/base64/credential URLs and accepts stable HTTP URLs or removal', () => {
    const profile = { displayName: 'Member', bio: null, location: null, website: null };
    for (const avatarUrl of ['not a URL', 'file:///private/photo.jpg', 'content://images/photo', 'data:image/png;base64,AQID', 'https://secret:password@example.test/photo']) {
      assert.equal(UpdateMobileProfileRequestSchema.safeParse({ ...profile, avatarUrl }).success, false);
    }
    for (const avatarUrl of [null, 'https://api.example.test/v1/media/file/public-media/stable-photo']) {
      assert.equal(UpdateMobileProfileRequestSchema.safeParse({ ...profile, avatarUrl }).success, true);
    }
  });

  it('returns the original storage failure even when failed-asset cleanup rejects or never resolves', async () => {
    process.env.MEDIA_STORAGE = 'local';
    mockDatabase();
    const mark = mock.method(mediaRepository, 'updateAsset', async () => { throw new Error('Database cleanup failed'); });
    mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => { throw new Error('Original storage failure'); });
    const cleanup = mock.method(LocalObjectStorageProvider.prototype, 'deleteObject', async () => {});
    const service = new MediaService();
    await assert.rejects(service.uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' }), /Original storage failure/);
    assert.equal(cleanup.mock.callCount(), 1);
    mark.mock.mockImplementation(async () => new Promise(() => {}));
    await assert.rejects(service.uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' }), /Original storage failure/);
    assert.equal(cleanup.mock.callCount(), 2);
  });

  it('cleans an abandoned object again if its write finishes after the upload deadline', async () => {
    process.env.MEDIA_STORAGE = 'local';
    const dbCalls = mockDatabase();
    let finish!: () => void;
    mock.method(LocalObjectStorageProvider.prototype, 'putObject', async () => new Promise<void>(resolve => { finish = resolve; }));
    const cleanup = mock.method(LocalObjectStorageProvider.prototype, 'deleteObject', async () => {});
    mock.timers.enable({ apis: ['setTimeout'] });
    const failed = assert.rejects(new MediaService().uploadMobileAvatar(auth, { bytes: PNG, contentType: 'image/png', filename: 'photo.png' }), { status: 408 });
    await flush();
    mock.timers.tick(40000);
    await failed;
    assert.equal(cleanup.mock.callCount(), 1);
    finish(); await flush();
    assert.equal(cleanup.mock.callCount(), 2, 'a late successful PUT receives another cleanup');
    assert.ok(dbCalls.update.mock.calls.every(call => call.arguments[1].processingStatus === 'failed'));
    assert.equal(dbCalls.profileWrite.mock.callCount(), 0);
  });
});

describe('saved mobile avatar usage', () => {
  const MEDIA = '149452d5-556c-4629-8d73-31461e70ef80';
  const OTHER = 'e9aa24ec-8d7f-42f0-af6a-315216b29a8d';
  const key = `public/avatars/${USER}/${MEDIA}/original.png`;
  const avatarUrl = `http://localhost:4000/v1/media/file/public-media/${encodeURIComponent(key)}`;

  function transaction(asset: { id: string } | null = { id: MEDIA }) {
    const calls = { selected: 0, removed: 0, attached: [] as Record<string, unknown>[], order: [] as string[] };
    return {
      calls,
      tx: {
        select() { calls.selected += 1; return { from: () => ({ where: () => ({ limit: () => ({ for: async () => asset ? [asset] : [] }) }) }) }; },
        delete() { return { where: async () => { calls.removed += 1; calls.order.push('remove'); } }; },
        insert() { return { values: async (value: Record<string, unknown>) => { calls.attached.push(value); calls.order.push('attach'); } }; },
      } as any,
    };
  }

  it('recognizes managed stable URLs while leaving external and default image URLs unmanaged', () => {
    assert.deepEqual(managedAvatarReference(avatarUrl, 'http://localhost:4000'), { ownerId: USER, mediaId: MEDIA, key });
    assert.equal(managedAvatarReference(null, 'http://localhost:4000'), null);
    assert.equal(managedAvatarReference('https://example.test/default-avatar.png', 'http://localhost:4000'), null);
    assert.equal(managedAvatarReference('http://localhost:4000/v1/media/file/public-media/default.png', 'http://localhost:4000'), null);
    assert.equal(managedAvatarReference(avatarUrl.replace(MEDIA, '-'.repeat(36)), 'http://localhost:4000'), null);
  });

  it('replaces only the authenticated user profile slot with the confirmed avatar asset', async () => {
    process.env.API_PUBLIC_URL = 'http://localhost:4000';
    const state = transaction();
    await new MediaService().replaceMobileAvatarUsage(auth, avatarUrl, state.tx);
    assert.equal(state.calls.selected, 1);
    assert.equal(state.calls.removed, 1);
    assert.deepEqual(state.calls.order, ['remove', 'attach']);
    assert.deepEqual(state.calls.attached, [{ mediaId: MEDIA, entityType: 'MOBILE_USER', entityId: USER, usageType: 'PROFILE', sortOrder: 0 }]);
  });

  it('releases the managed profile slot on removal or an external/default avatar without attaching foreign media', async () => {
    process.env.API_PUBLIC_URL = 'http://localhost:4000';
    for (const value of [null, 'https://example.test/default-avatar.png']) {
      const state = transaction();
      await new MediaService().replaceMobileAvatarUsage(auth, value, state.tx);
      assert.equal(state.calls.selected, 0);
      assert.equal(state.calls.removed, 1);
      assert.deepEqual(state.calls.attached, []);
    }
  });

  it('rejects foreign, unavailable, or admin-managed avatar changes before replacing existing usage', async () => {
    process.env.API_PUBLIC_URL = 'http://localhost:4000';
    const service = new MediaService();
    for (const [session, value, asset, status] of [
      [auth, avatarUrl.replace(USER, OTHER), { id: MEDIA }, 403],
      [auth, avatarUrl, null, 409],
      [{ ...auth, kind: 'admin' as const }, avatarUrl, { id: MEDIA }, 403],
    ] as const) {
      const state = transaction(asset);
      await assert.rejects(service.replaceMobileAvatarUsage(session, value, state.tx), { status });
      assert.equal(state.calls.removed, 0);
      assert.deepEqual(state.calls.attached, []);
    }
  });
});
