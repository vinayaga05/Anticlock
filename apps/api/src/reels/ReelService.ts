import type {
  CreateReelRequest,
  ImportStreamReelRequest,
  ReelAdmin,
  ReelFeedItem,
  ReelListQuery,
  UpdateReelRequest,
} from '@anticlock/contracts';
import { writeAudit } from '../lib/audit.js';
import type { AuthClaims } from '../lib/auth.js';
import {
  isStreamConfigured,
  requireVideoProvider,
  streamPlaybackUrl,
  streamThumbnailUrl,
} from '../media/CloudflareStreamVideoProvider.js';
import { mediaRepository } from '../media/MediaRepository.js';
import { reelRepository } from './ReelRepository.js';
import type { mediaAssets, reels } from '../db/schema.js';

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function requireCms(auth: AuthClaims, perm: 'cms.read' | 'cms.write') {
  if (!auth.permissions.includes(perm)) {
    throw Object.assign(new Error('Insufficient permissions'), {
      code: 'forbidden',
      status: 403,
    });
  }
}

function ctaFromRow(row: typeof reels.$inferSelect) {
  if (!row.ctaEntityType || !row.ctaEntityId) return null;
  return {
    entityType: row.ctaEntityType as
      | 'provider'
      | 'event'
      | 'course'
      | 'product'
      | 'service_category',
    entityId: row.ctaEntityId,
    ctaLabel: row.ctaLabel ?? undefined,
  };
}

function resolvePlayback(
  media: typeof mediaAssets.$inferSelect | null | undefined,
): { playbackUrl: string | null; posterUrl: string | null } {
  if (!media || media.processingStatus !== 'ready') {
    return { playbackUrl: null, posterUrl: media?.thumbnailUrl ?? null };
  }
  if (media.storageProvider === 'external') {
    return {
      playbackUrl: media.storageKey,
      posterUrl: media.thumbnailUrl,
    };
  }
  if (media.storageProvider === 'stream' && media.externalId) {
    return {
      playbackUrl: streamPlaybackUrl(media.externalId),
      posterUrl: media.thumbnailUrl ?? streamThumbnailUrl(media.externalId),
    };
  }
  return { playbackUrl: null, posterUrl: media.thumbnailUrl };
}

function mapAdmin(
  reel: typeof reels.$inferSelect,
  media: typeof mediaAssets.$inferSelect | null | undefined,
): ReelAdmin {
  const { playbackUrl, posterUrl } = resolvePlayback(media ?? null);
  return {
    id: reel.id,
    title: reel.title,
    caption: reel.caption,
    creatorName: reel.creatorName,
    category: reel.category,
    status: reel.status as ReelAdmin['status'],
    isSample: reel.isSample,
    likeCount: reel.likeCount,
    commentCount: reel.commentCount,
    saveCount: reel.saveCount,
    displayOrder: reel.displayOrder,
    mediaId: reel.mediaId,
    thumbnailMediaId: reel.thumbnailMediaId,
    cta: ctaFromRow(reel),
    mediaProcessingStatus: media?.processingStatus ?? null,
    mediaExternalId: media?.externalId ?? null,
    playbackUrl,
    posterUrl,
    createdAt: reel.createdAt.toISOString(),
    updatedAt: reel.updatedAt.toISOString(),
    publishedAt: toIso(reel.publishedAt),
  };
}

export class ReelService {
  private repo = reelRepository;

  streamEnabled() {
    return isStreamConfigured();
  }

  async listAdmin(auth: AuthClaims, query: ReelListQuery) {
    requireCms(auth, 'cms.read');
    const rows = await this.repo.list({
      status: query.status,
      isSample: query.isSample,
      q: query.q,
      limit: query.limit,
    });
    return rows.map(r => mapAdmin(r.reel, r.media));
  }

  async getAdmin(auth: AuthClaims, id: string) {
    requireCms(auth, 'cms.read');
    const row = await this.repo.getWithMedia(id);
    if (!row) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    return mapAdmin(row.reel, row.media);
  }

  async create(auth: AuthClaims, body: CreateReelRequest) {
    requireCms(auth, 'cms.write');

    let mediaId: string | null = null;
    if (body.externalPlaybackUrl) {
      const asset = await mediaRepository.createAsset({
        kind: 'video',
        storageProvider: 'external',
        storageKey: body.externalPlaybackUrl,
        bucket: 'external',
        mimeType: 'video/mp4',
        accessLevel: 'public',
        processingStatus: 'ready',
        moderationStatus: 'not_required',
        originalFilename: body.title,
        thumbnailUrl: body.externalPosterUrl ?? null,
        createdBy: auth.sub,
      });
      mediaId = asset.id;
    }

    const reel = await this.repo.create({
      title: body.title,
      caption: body.caption ?? null,
      creatorName: body.creatorName,
      category: body.category ?? null,
      status: 'draft',
      isSample: body.isSample ?? true,
      likeCount: body.likeCount ?? 0,
      commentCount: body.commentCount ?? 0,
      saveCount: body.saveCount ?? 0,
      displayOrder: body.displayOrder ?? 0,
      mediaId,
      ctaEntityType: body.cta?.entityType ?? null,
      ctaEntityId: body.cta?.entityId ?? null,
      ctaLabel: body.cta?.ctaLabel ?? null,
      createdBy: auth.sub,
    });

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.create',
      entityType: 'reel',
      entityId: reel.id,
      metadata: { title: reel.title, isSample: reel.isSample },
    });

    return this.getAdmin(auth, reel.id);
  }

  async update(auth: AuthClaims, id: string, body: UpdateReelRequest) {
    requireCms(auth, 'cms.write');
    const existing = await this.repo.getWithMedia(id);
    if (!existing) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (body.externalPlaybackUrl) {
      if (existing.media?.storageProvider === 'external') {
        await mediaRepository.updateAsset(existing.media.id, {
          storageKey: body.externalPlaybackUrl,
          thumbnailUrl:
            body.externalPosterUrl ?? existing.media.thumbnailUrl,
          processingStatus: 'ready',
        });
      } else {
        const asset = await mediaRepository.createAsset({
          kind: 'video',
          storageProvider: 'external',
          storageKey: body.externalPlaybackUrl,
          bucket: 'external',
          mimeType: 'video/mp4',
          accessLevel: 'public',
          processingStatus: 'ready',
          moderationStatus: 'not_required',
          originalFilename: body.title ?? existing.reel.title,
          thumbnailUrl: body.externalPosterUrl ?? null,
          createdBy: auth.sub,
        });
        await this.repo.update(id, { mediaId: asset.id });
      }
    }

    const patch: Partial<typeof reels.$inferInsert> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.caption !== undefined) patch.caption = body.caption;
    if (body.creatorName !== undefined) patch.creatorName = body.creatorName;
    if (body.category !== undefined) patch.category = body.category;
    if (body.isSample !== undefined) patch.isSample = body.isSample;
    if (body.likeCount !== undefined) patch.likeCount = body.likeCount;
    if (body.commentCount !== undefined) patch.commentCount = body.commentCount;
    if (body.saveCount !== undefined) patch.saveCount = body.saveCount;
    if (body.displayOrder !== undefined) patch.displayOrder = body.displayOrder;
    if (body.thumbnailMediaId !== undefined) {
      patch.thumbnailMediaId = body.thumbnailMediaId;
    }
    if (body.cta !== undefined) {
      patch.ctaEntityType = body.cta?.entityType ?? null;
      patch.ctaEntityId = body.cta?.entityId ?? null;
      patch.ctaLabel = body.cta?.ctaLabel ?? null;
    }

    const updated = await this.repo.update(id, patch);

    if (!updated) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.update',
      entityType: 'reel',
      entityId: id,
    });

    return this.getAdmin(auth, id);
  }

  async createUploadSession(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const provider = requireVideoProvider();
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const session = await provider.createUploadSession({
      meta: { name: reel.title, reelId },
    });

    const asset = await mediaRepository.createAsset({
      kind: 'video',
      storageProvider: 'stream',
      storageKey: `stream:${session.externalId}`,
      bucket: 'stream',
      mimeType: 'video/mp4',
      accessLevel: 'public',
      processingStatus: 'processing',
      moderationStatus: 'not_required',
      externalId: session.externalId,
      originalFilename: reel.title,
      createdBy: auth.sub,
    });

    await this.repo.update(reelId, { mediaId: asset.id });

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.upload_session',
      entityType: 'reel',
      entityId: reelId,
      metadata: { mediaId: asset.id, externalId: session.externalId },
    });

    return {
      reelId,
      mediaId: asset.id,
      uploadUrl: session.uploadUrl,
      externalId: session.externalId,
    };
  }

  async importStream(auth: AuthClaims, body: ImportStreamReelRequest) {
    requireCms(auth, 'cms.write');
    const provider = requireVideoProvider();
    const status = await provider.getStatus(body.streamUid);
    const playback = await provider.getPlayback(body.streamUid);

    let asset = await this.repo.findMediaByExternalId(body.streamUid);
    if (!asset) {
      asset = await mediaRepository.createAsset({
        kind: 'video',
        storageProvider: 'stream',
        storageKey: `stream:${body.streamUid}`,
        bucket: 'stream',
        mimeType: 'video/mp4',
        accessLevel: 'public',
        processingStatus:
          status.status === 'ready'
            ? 'ready'
            : status.status === 'error'
              ? 'failed'
              : 'processing',
        moderationStatus: 'not_required',
        externalId: body.streamUid,
        durationMs: status.durationMs ?? null,
        thumbnailUrl: playback.thumbnailUrl ?? null,
        originalFilename: body.title,
        createdBy: auth.sub,
      });
    }

    const reel = await this.repo.create({
      title: body.title,
      caption: body.caption ?? null,
      creatorName: body.creatorName,
      category: body.category ?? null,
      status: 'draft',
      isSample: body.isSample ?? true,
      likeCount: body.likeCount ?? 0,
      commentCount: body.commentCount ?? 0,
      saveCount: body.saveCount ?? 0,
      displayOrder: body.displayOrder ?? 0,
      mediaId: asset.id,
      ctaEntityType: body.cta?.entityType ?? null,
      ctaEntityId: body.cta?.entityId ?? null,
      ctaLabel: body.cta?.ctaLabel ?? null,
      createdBy: auth.sub,
    });

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.import_stream',
      entityType: 'reel',
      entityId: reel.id,
      metadata: { streamUid: body.streamUid },
    });

    return this.getAdmin(auth, reel.id);
  }

  async syncMedia(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const row = await this.repo.getWithMedia(reelId);
    if (!row?.media?.externalId || row.media.storageProvider !== 'stream') {
      throw Object.assign(new Error('Reel has no Stream media'), {
        code: 'no_stream_media',
        status: 400,
      });
    }
    const provider = requireVideoProvider();
    const status = await provider.getStatus(row.media.externalId);
    const playback = await provider.getPlayback(row.media.externalId);

    await mediaRepository.updateAsset(row.media.id, {
      processingStatus:
        status.status === 'ready'
          ? 'ready'
          : status.status === 'error'
            ? 'failed'
            : 'processing',
      durationMs: status.durationMs ?? row.media.durationMs,
      thumbnailUrl: playback.thumbnailUrl ?? row.media.thumbnailUrl,
    });

    return this.getAdmin(auth, reelId);
  }

  async publish(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const row = await this.repo.getWithMedia(reelId);
    if (!row) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (!row.media || row.media.processingStatus !== 'ready') {
      throw Object.assign(
        new Error('Video must be ready before publishing'),
        { code: 'media_not_ready', status: 400 },
      );
    }

    await this.repo.update(reelId, {
      status: 'published',
      publishedAt: new Date(),
    });

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.publish',
      entityType: 'reel',
      entityId: reelId,
    });

    return this.getAdmin(auth, reelId);
  }

  async unpublish(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    await this.repo.update(reelId, {
      status: 'draft',
      publishedAt: null,
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.unpublish',
      entityType: 'reel',
      entityId: reelId,
    });
    return this.getAdmin(auth, reelId);
  }

  async archive(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    await this.repo.update(reelId, { status: 'archived' });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.archive',
      entityType: 'reel',
      entityId: reelId,
    });
    return this.getAdmin(auth, reelId);
  }

  async listFeed(): Promise<ReelFeedItem[]> {
    const rows = await this.repo.listPublished(50);
    const items: ReelFeedItem[] = [];
    for (const r of rows) {
      const { playbackUrl, posterUrl } = resolvePlayback(r.media);
      if (!playbackUrl) continue;
      items.push({
        id: r.reel.id,
        title: r.reel.title,
        caption: r.reel.caption,
        creatorName: r.reel.creatorName,
        category: r.reel.category,
        playbackUrl,
        posterUrl,
        likeCount: r.reel.likeCount,
        commentCount: r.reel.commentCount,
        saveCount: r.reel.saveCount,
        cta: ctaFromRow(r.reel),
      });
    }
    return items;
  }
}

export const reelService = new ReelService();
