import {
  MAX_REEL_VIDEO_DURATION_MS,
  type CreateReelCommentRequest,
  type CreateReelReportRequest,
  type CreateReelRequest,
  type ImportStreamReelRequest,
  type Permission,
  type ReelAdmin,
  type ReelAnalyticsEventRequest,
  type ReelAnalyticsSummary,
  type ReelContentMode,
  type ReelFeedItem,
  type ReelListQuery,
  type ReelReportAdmin,
  type ReelReportListQuery,
  type ResolveReelReportRequest,
  type ReturnReelToDraftRequest,
  type SetReelLikeRequest,
  type UpdateReelRequest,
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
import { r2PublicDeliveryUrl } from '../media/R2ObjectStorageProvider.js';
import { reelEngagementRepository } from './ReelEngagementRepository.js';
import { reelRepository } from './ReelRepository.js';
import type { mediaAssets, reels } from '../db/schema.js';

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function requireCms(auth: AuthClaims, perm: Permission) {
  if (!auth.permissions.includes(perm)) {
    throw Object.assign(new Error('Insufficient permissions'), {
      code: 'forbidden',
      status: 403,
    });
  }
}

function requireMobileActor(auth: AuthClaims) {
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('A mobile session is required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  // OTP sessions carry a phone in `email`; anonymous/device sessions do not.
  return {
    key: auth.sub,
    kind: (auth.email ? 'mobile_user' : 'device') as 'mobile_user' | 'device',
  };
}

function contentModeFromInput(input: {
  contentMode?: ReelContentMode;
  isSample?: boolean;
}): ReelContentMode {
  if (input.contentMode) return input.contentMode;
  return input.isSample === false ? 'standard' : 'sample';
}

type MediaAssetRow = typeof mediaAssets.$inferSelect;

function assertReelMediaEligible(media: MediaAssetRow) {
  if (
    media.kind !== 'video' ||
    media.mimeType?.split(';', 1)[0] !== 'video/mp4'
  ) {
    throw Object.assign(new Error('Reels require a ready MP4 video'), {
      code: 'invalid_reel_media',
      status: 400,
    });
  }
  if (media.processingStatus !== 'ready') {
    throw Object.assign(
      new Error('Video must be ready before it can be used'),
      {
        code: 'media_not_ready',
        status: 400,
      },
    );
  }
  if (media.deletedAt || media.archivedAt) {
    throw Object.assign(new Error('Video is no longer available'), {
      code: 'media_unavailable',
      status: 400,
    });
  }
  if (media.accessLevel !== 'public') {
    throw Object.assign(new Error('Reel video must be publicly deliverable'), {
      code: 'media_not_public',
      status: 400,
    });
  }
  if (
    media.moderationStatus !== 'approved' &&
    media.moderationStatus !== 'not_required'
  ) {
    throw Object.assign(
      new Error('Video is awaiting or has failed moderation review'),
      {
        code: 'media_not_moderated',
        status: 400,
      },
    );
  }
  if (!media.durationMs || media.durationMs > MAX_REEL_VIDEO_DURATION_MS) {
    throw Object.assign(new Error('Reel videos must be 3 minutes or shorter'), {
      code: 'video_too_long',
      status: 400,
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
  if (media.storageProvider === 'r2' && media.accessLevel === 'public') {
    return {
      playbackUrl: r2PublicDeliveryUrl(media.storageKey),
      posterUrl: media.thumbnailUrl,
    };
  }
  if (media.storageProvider === 'local' && media.accessLevel === 'public') {
    const base = (
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.API_PORT ?? 4000}`
    ).replace(/\/$/, '');
    return {
      playbackUrl: `${base}/v1/media/file/${media.bucket}/${encodeURIComponent(
        media.storageKey,
      )}`,
      posterUrl: media.thumbnailUrl,
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
    contentMode: reel.contentMode as ReelAdmin['contentMode'],
    moderationStatus: reel.moderationStatus as ReelAdmin['moderationStatus'],
    isSample: reel.contentMode === 'sample',
    likeCount: reel.likeCount,
    commentCount: reel.commentCount,
    saveCount: reel.saveCount,
    viewCount: reel.viewCount,
    completionCount: reel.completionCount,
    completionRate:
      reel.viewCount > 0 ? reel.completionCount / reel.viewCount : 0,
    reportCount: reel.reportCount,
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
    submittedForReviewAt: toIso(reel.submittedForReviewAt),
    reviewedAt: toIso(reel.reviewedAt),
  };
}

function mapReport(
  report: {
    id: string;
    reelId: string;
    reporterKey: string;
    reporterKind: string;
    reason: string;
    details: string | null;
    status: string;
    resolutionAction: string | null;
    resolutionNote: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  },
  reelTitle: string,
): ReelReportAdmin {
  return {
    id: report.id,
    reelId: report.reelId,
    reelTitle,
    reporterKey: report.reporterKey,
    reporterKind: report.reporterKind as ReelReportAdmin['reporterKind'],
    reason: report.reason as ReelReportAdmin['reason'],
    details: report.details,
    status: report.status as ReelReportAdmin['status'],
    resolutionAction:
      report.resolutionAction as ReelReportAdmin['resolutionAction'],
    resolutionNote: report.resolutionNote,
    createdAt: report.createdAt.toISOString(),
    resolvedAt: toIso(report.resolvedAt),
  };
}

export class ReelService {
  private repo = reelRepository;

  private async requireReadyReelMedia(mediaId: string) {
    const media = await mediaRepository.getAsset(mediaId);
    if (!media) {
      throw Object.assign(new Error('Video not found'), {
        code: 'media_not_found',
        status: 404,
      });
    }
    assertReelMediaEligible(media);
    return media;
  }

  private async setVideoUsage(reelId: string, mediaId: string | null) {
    await mediaRepository.replaceEntityUsages(
      'REEL',
      reelId,
      'VIDEO',
      mediaId ? [mediaId] : [],
    );
  }

  streamEnabled() {
    return isStreamConfigured();
  }

  async listAdmin(auth: AuthClaims, query: ReelListQuery) {
    requireCms(auth, 'cms.read');
    const rows = await this.repo.list({
      status: query.status,
      contentMode: query.contentMode,
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

    const contentMode = contentModeFromInput(body);

    let mediaId: string | null = null;
    if (body.mediaId && body.externalPlaybackUrl) {
      throw Object.assign(
        new Error('Choose a Media Library video or an external URL, not both'),
        { code: 'invalid_reel_media', status: 400 },
      );
    }
    if (body.mediaId) {
      await this.requireReadyReelMedia(body.mediaId);
      mediaId = body.mediaId;
    }
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
      contentMode,
      moderationStatus: 'clear',
      isSample: contentMode === 'sample',
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

    if (mediaId) {
      await this.setVideoUsage(reel.id, mediaId);
    }

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

    if (
      existing.reel.status !== 'draft' &&
      (
        body.mediaId !== undefined ||
        body.externalPlaybackUrl !== undefined ||
        body.contentMode !== undefined ||
        body.isSample !== undefined
      )
    ) {
      throw Object.assign(
        new Error('Return this Reel to Draft before changing its video or mode'),
        { code: 'reel_not_editable', status: 409 },
      );
    }
    if (body.mediaId !== undefined && body.externalPlaybackUrl) {
      throw Object.assign(
        new Error('Choose a Media Library video or an external URL, not both'),
        { code: 'invalid_reel_media', status: 400 },
      );
    }

    let replacementMediaId: string | null | undefined;
    if (body.mediaId !== undefined) {
      if (body.mediaId) await this.requireReadyReelMedia(body.mediaId);
      replacementMediaId = body.mediaId;
    }

    if (body.externalPlaybackUrl) {
      if (existing.media?.storageProvider === 'external') {
        await mediaRepository.updateAsset(existing.media.id, {
          storageKey: body.externalPlaybackUrl,
          thumbnailUrl: body.externalPosterUrl ?? existing.media.thumbnailUrl,
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
        replacementMediaId = asset.id;
      }
      replacementMediaId ??= existing.media?.id ?? null;
    }

    const patch: Partial<typeof reels.$inferInsert> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.caption !== undefined) patch.caption = body.caption;
    if (body.creatorName !== undefined) patch.creatorName = body.creatorName;
    if (body.category !== undefined) patch.category = body.category;
    const requestedContentMode =
      body.contentMode !== undefined || body.isSample !== undefined
        ? contentModeFromInput({
            contentMode: body.contentMode,
            isSample: body.isSample,
          })
        : undefined;
    if (requestedContentMode !== undefined) {
      patch.contentMode = requestedContentMode;
      patch.isSample = requestedContentMode === 'sample';
    }
    if (body.likeCount !== undefined) patch.likeCount = body.likeCount;
    if (body.commentCount !== undefined) patch.commentCount = body.commentCount;
    if (body.saveCount !== undefined) patch.saveCount = body.saveCount;
    if (body.displayOrder !== undefined) patch.displayOrder = body.displayOrder;
    if (body.thumbnailMediaId !== undefined) {
      patch.thumbnailMediaId = body.thumbnailMediaId;
    }
    if (replacementMediaId !== undefined) patch.mediaId = replacementMediaId;
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

    if (replacementMediaId !== undefined) {
      await this.setVideoUsage(id, replacementMediaId);
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
    if (reel.status !== 'draft') {
      throw Object.assign(
        new Error('Return this Reel to Draft before replacing its video'),
        { code: 'reel_not_editable', status: 409 },
      );
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
    await this.setVideoUsage(reelId, asset.id);

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
    const contentMode = contentModeFromInput(body);
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
      contentMode,
      moderationStatus: 'clear',
      isSample: contentMode === 'sample',
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
    await this.setVideoUsage(reel.id, asset.id);

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

  async submitForReview(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.write');
    const row = await this.repo.getWithMedia(reelId);
    if (!row) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (row.reel.status !== 'draft') {
      throw Object.assign(
        new Error('Only Draft Reels can be submitted for review'),
        { code: 'invalid_reel_transition', status: 409 },
      );
    }
    if (!row.media) {
      throw Object.assign(new Error('Attach a ready video before review'), {
        code: 'media_not_ready',
        status: 400,
      });
    }
    assertReelMediaEligible(row.media);
    if (!resolvePlayback(row.media).playbackUrl) {
      throw Object.assign(new Error('Video delivery is not configured'), {
        code: 'media_not_deliverable',
        status: 400,
      });
    }

    await this.repo.update(reelId, {
      status: 'in_review',
      submittedForReviewAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.submit_review',
      entityType: 'reel',
      entityId: reelId,
    });
    return this.getAdmin(auth, reelId);
  }

  async returnToDraft(
    auth: AuthClaims,
    reelId: string,
    body: ReturnReelToDraftRequest,
  ) {
    requireCms(auth, 'cms.write');
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (reel.status !== 'in_review') {
      throw Object.assign(
        new Error('Only Reels in review can return to Draft'),
        { code: 'invalid_reel_transition', status: 409 },
      );
    }
    await this.repo.update(reelId, { status: 'draft' });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: 'reel.return_to_draft',
      entityType: 'reel',
      entityId: reelId,
      metadata: body.note ? { note: body.note } : undefined,
    });
    return this.getAdmin(auth, reelId);
  }

  async publish(auth: AuthClaims, reelId: string) {
    requireCms(auth, 'cms.publish');
    const row = await this.repo.getWithMedia(reelId);
    if (!row) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (row.reel.status !== 'in_review') {
      throw Object.assign(
        new Error('Submit this Reel for review before publishing'),
        { code: 'invalid_reel_transition', status: 409 },
      );
    }
    if (row.reel.contentMode === 'test') {
      throw Object.assign(new Error('Test Reels cannot be published'), {
        code: 'test_reel_not_publishable',
        status: 400,
      });
    }
    if (row.reel.moderationStatus !== 'clear') {
      throw Object.assign(new Error('Resolve moderation before publishing'), {
        code: 'reel_under_moderation',
        status: 409,
      });
    }
    if (!row.media) {
      throw Object.assign(new Error('Video must be ready before publishing'), {
        code: 'media_not_ready',
        status: 400,
      });
    }
    assertReelMediaEligible(row.media);
    if (!resolvePlayback(row.media).playbackUrl) {
      throw Object.assign(new Error('Video delivery is not configured'), {
        code: 'media_not_deliverable',
        status: 400,
      });
    }

    await this.repo.update(reelId, {
      status: 'published',
      publishedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: auth.sub,
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
    requireCms(auth, 'cms.publish');
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (reel.status !== 'published') {
      throw Object.assign(new Error('Only published Reels can be unpublished'), {
        code: 'invalid_reel_transition',
        status: 409,
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
    // Archiving a live Reel removes it from the public feed, so it carries the
    // same authority as unpublishing it.
    if (reel.status === 'published') requireCms(auth, 'cms.publish');
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

  private async requirePublishedMobileReel(
    reelId: string,
    options?: { allowUnderReview?: boolean },
  ) {
    const row = await this.repo.getPublishedForEngagement(
      reelId,
      options?.allowUnderReview ?? false,
    );
    if (!row || !resolvePlayback(row.media).playbackUrl) {
      // Treat non-public states as absent so mobile clients cannot probe draft
      // or restricted content IDs.
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    return row;
  }

  async recordAnalyticsEvent(
    auth: AuthClaims,
    reelId: string,
    body: ReelAnalyticsEventRequest,
  ) {
    const actor = requireMobileActor(auth);
    const row = await this.requirePublishedMobileReel(reelId);
    const durationMs = row.media.durationMs ?? MAX_REEL_VIDEO_DURATION_MS;
    if (body.watchedMs > durationMs + 1_000) {
      throw Object.assign(new Error('Watched duration exceeds Reel duration'), {
        code: 'invalid_watch_duration',
        status: 400,
      });
    }
    const data = await reelEngagementRepository.recordView({
      reelId,
      actor,
      eventId: body.eventId,
      watchedMs: Math.min(body.watchedMs, durationMs),
      completed: body.completed,
      sessionId: body.sessionId,
    });
    return { data };
  }

  async setMobileLike(
    auth: AuthClaims,
    reelId: string,
    body: SetReelLikeRequest,
  ) {
    const actor = requireMobileActor(auth);
    await this.requirePublishedMobileReel(reelId);
    const changed = await reelEngagementRepository.setLike({
      reelId,
      actor,
      liked: body.liked,
    });
    return { data: { liked: body.liked, changed } };
  }

  async createMobileComment(
    auth: AuthClaims,
    reelId: string,
    body: CreateReelCommentRequest,
  ) {
    const actor = requireMobileActor(auth);
    await this.requirePublishedMobileReel(reelId);
    const comment = await reelEngagementRepository.createComment({
      reelId,
      actor,
      body: body.body,
    });
    return {
      data: {
        id: comment.id,
        reelId: comment.reelId,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt.toISOString(),
      },
    };
  }

  async createMobileReport(
    auth: AuthClaims,
    reelId: string,
    body: CreateReelReportRequest,
  ) {
    const actor = requireMobileActor(auth);
    // A first report marks a Reel under review. Further reporters may still
    // report it while that review is pending, but restricted/removed content
    // is not probeable through this endpoint.
    await this.requirePublishedMobileReel(reelId, { allowUnderReview: true });
    const report = await reelEngagementRepository.createReport({
      reelId,
      actor,
      reason: body.reason,
      details: body.details,
    });
    if (!report) {
      throw Object.assign(new Error('You have already reported this Reel'), {
        code: 'already_reported',
        status: 409,
      });
    }
    await writeAudit({
      actorId: actor.kind === 'mobile_user' ? auth.sub : null,
      actorEmail: auth.email || null,
      action: 'reel.report',
      entityType: 'reel',
      entityId: reelId,
      metadata: { reason: body.reason },
    });
    return {
      data: {
        id: report.id,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    };
  }

  async listReports(auth: AuthClaims, query: ReelReportListQuery) {
    requireCms(auth, 'moderation.act');
    const rows = await reelEngagementRepository.listReports(query);
    return rows.map(row => mapReport(row.report, row.reelTitle));
  }

  async resolveReport(
    auth: AuthClaims,
    reportId: string,
    body: ResolveReelReportRequest,
  ) {
    requireCms(auth, 'moderation.act');
    const row = await reelEngagementRepository.getReport(reportId);
    if (!row) {
      throw Object.assign(new Error('Report not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    if (row.report.status !== 'open') {
      throw Object.assign(new Error('Report has already been resolved'), {
        code: 'report_already_resolved',
        status: 409,
      });
    }

    const resolvedAt = new Date();
    const resolved = await reelEngagementRepository.resolveReport(reportId, {
      status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
      resolutionAction: body.action,
      resolutionNote: body.note ?? null,
      resolvedBy: auth.sub,
      resolvedAt,
    });
    if (!resolved) {
      throw Object.assign(new Error('Report not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (body.action === 'dismiss') {
      const openReports = await reelEngagementRepository.countOpenReports(
        row.reel.id,
      );
      if (openReports === 0 && row.reel.moderationStatus === 'under_review') {
        await this.repo.update(row.reel.id, {
          moderationStatus: 'clear',
          reviewedAt: resolvedAt,
          reviewedBy: auth.sub,
        });
      }
    } else if (body.action === 'return_to_review') {
      await this.repo.update(row.reel.id, {
        status: 'in_review',
        publishedAt: null,
        // The report itself is resolved; lifecycle review, rather than a
        // safety hold, now controls visibility and allows a later publish.
        moderationStatus: 'clear',
        reviewedAt: resolvedAt,
        reviewedBy: auth.sub,
      });
    } else if (body.action === 'restrict_reel') {
      await this.repo.update(row.reel.id, {
        moderationStatus: 'restricted',
        reviewedAt: resolvedAt,
        reviewedBy: auth.sub,
      });
      if (row.reel.mediaId) {
        await mediaRepository.updateAsset(row.reel.mediaId, {
          moderationStatus: 'manual_review',
        });
      }
    } else {
      await this.repo.update(row.reel.id, {
        status: 'archived',
        publishedAt: null,
        moderationStatus: 'removed',
        reviewedAt: resolvedAt,
        reviewedBy: auth.sub,
      });
      if (row.reel.mediaId) {
        await mediaRepository.updateAsset(row.reel.mediaId, {
          moderationStatus: 'manual_review',
        });
      }
    }

    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: `reel.report.${body.action}`,
      entityType: 'reel',
      entityId: row.reel.id,
      metadata: { reportId, note: body.note ?? null },
    });
    return mapReport(resolved, row.reel.title);
  }

  async analytics(auth: AuthClaims, reelId: string): Promise<ReelAnalyticsSummary> {
    requireCms(auth, 'cms.read');
    const reel = await this.repo.get(reelId);
    if (!reel) {
      throw Object.assign(new Error('Reel not found'), {
        code: 'not_found',
        status: 404,
      });
    }
    const summary = await reelEngagementRepository.analyticsSummary(reelId);
    return { reelId, ...summary };
  }

  async listFeed(): Promise<ReelFeedItem[]> {
    const rows = await this.repo.listPublished(50);
    const items: ReelFeedItem[] = [];
    for (const r of rows) {
      const { playbackUrl, posterUrl } = resolvePlayback(r.media);
      if (!playbackUrl) continue;
      items.push({
        id: r.reel.id,
        status: 'published',
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
