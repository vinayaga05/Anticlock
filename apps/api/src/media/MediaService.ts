import type {
  AttachMediaUsageRequest,
  CreateUploadSessionRequest,
  MediaAccessLevel,
  MediaAsset,
  MediaKind,
  MediaUsage,
} from '@anticlock/contracts';
import { writeAudit } from '../lib/audit.js';
import type { AuthClaims } from '../lib/auth.js';
import { LocalObjectStorageProvider } from './LocalObjectStorageProvider.js';
import { mediaAccessPolicy } from './MediaAccessPolicy.js';
import { mediaRepository } from './MediaRepository.js';
import {
  bucketForAccess,
  extensionForMime,
  type ObjectStorageProvider,
} from './ObjectStorageProvider.js';
import { R2ObjectStorageProvider } from './R2ObjectStorageProvider.js';
import {
  assertAllowedMime,
  maxBytesForKind,
  validateUploadedBytes,
} from './validateUpload.js';

function createStorage(): ObjectStorageProvider {
  const mode = (process.env.MEDIA_STORAGE ?? 'local').toLowerCase();
  if (mode === 'r2') return new R2ObjectStorageProvider();
  return new LocalObjectStorageProvider();
}

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

export class MediaService {
  private storage = createStorage();
  private repo = mediaRepository;

  private async mapAsset(
    row: NonNullable<Awaited<ReturnType<typeof mediaRepository.getAsset>>>,
    extras?: { usageCount?: number; createdByName?: string | null },
  ): Promise<MediaAsset> {
    const deliveryUrl =
      row.processingStatus === 'ready'
        ? row.storageProvider === 'stream' || row.storageProvider === 'external'
          ? row.thumbnailUrl ??
            (row.storageProvider === 'external' ? row.storageKey : null)
          : await this.storage.createDownloadUrl({
              bucket: row.bucket as 'public-media' | 'private-documents',
              key: row.storageKey,
              accessLevel: row.accessLevel as MediaAccessLevel,
            })
        : null;

    return {
      id: row.id,
      kind: row.kind as MediaKind,
      storageProvider: row.storageProvider as MediaAsset['storageProvider'],
      storageKey: row.storageKey,
      bucket: row.bucket,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      checksumSha256: row.checksumSha256,
      originalFilename: row.originalFilename,
      accessLevel: row.accessLevel as MediaAccessLevel,
      processingStatus: row.processingStatus as MediaAsset['processingStatus'],
      moderationStatus: row.moderationStatus as MediaAsset['moderationStatus'],
      externalId: row.externalId ?? null,
      durationMs: row.durationMs ?? null,
      thumbnailUrl: row.thumbnailUrl ?? null,
      createdBy: row.createdBy,
      createdByName: extras?.createdByName ?? null,
      createdAt: row.createdAt.toISOString(),
      archivedAt: toIso(row.archivedAt),
      deletedAt: toIso(row.deletedAt),
      usageCount: extras?.usageCount,
      deliveryUrl,
    };
  }

  async createUploadSession(auth: AuthClaims, body: CreateUploadSessionRequest) {
    mediaAccessPolicy.require(auth, 'media.write');
    assertAllowedMime(body.kind, body.contentType);
    const maxBytes = Math.min(body.byteSize, maxBytesForKind(body.kind));
    if (body.byteSize > maxBytesForKind(body.kind)) {
      throw Object.assign(new Error('File exceeds max size'), {
        code: 'file_too_large',
        status: 400,
      });
    }

    const accessLevel = body.accessLevel ?? 'public';
    const bucket = bucketForAccess(accessLevel);
    const ext = extensionForMime(body.contentType);
    const hint = (body.entityHint ?? 'uploads').replace(/[^a-zA-Z0-9_-]/g, '');

    const asset = await this.repo.createAsset({
      kind: body.kind,
      storageProvider: this.storage.name,
      storageKey: 'pending',
      bucket,
      mimeType: body.contentType,
      byteSize: body.byteSize,
      originalFilename: body.filename,
      accessLevel,
      processingStatus: 'initiated',
      moderationStatus: 'not_required',
      createdBy: auth.sub,
    });

    const storageKey = `${accessLevel}/${hint}/${asset.id}/original.${ext}`;
    await this.repo.updateAsset(asset.id, {
      storageKey,
      processingStatus: 'uploading',
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const session = await this.repo.createSession({
      mediaId: asset.id,
      createdBy: auth.sub,
      expiresAt,
      status: 'open',
      expectedMime: body.contentType,
      maxBytes,
    });

    const target = await this.storage.createUploadTarget({
      bucket,
      key: storageKey,
      contentType: body.contentType,
      maxBytes,
      sessionId: session.id,
    });

    return {
      sessionId: session.id,
      mediaId: asset.id,
      uploadUrl: target.uploadUrl,
      headers: target.headers,
      storageKey,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async putLocalContent(auth: AuthClaims, sessionId: string, body: Buffer) {
    mediaAccessPolicy.require(auth, 'media.write');
    const session = await this.repo.getSession(sessionId);
    if (!session || session.status !== 'open') {
      throw Object.assign(new Error('Upload session not found'), {
        code: 'session_not_found',
        status: 404,
      });
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.repo.updateSession(sessionId, { status: 'expired' });
      throw Object.assign(new Error('Upload session expired'), {
        code: 'session_expired',
        status: 410,
      });
    }
    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset) {
      throw Object.assign(new Error('Media asset missing'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (body.length > session.maxBytes) {
      throw Object.assign(new Error('File exceeds max size'), {
        code: 'file_too_large',
        status: 400,
      });
    }
    await this.storage.putObject({
      bucket: asset.bucket as 'public-media' | 'private-documents',
      key: asset.storageKey,
      body,
      contentType: session.expectedMime,
    });
    await this.repo.updateAsset(asset.id, { processingStatus: 'uploaded' });
    return { ok: true };
  }

  async completeUpload(
    auth: AuthClaims,
    sessionId: string,
    clientChecksum?: string,
  ) {
    mediaAccessPolicy.require(auth, 'media.write');
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error('Upload session not found'), {
        code: 'session_not_found',
        status: 404,
      });
    }
    if (session.status === 'completed') {
      const existing = await this.repo.getAsset(session.mediaId);
      if (!existing) throw Object.assign(new Error('Not found'), { status: 404 });
      return {
        asset: await this.mapAsset(existing),
        duplicateOf: null as MediaAsset | null,
      };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.repo.updateSession(sessionId, { status: 'expired' });
      throw Object.assign(new Error('Upload session expired'), {
        code: 'session_expired',
        status: 410,
      });
    }

    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset) {
      throw Object.assign(new Error('Media asset missing'), {
        code: 'not_found',
        status: 404,
      });
    }

    const meta = await this.storage.verifyObject({
      bucket: asset.bucket as 'public-media' | 'private-documents',
      key: asset.storageKey,
    });
    if (!meta) {
      await this.repo.updateAsset(asset.id, { processingStatus: 'failed' });
      await this.repo.updateSession(sessionId, { status: 'failed' });
      throw Object.assign(new Error('Uploaded object not found'), {
        code: 'upload_missing',
        status: 400,
      });
    }

    await this.repo.updateAsset(asset.id, { processingStatus: 'processing' });

    let body: Buffer;
    try {
      body = await this.storage.getObjectBuffer({
        bucket: asset.bucket as 'public-media' | 'private-documents',
        key: asset.storageKey,
      });
    } catch {
      await this.repo.updateAsset(asset.id, { processingStatus: 'failed' });
      await this.repo.updateSession(sessionId, { status: 'failed' });
      throw Object.assign(new Error('Unable to read uploaded object'), {
        code: 'upload_unreadable',
        status: 400,
      });
    }

    try {
      const validated = validateUploadedBytes({
        kind: asset.kind as MediaKind,
        expectedMime: session.expectedMime,
        maxBytes: session.maxBytes,
        body,
      });

      if (clientChecksum && clientChecksum !== validated.checksumSha256) {
        throw Object.assign(new Error('Checksum mismatch'), {
          code: 'checksum_mismatch',
          status: 400,
        });
      }

      const duplicate = await this.repo.findByChecksum(validated.checksumSha256);
      const duplicateOf =
        duplicate && duplicate.id !== asset.id
          ? await this.mapAsset(duplicate)
          : null;

      const updated = await this.repo.updateAsset(asset.id, {
        mimeType: validated.mimeType,
        byteSize: validated.byteSize,
        width: validated.width,
        height: validated.height,
        checksumSha256: validated.checksumSha256,
        processingStatus: 'ready',
        moderationStatus: 'approved',
      });
      await this.repo.updateSession(sessionId, { status: 'completed' });

      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email,
        action: 'media.upload_complete',
        entityType: 'media_asset',
        entityId: asset.id,
        metadata: {
          checksum: validated.checksumSha256,
          duplicateOf: duplicateOf?.id ?? null,
        },
      });

      return {
        asset: await this.mapAsset(updated!),
        duplicateOf,
      };
    } catch (err) {
      await this.repo.updateAsset(asset.id, { processingStatus: 'failed' });
      await this.repo.updateSession(sessionId, { status: 'failed' });
      throw err;
    }
  }

  async list(auth: AuthClaims, filters: {
    q?: string;
    kind?: string;
    status?: string;
    accessLevel?: string;
    limit: number;
  }) {
    mediaAccessPolicy.require(auth, 'media.read');
    const rows = await this.repo.listAssets(filters);
    const data = await Promise.all(
      rows.map(r =>
        this.mapAsset(r.asset, {
          usageCount: Number(r.usageCount ?? 0),
          createdByName: r.createdByName,
        }),
      ),
    );
    return { data, meta: { nextCursor: null as string | null } };
  }

  async get(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, 'media.read');
    const asset = await this.repo.getAsset(id);
    if (!asset || asset.archivedAt) {
      // still allow viewing archived
    }
    if (!asset) {
      throw Object.assign(new Error('Not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    const usages = await this.repo.listUsages(id);
    const usageDtos: MediaUsage[] = await Promise.all(
      usages.map(async u => ({
        id: u.id,
        mediaId: u.mediaId,
        entityType: u.entityType as MediaUsage['entityType'],
        entityId: u.entityId,
        usageType: u.usageType as MediaUsage['usageType'],
        sortOrder: u.sortOrder,
        createdAt: u.createdAt.toISOString(),
        entityLabel: await this.repo.resolveEntityLabel(u.entityType, u.entityId),
      })),
    );
    return {
      asset: await this.mapAsset(asset, { usageCount: usages.length }),
      usages: usageDtos,
    };
  }

  async archive(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, 'media.write');
    const asset = await this.repo.getAsset(id);
    if (!asset) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    const updated = await this.repo.updateAsset(id, { archivedAt: new Date() });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'media.archive',
      entityType: 'media_asset',
      entityId: id,
    });
    return this.mapAsset(updated!);
  }

  async delete(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, 'media.delete');
    const asset = await this.repo.getAsset(id);
    if (!asset) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    const usageCount = await this.repo.usageCount(id);
    if (usageCount > 0) {
      throw Object.assign(
        new Error('Cannot delete media while it is in use'),
        { code: 'in_use', status: 409 },
      );
    }
    await this.storage.deleteObject({
      bucket: asset.bucket as 'public-media' | 'private-documents',
      key: asset.storageKey,
    });
    await this.repo.updateAsset(id, {
      deletedAt: new Date(),
      processingStatus: 'deleted',
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'media.delete',
      entityType: 'media_asset',
      entityId: id,
    });
    return { ok: true };
  }

  async attachUsage(auth: AuthClaims, body: AttachMediaUsageRequest) {
    mediaAccessPolicy.require(auth, 'media.write');
    const asset = await this.repo.getAsset(body.mediaId);
    if (!asset || asset.processingStatus !== 'ready') {
      throw Object.assign(new Error('Media not ready'), {
        code: 'media_not_ready',
        status: 400,
      });
    }
    // For PROFILE/HERO, replace prior attachments of same slot on entity
    if (body.usageType === 'PROFILE' || body.usageType === 'HERO') {
      await this.repo.replaceEntityUsages(
        body.entityType,
        body.entityId,
        body.usageType,
        [body.mediaId],
      );
    } else {
      await this.repo.attachUsage({
        mediaId: body.mediaId,
        entityType: body.entityType,
        entityId: body.entityId,
        usageType: body.usageType,
        sortOrder: body.sortOrder ?? 0,
      });
    }
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'media.usage_attach',
      entityType: body.entityType,
      entityId: body.entityId,
      metadata: { mediaId: body.mediaId, usageType: body.usageType },
    });
    return { ok: true };
  }

  async setGallery(auth: AuthClaims, productId: string, mediaIds: string[]) {
    mediaAccessPolicy.require(auth, 'media.write');
    for (const id of mediaIds) {
      const a = await this.repo.getAsset(id);
      if (!a || a.processingStatus !== 'ready') {
        throw Object.assign(new Error(`Media ${id} not ready`), { status: 400 });
      }
    }
    await this.repo.replaceEntityUsages('PRODUCT', productId, 'GALLERY', mediaIds);
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'media.gallery_set',
      entityType: 'PRODUCT',
      entityId: productId,
      metadata: { mediaIds },
    });
    return { ok: true };
  }

  async detachUsage(auth: AuthClaims, usageId: string) {
    mediaAccessPolicy.require(auth, 'media.write');
    const usage = await this.repo.getUsage(usageId);
    if (!usage) {
      throw Object.assign(new Error('Not found'), { status: 404 });
    }
    await this.repo.detachUsage(usageId);
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'media.usage_detach',
      entityType: usage.entityType,
      entityId: usage.entityId,
      metadata: { mediaId: usage.mediaId },
    });
    return { ok: true };
  }

  async byChecksum(auth: AuthClaims, sha256: string) {
    mediaAccessPolicy.require(auth, 'media.read');
    const row = await this.repo.findByChecksum(sha256);
    return row ? await this.mapAsset(row) : null;
  }

  async getFileBuffer(bucket: string, key: string) {
    return this.storage.getObjectBuffer({
      bucket: bucket as 'public-media' | 'private-documents',
      key,
    });
  }

  async findAssetByKey(bucket: string, key: string) {
    const { mediaAssets } = await import('../db/schema.js');
    const { eq, and, isNull } = await import('drizzle-orm');
    const { db } = await import('../db/client.js');
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.bucket, bucket),
          eq(mediaAssets.storageKey, key),
          isNull(mediaAssets.deletedAt),
        ),
      );
    return row ?? null;
  }

  // --- stub domain helpers ---

  async listProviders(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, 'provider.read');
    const providers = await this.repo.listProviders();
    return Promise.all(
      providers.map(async p => {
        const usages = await this.repo.usagesForEntity('PROVIDER', p.id);
        const profile = usages.find(u => u.usageType === 'PROFILE');
        let profileDeliveryUrl: string | null = null;
        let profileMediaId: string | null = null;
        if (profile) {
          profileMediaId = profile.mediaId;
          const asset = await this.repo.getAsset(profile.mediaId);
          if (asset) {
            profileDeliveryUrl = await this.storage.createDownloadUrl({
              bucket: asset.bucket as 'public-media' | 'private-documents',
              key: asset.storageKey,
              accessLevel: asset.accessLevel as MediaAccessLevel,
            });
          }
        }
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          profileMediaId,
          profileDeliveryUrl,
        };
      }),
    );
  }

  async listProducts(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, 'orders.manage');
    const products = await this.repo.listProducts();
    return Promise.all(
      products.map(async p => {
        const usages = (await this.repo.usagesForEntity('PRODUCT', p.id))
          .filter(u => u.usageType === 'GALLERY')
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const gallery = await Promise.all(
          usages.map(async u => {
            const asset = await this.repo.getAsset(u.mediaId);
            const deliveryUrl = asset
              ? await this.storage.createDownloadUrl({
                  bucket: asset.bucket as 'public-media' | 'private-documents',
                  key: asset.storageKey,
                  accessLevel: asset.accessLevel as MediaAccessLevel,
                })
              : null;
            return {
              mediaId: u.mediaId,
              deliveryUrl,
              sortOrder: u.sortOrder,
            };
          }),
        );
        return { id: p.id, name: p.name, status: p.status, gallery };
      }),
    );
  }

  async listBanners(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, 'cms.read');
    const banners = await this.repo.listBanners();
    return Promise.all(
      banners.map(async b => {
        const usages = await this.repo.usagesForEntity('BANNER', b.id);
        const hero = usages.find(u => u.usageType === 'HERO');
        let heroDeliveryUrl: string | null = null;
        let heroMediaId: string | null = null;
        if (hero) {
          heroMediaId = hero.mediaId;
          const asset = await this.repo.getAsset(hero.mediaId);
          if (asset) {
            heroDeliveryUrl = await this.storage.createDownloadUrl({
              bucket: asset.bucket as 'public-media' | 'private-documents',
              key: asset.storageKey,
              accessLevel: asset.accessLevel as MediaAccessLevel,
            });
          }
        }
        return {
          id: b.id,
          title: b.title,
          status: b.status,
          heroMediaId,
          heroDeliveryUrl,
        };
      }),
    );
  }
}

export const mediaService = new MediaService();
