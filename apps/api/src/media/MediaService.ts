import type {
  AttachMediaUsageRequest,
  CreateContentUploadRequest,
  CreateUploadSessionRequest,
  MediaAccessLevel,
  MediaAsset,
  MediaKind,
  MediaUsage,
  SetMediaModerationStatusRequest,
} from "@anticlock/contracts";
import { writeAudit } from "../lib/audit.js";
import type { AuthClaims } from "../lib/auth.js";
import { LocalObjectStorageProvider } from "./LocalObjectStorageProvider.js";
import { mediaAccessPolicy } from "./MediaAccessPolicy.js";
import { mediaRepository } from "./MediaRepository.js";
import {
  bucketForAccess,
  extensionForMime,
  type ObjectStorageProvider,
} from "./ObjectStorageProvider.js";
import { R2ObjectStorageProvider } from "./R2ObjectStorageProvider.js";
import {
  assertAllowedMime,
  detectMimeFromMagic,
  maxBytesForKind,
  sha256,
  validateVideoUploadMetadata,
  validateUploadedBytes,
} from "./validateUpload.js";

function createStorage(): ObjectStorageProvider {
  const mode = (process.env.MEDIA_STORAGE ?? "local").toLowerCase();
  if (mode === "r2") {
    const hasR2Credentials =
      Boolean(process.env.R2_ACCOUNT_ID?.trim()) &&
      Boolean(process.env.R2_ACCESS_KEY_ID?.trim()) &&
      Boolean(process.env.R2_SECRET_ACCESS_KEY?.trim());
    if (hasR2Credentials) return new R2ObjectStorageProvider();
    console.warn(
      "MEDIA_STORAGE=r2 but R2 credentials are incomplete; using local storage until configured"
    );
  }
  return new LocalObjectStorageProvider();
}

function toIso(d: Date | null | undefined) {
  return d ? d.toISOString() : null;
}

function finalStorageKeyFor(uploadKey: string) {
  const match = uploadKey.match(/\/upload\.([a-z0-9]+)$/i);
  if (!match) throw new Error("Invalid upload storage key");
  return uploadKey.replace(/\/upload\.([a-z0-9]+)$/i, "/original.$1");
}

export class MediaService {
  private storage = createStorage();
  private repo = mediaRepository;

  private requireSessionOwner(
    auth: AuthClaims,
    session: { createdBy: string | null },
    options?: { skipOwnerCheck?: boolean }
  ) {
    if (options?.skipOwnerCheck) return;
    if (session.createdBy === null) return;
    if (session.createdBy !== auth.sub && !auth.roles.includes("super_admin")) {
      throw Object.assign(
        new Error("You cannot complete another admin’s upload"),
        {
          code: "forbidden",
          status: 403,
        }
      );
    }
  }

  private async mapAsset(
    row: NonNullable<Awaited<ReturnType<typeof mediaRepository.getAsset>>>,
    extras?: { usageCount?: number; createdByName?: string | null }
  ): Promise<MediaAsset> {
    const deliveryUrl =
      row.processingStatus === "ready"
        ? row.storageProvider === "stream" || row.storageProvider === "external"
          ? row.thumbnailUrl ??
            (row.storageProvider === "external" ? row.storageKey : null)
          : await this.storage.createDownloadUrl({
              bucket: row.bucket as "public-media" | "private-documents",
              key: row.storageKey,
              accessLevel: row.accessLevel as MediaAccessLevel,
            })
        : null;

    return {
      id: row.id,
      kind: row.kind as MediaKind,
      storageProvider: row.storageProvider as MediaAsset["storageProvider"],
      storageKey: row.storageKey,
      bucket: row.bucket,
      mimeType: row.mimeType,
      byteSize: row.byteSize,
      width: row.width,
      height: row.height,
      checksumSha256: row.checksumSha256,
      originalFilename: row.originalFilename,
      accessLevel: row.accessLevel as MediaAccessLevel,
      processingStatus: row.processingStatus as MediaAsset["processingStatus"],
      moderationStatus: row.moderationStatus as MediaAsset["moderationStatus"],
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

  async createUploadSession(
    auth: AuthClaims,
    body: CreateUploadSessionRequest
  ) {
    mediaAccessPolicy.require(auth, "media.write");
    assertAllowedMime(body.kind, body.contentType);
    const maxBytes = Math.min(body.byteSize, maxBytesForKind(body.kind));
    if (body.byteSize > maxBytesForKind(body.kind)) {
      throw Object.assign(new Error("File exceeds max size"), {
        code: "file_too_large",
        status: 400,
      });
    }
    if (body.kind === "video") {
      // Route validation handles this too; keep the service safe for direct
      // callers and make the duration gate happen before an R2 URL is minted.
      validateVideoUploadMetadata({
        expectedMime: body.contentType,
        contentType: body.contentType,
        maxBytes,
        byteSize: body.byteSize,
        durationMs: body.durationMs ?? null,
      });
    }

    const accessLevel = body.accessLevel ?? "public";
    const bucket = bucketForAccess(accessLevel);
    const ext = extensionForMime(body.contentType);
    const hint = (body.entityHint ?? "uploads").replace(/[^a-zA-Z0-9_-]/g, "");

    const asset = await this.repo.createAsset({
      kind: body.kind,
      storageProvider: this.storage.name,
      storageKey: "pending",
      bucket,
      mimeType: body.contentType,
      byteSize: body.byteSize,
      width: body.width ?? null,
      height: body.height ?? null,
      durationMs: body.durationMs ?? null,
      originalFilename: body.filename,
      accessLevel,
      processingStatus: "initiated",
      moderationStatus: "not_required",
      createdBy: auth.sub,
    });

    // The signed PUT is deliberately scoped to a staging key. On successful
    // confirmation we copy it to `original.*`, making a still-valid upload URL
    // unable to overwrite a ready media asset.
    const storageKey = `${accessLevel}/${hint}/${asset.id}/upload.${ext}`;
    await this.repo.updateAsset(asset.id, {
      storageKey,
      processingStatus: "uploading",
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const session = await this.repo.createSession({
      mediaId: asset.id,
      createdBy: auth.sub,
      expiresAt,
      status: "open",
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
    mediaAccessPolicy.require(auth, "media.write");
    return this.putLocalContentInternal(auth, sessionId, body);
  }

  async putMobileProviderLocalContent(
    mobileUserId: string,
    applicationId: string,
    sessionId: string,
    body: Buffer
  ) {
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset || !asset.storageKey.includes(`provider-app-${applicationId}`)) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    return this.putLocalContentInternal(
      {
        sub: mobileUserId,
        email: "",
        name: "",
        roles: [],
        permissions: ["media.write"],
        kind: "mobile",
      },
      sessionId,
      body,
      { skipOwnerCheck: true }
    );
  }

  private async putLocalContentInternal(
    auth: AuthClaims,
    sessionId: string,
    body: Buffer,
    options?: { skipOwnerCheck?: boolean }
  ) {
    const session = await this.repo.getSession(sessionId);
    if (!session || session.status !== "open") {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    this.requireSessionOwner(auth, session, options);
    if (session.expiresAt.getTime() < Date.now()) {
      await this.repo.updateSession(sessionId, { status: "expired" });
      throw Object.assign(new Error("Upload session expired"), {
        code: "session_expired",
        status: 410,
      });
    }
    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset) {
      throw Object.assign(new Error("Media asset missing"), {
        code: "not_found",
        status: 404,
      });
    }
    if (body.length > session.maxBytes) {
      throw Object.assign(new Error("File exceeds max size"), {
        code: "file_too_large",
        status: 400,
      });
    }
    await this.storage.putObject({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
      body,
      contentType: session.expectedMime,
    });
    await this.repo.updateAsset(asset.id, { processingStatus: "uploaded" });
    return { ok: true };
  }

  async completeUpload(
    auth: AuthClaims,
    sessionId: string,
    clientChecksum?: string,
    options?: { skipOwnerCheck?: boolean }
  ) {
    mediaAccessPolicy.require(auth, "media.write");
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    this.requireSessionOwner(auth, session, options);
    if (session.status === "completed") {
      const existing = await this.repo.getAsset(session.mediaId);
      if (!existing)
        throw Object.assign(new Error("Not found"), { status: 404 });
      return {
        asset: await this.mapAsset(existing),
        duplicateOf: null as MediaAsset | null,
      };
    }
    if (session.expiresAt.getTime() < Date.now()) {
      await this.repo.updateSession(sessionId, { status: "expired" });
      throw Object.assign(new Error("Upload session expired"), {
        code: "session_expired",
        status: 410,
      });
    }

    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset) {
      throw Object.assign(new Error("Media asset missing"), {
        code: "not_found",
        status: 404,
      });
    }

    const meta = await this.storage.verifyObject({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
    });
    if (!meta) {
      await this.repo.updateAsset(asset.id, { processingStatus: "failed" });
      await this.repo.updateSession(sessionId, { status: "failed" });
      throw Object.assign(new Error("Uploaded object not found"), {
        code: "upload_missing",
        status: 400,
      });
    }

    await this.repo.updateAsset(asset.id, { processingStatus: "processing" });

    if (asset.kind === "video") {
      try {
        const prefix = await this.storage.getObjectPrefix({
          bucket: asset.bucket as "public-media" | "private-documents",
          key: asset.storageKey,
          byteLength: 32,
        });
        if (detectMimeFromMagic(prefix) !== "video/mp4") {
          throw Object.assign(new Error("Uploaded file is not a valid MP4"), {
            code: "invalid_media",
            status: 400,
          });
        }

        const validated = validateVideoUploadMetadata({
          expectedMime: session.expectedMime,
          contentType: meta.contentType,
          maxBytes: session.maxBytes,
          byteSize: meta.byteSize,
          durationMs: asset.durationMs,
        });
        // Store a server-computed source checksum for exact duplicate grouping.
        // This is intentionally before promotion: only the staged bytes that
        // passed signature/metadata validation can influence feed de-dup.
        // Production can replace this bounded read with an object-store
        // checksum/streaming worker without changing the persisted contract.
        const videoBytes = await this.storage.getObjectBuffer({
          bucket: asset.bucket as "public-media" | "private-documents",
          key: asset.storageKey,
        });
        const checksumSha256 = sha256(videoBytes);
        if (clientChecksum && clientChecksum !== checksumSha256) {
          throw Object.assign(new Error("Checksum mismatch"), {
            code: "checksum_mismatch",
            status: 400,
          });
        }
        const duplicate = await this.repo.findByChecksum(checksumSha256);
        const duplicateOf =
          duplicate && duplicate.id !== asset.id
            ? await this.mapAsset(duplicate)
            : null;
        const finalStorageKey = finalStorageKeyFor(asset.storageKey);
        await this.storage.finalizeUpload({
          bucket: asset.bucket as "public-media" | "private-documents",
          sourceKey: asset.storageKey,
          destinationKey: finalStorageKey,
          sourceEtag: meta.etag,
        });

        const updated = await this.repo.updateAsset(asset.id, {
          storageKey: finalStorageKey,
          mimeType: validated.mimeType,
          byteSize: validated.byteSize,
          durationMs: validated.durationMs,
          checksumSha256,
          processingStatus: "ready",
          moderationStatus: "approved",
        });
        await this.repo.updateSession(sessionId, { status: "completed" });

        await writeAudit({
          actorId: auth.sub,
          actorEmail: auth.email,
          action: "media.upload_complete",
          entityType: "media_asset",
          entityId: asset.id,
          metadata: {
            durationMs: validated.durationMs,
            byteSize: validated.byteSize,
            checksum: checksumSha256,
            duplicateOf: duplicateOf?.id ?? null,
          },
        });

        return {
          asset: await this.mapAsset(updated!),
          duplicateOf,
        };
      } catch (err) {
        await this.repo.updateAsset(asset.id, { processingStatus: "failed" });
        await this.repo.updateSession(sessionId, { status: "failed" });
        throw err;
      }
    }

    let body: Buffer;
    try {
      body = await this.storage.getObjectBuffer({
        bucket: asset.bucket as "public-media" | "private-documents",
        key: asset.storageKey,
      });
    } catch {
      await this.repo.updateAsset(asset.id, { processingStatus: "failed" });
      await this.repo.updateSession(sessionId, { status: "failed" });
      throw Object.assign(new Error("Unable to read uploaded object"), {
        code: "upload_unreadable",
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
        throw Object.assign(new Error("Checksum mismatch"), {
          code: "checksum_mismatch",
          status: 400,
        });
      }

      const duplicate = await this.repo.findByChecksum(
        validated.checksumSha256
      );
      const duplicateOf =
        duplicate && duplicate.id !== asset.id
          ? await this.mapAsset(duplicate)
          : null;
      const finalStorageKey = finalStorageKeyFor(asset.storageKey);
      await this.storage.finalizeUpload({
        bucket: asset.bucket as "public-media" | "private-documents",
        sourceKey: asset.storageKey,
        destinationKey: finalStorageKey,
        sourceEtag: meta.etag,
      });

      const updated = await this.repo.updateAsset(asset.id, {
        storageKey: finalStorageKey,
        mimeType: validated.mimeType,
        byteSize: validated.byteSize,
        width: validated.width,
        height: validated.height,
        checksumSha256: validated.checksumSha256,
        processingStatus: "ready",
        moderationStatus: "approved",
      });
      await this.repo.updateSession(sessionId, { status: "completed" });

      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email,
        action: "media.upload_complete",
        entityType: "media_asset",
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
      await this.repo.updateAsset(asset.id, { processingStatus: "failed" });
      await this.repo.updateSession(sessionId, { status: "failed" });
      throw err;
    }
  }

  /**
   * Asset-first completion endpoint used by direct R2 uploads.  It leaves the
   * session-based endpoint intact for existing image/document clients.
   */
  async completeUploadForMedia(
    auth: AuthClaims,
    mediaId: string,
    clientChecksum?: string
  ) {
    mediaAccessPolicy.require(auth, "media.write");
    const session = await this.repo.findOpenSessionForMedia(mediaId);
    if (session) {
      return this.completeUpload(auth, session.id, clientChecksum);
    }

    // Make a browser retry after a successful completion harmless.
    const asset = await this.repo.getAsset(mediaId);
    if (asset?.processingStatus === "ready") {
      return {
        asset: await this.mapAsset(asset),
        duplicateOf: null as MediaAsset | null,
      };
    }
    throw Object.assign(new Error("Upload session not found"), {
      code: "session_not_found",
      status: 404,
    });
  }

  async list(
    auth: AuthClaims,
    filters: {
      q?: string;
      kind?: string;
      status?: string;
      accessLevel?: string;
      limit: number;
    }
  ) {
    mediaAccessPolicy.require(auth, "media.read");
    const rows = await this.repo.listAssets(filters);
    const data = await Promise.all(
      rows.map((r) =>
        this.mapAsset(r.asset, {
          usageCount: Number(r.usageCount ?? 0),
          createdByName: r.createdByName,
        })
      )
    );
    return { data, meta: { nextCursor: null as string | null } };
  }

  async get(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, "media.read");
    const asset = await this.repo.getAsset(id);
    if (!asset || asset.archivedAt) {
      // still allow viewing archived
    }
    if (!asset) {
      throw Object.assign(new Error("Not found"), {
        code: "not_found",
        status: 404,
      });
    }
    const usages = await this.repo.listUsages(id);
    const usageDtos: MediaUsage[] = await Promise.all(
      usages.map(async (u) => ({
        id: u.id,
        mediaId: u.mediaId,
        entityType: u.entityType as MediaUsage["entityType"],
        entityId: u.entityId,
        usageType: u.usageType as MediaUsage["usageType"],
        sortOrder: u.sortOrder,
        createdAt: u.createdAt.toISOString(),
        entityLabel: await this.repo.resolveEntityLabel(
          u.entityType,
          u.entityId
        ),
      }))
    );
    return {
      asset: await this.mapAsset(asset, { usageCount: usages.length }),
      usages: usageDtos,
    };
  }

  async archive(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, "media.write");
    const asset = await this.repo.getAsset(id);
    if (!asset) {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    const updated = await this.repo.updateAsset(id, { archivedAt: new Date() });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "media.archive",
      entityType: "media_asset",
      entityId: id,
    });
    return this.mapAsset(updated!);
  }

  /**
   * Content safety is an independent gate from upload readiness. Changing this
   * status does not create or publish a Reel; public feed queries enforce it
   * for every Reel that reuses the asset.
   */
  async setModerationStatus(
    auth: AuthClaims,
    id: string,
    body: SetMediaModerationStatusRequest
  ) {
    mediaAccessPolicy.require(auth, "moderation.act");
    const asset = await this.repo.getAsset(id);
    if (!asset) {
      throw Object.assign(new Error("Not found"), {
        code: "not_found",
        status: 404,
      });
    }
    if (asset.processingStatus !== "ready") {
      throw Object.assign(new Error("Only ready media can be moderated"), {
        code: "media_not_ready",
        status: 409,
      });
    }

    const updated = await this.repo.updateAsset(id, {
      moderationStatus: body.status,
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "media.moderation_update",
      entityType: "media_asset",
      entityId: id,
      metadata: {
        from: asset.moderationStatus,
        to: body.status,
        note: body.note ?? null,
      },
    });
    return this.mapAsset(updated!);
  }

  async delete(auth: AuthClaims, id: string) {
    mediaAccessPolicy.require(auth, "media.delete");
    const asset = await this.repo.getAsset(id);
    if (!asset) {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    const usageCount = await this.repo.usageCount(id);
    if (usageCount > 0) {
      throw Object.assign(new Error("Cannot delete media while it is in use"), {
        code: "in_use",
        status: 409,
      });
    }
    await this.storage.deleteObject({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
    });
    await this.repo.updateAsset(id, {
      deletedAt: new Date(),
      processingStatus: "deleted",
    });
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "media.delete",
      entityType: "media_asset",
      entityId: id,
    });
    return { ok: true };
  }

  async attachUsage(auth: AuthClaims, body: AttachMediaUsageRequest) {
    mediaAccessPolicy.require(auth, "media.write");
    const asset = await this.repo.getAsset(body.mediaId);
    if (!asset || asset.processingStatus !== "ready") {
      throw Object.assign(new Error("Media not ready"), {
        code: "media_not_ready",
        status: 400,
      });
    }
    // For PROFILE/HERO, replace prior attachments of same slot on entity
    if (body.usageType === "PROFILE" || body.usageType === "HERO") {
      await this.repo.replaceEntityUsages(
        body.entityType,
        body.entityId,
        body.usageType,
        [body.mediaId]
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
      action: "media.usage_attach",
      entityType: body.entityType,
      entityId: body.entityId,
      metadata: { mediaId: body.mediaId, usageType: body.usageType },
    });
    return { ok: true };
  }

  async setGallery(auth: AuthClaims, productId: string, mediaIds: string[]) {
    mediaAccessPolicy.require(auth, "media.write");
    for (const id of mediaIds) {
      const a = await this.repo.getAsset(id);
      if (!a || a.processingStatus !== "ready") {
        throw Object.assign(new Error(`Media ${id} not ready`), {
          status: 400,
        });
      }
    }
    await this.repo.replaceEntityUsages(
      "PRODUCT",
      productId,
      "GALLERY",
      mediaIds
    );
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "media.gallery_set",
      entityType: "PRODUCT",
      entityId: productId,
      metadata: { mediaIds },
    });
    return { ok: true };
  }

  async detachUsage(auth: AuthClaims, usageId: string) {
    mediaAccessPolicy.require(auth, "media.write");
    const usage = await this.repo.getUsage(usageId);
    if (!usage) {
      throw Object.assign(new Error("Not found"), { status: 404 });
    }
    await this.repo.detachUsage(usageId);
    await writeAudit({
      actorId: auth.sub,
      actorEmail: auth.email,
      action: "media.usage_detach",
      entityType: usage.entityType,
      entityId: usage.entityId,
      metadata: { mediaId: usage.mediaId },
    });
    return { ok: true };
  }

  async byChecksum(auth: AuthClaims, sha256: string) {
    mediaAccessPolicy.require(auth, "media.read");
    const row = await this.repo.findByChecksum(sha256);
    return row ? await this.mapAsset(row) : null;
  }

  async getFileBuffer(bucket: string, key: string) {
    return this.storage.getObjectBuffer({
      bucket: bucket as "public-media" | "private-documents",
      key,
    });
  }

  async findAssetByKey(bucket: string, key: string) {
    const { mediaAssets } = await import("../db/schema.js");
    const { eq, and, isNull } = await import("drizzle-orm");
    const { db } = await import("../db/client.js");
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.bucket, bucket),
          eq(mediaAssets.storageKey, key),
          isNull(mediaAssets.deletedAt)
        )
      );
    return row ?? null;
  }

  private isPublicContentAssetDeliverable(
    asset: Awaited<ReturnType<typeof mediaRepository.getAsset>>,
    expectedKind?: "video" | "image"
  ) {
    return Boolean(
      asset &&
        (expectedKind === undefined || asset.kind === expectedKind) &&
        asset.accessLevel === "public" &&
        asset.processingStatus === "ready" &&
        !asset.deletedAt &&
        !asset.archivedAt &&
        ["approved", "not_required"].includes(asset.moderationStatus)
    );
  }

  /** Lightweight eligibility check for actions that do not need a URL. */
  async isPublicContentDeliverable(
    mediaId: string,
    expectedKind?: "video" | "image"
  ) {
    const asset = await this.repo.getAsset(mediaId);
    return this.isPublicContentAssetDeliverable(asset, expectedKind);
  }

  /** Public-content mapper used only after the post visibility gate has run. */
  async getPublicContentDeliveryUrl(
    mediaId: string,
    expectedKind?: "video" | "image"
  ) {
    const asset = await this.repo.getAsset(mediaId);
    if (!asset || !this.isPublicContentAssetDeliverable(asset, expectedKind)) {
      return null;
    }
    return this.storage.createDownloadUrl({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
      accessLevel: "public",
    });
  }

  /** Delivery URL for an operator-managed, public music track asset. */
  async getPublicAudioDeliveryUrl(mediaId: string) {
    const asset = await this.repo.getAsset(mediaId);
    if (
      !asset ||
      asset.kind !== "audio" ||
      asset.processingStatus !== "ready" ||
      asset.accessLevel !== "public" ||
      asset.deletedAt ||
      asset.archivedAt ||
      !["approved", "not_required"].includes(asset.moderationStatus)
    ) {
      return null;
    }
    return this.storage.createDownloadUrl({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
      accessLevel: "public",
    });
  }

  // --- stub domain helpers ---

  async listProviders(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, "provider.read");
    const providers = await this.repo.listProviders();
    return Promise.all(
      providers.map(async (p) => {
        const usages = await this.repo.usagesForEntity("PROVIDER", p.id);
        const profile = usages.find((u) => u.usageType === "PROFILE");
        let profileDeliveryUrl: string | null = null;
        let profileMediaId: string | null = null;
        if (profile) {
          profileMediaId = profile.mediaId;
          const asset = await this.repo.getAsset(profile.mediaId);
          if (asset) {
            profileDeliveryUrl = await this.storage.createDownloadUrl({
              bucket: asset.bucket as "public-media" | "private-documents",
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
      })
    );
  }

  async listProducts(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, "orders.manage");
    const products = await this.repo.listProducts();
    return Promise.all(
      products.map(async (p) => {
        const usages = (await this.repo.usagesForEntity("PRODUCT", p.id))
          .filter((u) => u.usageType === "GALLERY")
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const gallery = await Promise.all(
          usages.map(async (u) => {
            const asset = await this.repo.getAsset(u.mediaId);
            const deliveryUrl = asset
              ? await this.storage.createDownloadUrl({
                  bucket: asset.bucket as "public-media" | "private-documents",
                  key: asset.storageKey,
                  accessLevel: asset.accessLevel as MediaAccessLevel,
                })
              : null;
            return {
              mediaId: u.mediaId,
              deliveryUrl,
              sortOrder: u.sortOrder,
            };
          })
        );
        return { id: p.id, name: p.name, status: p.status, gallery };
      })
    );
  }

  async listBanners(auth: AuthClaims) {
    mediaAccessPolicy.require(auth, "cms.read");
    const banners = await this.repo.listBanners();
    return Promise.all(
      banners.map(async (b) => {
        const usages = await this.repo.usagesForEntity("BANNER", b.id);
        const hero = usages.find((u) => u.usageType === "HERO");
        let heroDeliveryUrl: string | null = null;
        let heroMediaId: string | null = null;
        if (hero) {
          heroMediaId = hero.mediaId;
          const asset = await this.repo.getAsset(hero.mediaId);
          if (asset) {
            heroDeliveryUrl = await this.storage.createDownloadUrl({
              bucket: asset.bucket as "public-media" | "private-documents",
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
      })
    );
  }

  /** Published CMS banners intended for anonymous/mobile display. */
  async listPublicBanners() {
    const banners = await this.repo.listBanners();
    const published = banners.filter((b) => b.status === "published");
    return Promise.all(
      published.map(async (b) => {
        const usages = await this.repo.usagesForEntity("BANNER", b.id);
        const hero = usages.find((u) => u.usageType === "HERO");
        if (!hero) return { id: b.id, title: b.title, imageUrl: null };

        const asset = await this.repo.getAsset(hero.mediaId);
        if (
          !asset ||
          asset.accessLevel !== "public" ||
          asset.processingStatus !== "ready"
        ) {
          return { id: b.id, title: b.title, imageUrl: null };
        }
        const imageUrl = await this.storage.createDownloadUrl({
          bucket: asset.bucket as "public-media" | "private-documents",
          key: asset.storageKey,
          accessLevel: asset.accessLevel as MediaAccessLevel,
        });
        return { id: b.id, title: b.title, imageUrl };
      })
    );
  }

  async createMobileProviderUploadSession(
    _mobileUserId: string,
    applicationId: string,
    body: CreateUploadSessionRequest
  ) {
    assertAllowedMime(body.kind, body.contentType);
    const maxBytes = Math.min(body.byteSize, maxBytesForKind(body.kind));
    const accessLevel = "private" as const;
    const bucket = bucketForAccess(accessLevel);
    const ext = extensionForMime(body.contentType);
    const hint = `provider-app-${applicationId}`;

    const asset = await this.repo.createAsset({
      kind: body.kind,
      storageProvider: this.storage.name,
      storageKey: "pending",
      bucket,
      mimeType: body.contentType,
      byteSize: body.byteSize,
      width: body.width ?? null,
      height: body.height ?? null,
      durationMs: body.durationMs ?? null,
      originalFilename: body.filename,
      accessLevel,
      processingStatus: "initiated",
      moderationStatus: "not_required",
      createdBy: null,
    });

    const storageKey = `${accessLevel}/${hint}/${asset.id}/upload.${ext}`;
    await this.repo.updateAsset(asset.id, {
      storageKey,
      processingStatus: "uploading",
    });

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const session = await this.repo.createSession({
      mediaId: asset.id,
      createdBy: null,
      expiresAt,
      status: "open",
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

  /**
   * Creator uploads are owned by the signed-in mobile user, not by an admin
   * account. The ownership marker is checked again for local PUT and complete
   * calls, while a short-lived R2 URL remains scoped to one staging object.
   */
  async createMobileContentUploadSession(
    mobileUserId: string,
    body: CreateContentUploadRequest
  ) {
    assertAllowedMime(body.kind, body.contentType);
    const maxBytes = maxBytesForKind(body.kind);
    if (body.byteSize > maxBytes) {
      throw Object.assign(new Error("File exceeds max size"), {
        code: "file_too_large",
        status: 400,
      });
    }
    if (body.kind === "video") {
      validateVideoUploadMetadata({
        expectedMime: body.contentType,
        contentType: body.contentType,
        maxBytes,
        byteSize: body.byteSize,
        durationMs: body.durationMs ?? null,
      });
    }

    // Non-public posts must not be put in a public bucket merely because the
    // author selected the privacy option after uploading.
    const accessLevel = body.visibility === "public" ? "public" : "private";
    const bucket = bucketForAccess(accessLevel);
    const ext = extensionForMime(body.contentType);
    const hint = `content-${mobileUserId}`;
    const asset = await this.repo.createAsset({
      kind: body.kind,
      storageProvider: this.storage.name,
      storageKey: "pending",
      bucket,
      mimeType: body.contentType,
      byteSize: body.byteSize,
      width: body.width ?? null,
      height: body.height ?? null,
      durationMs: body.durationMs ?? null,
      originalFilename: body.filename,
      accessLevel,
      processingStatus: "initiated",
      moderationStatus: "not_required",
      createdBy: null,
    });
    const storageKey = `${accessLevel}/${hint}/${asset.id}/upload.${ext}`;
    await this.repo.updateAsset(asset.id, {
      storageKey,
      processingStatus: "uploading",
    });
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const session = await this.repo.createSession({
      mediaId: asset.id,
      createdBy: null,
      expiresAt,
      status: "open",
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
    const apiBase = (
      process.env.API_PUBLIC_URL ??
      `http://localhost:${process.env.API_PORT ?? 4000}`
    ).replace(/\/$/, "");
    return {
      sessionId: session.id,
      mediaId: asset.id,
      // Local storage writes through the mobile-authorized route rather than
      // the admin Media Library route returned by the generic provider.
      uploadUrl:
        this.storage.name === "local"
          ? `${apiBase}/v1/content/uploads/${session.id}/content`
          : target.uploadUrl,
      headers: target.headers,
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async requireMobileContentSession(
    mobileUserId: string,
    sessionId: string
  ) {
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    const asset = await this.repo.getAsset(session.mediaId);
    const marker = `/content-${mobileUserId}/`;
    if (!asset || !asset.storageKey.includes(marker)) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    return { session, asset };
  }

  async putMobileContentLocalContent(
    mobileUserId: string,
    sessionId: string,
    body: Buffer
  ) {
    await this.requireMobileContentSession(mobileUserId, sessionId);
    return this.putLocalContentInternal(
      {
        sub: mobileUserId,
        email: "",
        name: "",
        roles: [],
        permissions: ["media.write"],
        kind: "mobile",
      },
      sessionId,
      body,
      { skipOwnerCheck: true }
    );
  }

  async completeMobileContentUpload(
    mobileUserId: string,
    sessionId: string,
    checksumSha256?: string
  ) {
    await this.requireMobileContentSession(mobileUserId, sessionId);
    const result = await this.completeUpload(
      {
        sub: mobileUserId,
        email: "",
        name: "",
        roles: [],
        permissions: ["media.write"],
        kind: "mobile",
      },
      sessionId,
      checksumSha256,
      { skipOwnerCheck: true }
    );
    // Exact-media grouping happens entirely on the server. Do not expose the
    // mapped asset of another uploader merely because their bytes matched.
    return {
      asset: result.asset,
      duplicateOf: result.duplicateOf ? { id: result.duplicateOf.id } : null,
    };
  }

  /** Ensures creators can only attach their own completed content assets. */
  async requireMobileContentAssets(
    mobileUserId: string,
    mediaIds: string[],
    thumbnailMediaId?: string | null,
    expectedVisibility?: string
  ) {
    const ids = [...new Set(mediaIds)];
    const assets = await Promise.all(ids.map((id) => this.repo.getAsset(id)));
    const marker = `/content-${mobileUserId}/`;
    for (const asset of assets) {
      if (!asset || !asset.storageKey.includes(marker)) {
        throw Object.assign(
          new Error("Media was not uploaded by this account"),
          {
            code: "media_forbidden",
            status: 403,
          }
        );
      }
      if (
        asset.processingStatus !== "ready" ||
        asset.deletedAt ||
        asset.archivedAt ||
        !["approved", "not_required"].includes(asset.moderationStatus)
      ) {
        throw Object.assign(new Error("Media is not ready to publish"), {
          code: "media_not_ready",
          status: 400,
        });
      }
      const wantsPublic = expectedVisibility === "public";
      if (
        expectedVisibility &&
        (asset.accessLevel === "public") !== wantsPublic
      ) {
        throw Object.assign(
          new Error("Upload privacy does not match the post"),
          {
            code: "media_privacy_mismatch",
            status: 400,
          }
        );
      }
    }

    let thumbnail = null;
    if (thumbnailMediaId) {
      thumbnail = await this.repo.getAsset(thumbnailMediaId);
      if (
        !thumbnail ||
        !thumbnail.storageKey.includes(marker) ||
        thumbnail.kind !== "image" ||
        thumbnail.processingStatus !== "ready" ||
        thumbnail.deletedAt ||
        thumbnail.archivedAt ||
        !["approved", "not_required"].includes(thumbnail.moderationStatus)
      ) {
        throw Object.assign(
          new Error("Thumbnail must be one of your ready images"),
          {
            code: "invalid_thumbnail",
            status: 400,
          }
        );
      }
      const wantsPublic = expectedVisibility === "public";
      if (
        expectedVisibility &&
        (thumbnail.accessLevel === "public") !== wantsPublic
      ) {
        throw Object.assign(
          new Error("Thumbnail privacy does not match the post"),
          {
            code: "media_privacy_mismatch",
            status: 400,
          }
        );
      }
    }
    return { assets: assets.filter(Boolean), thumbnail };
  }

  async completeMobileProviderUpload(
    mobileUserId: string,
    applicationId: string,
    sessionId: string
  ) {
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }
    const asset = await this.repo.getAsset(session.mediaId);
    if (!asset || !asset.storageKey.includes(`provider-app-${applicationId}`)) {
      throw Object.assign(new Error("Upload session not found"), {
        code: "session_not_found",
        status: 404,
      });
    }

    const result = await this.completeUpload(
      {
        sub: mobileUserId,
        email: "",
        name: "",
        roles: [],
        permissions: ["media.write"],
        kind: "mobile",
      },
      sessionId,
      undefined,
      { skipOwnerCheck: true }
    );
    return result.asset;
  }

  async createPrivateDownloadUrl(mediaId: string) {
    const asset = await this.repo.getAsset(mediaId);
    if (
      !asset ||
      asset.accessLevel !== "private" ||
      asset.processingStatus !== "ready"
    ) {
      return null;
    }
    return this.storage.createDownloadUrl({
      bucket: asset.bucket as "public-media" | "private-documents",
      key: asset.storageKey,
      accessLevel: "private",
    });
  }
}

export const mediaService = new MediaService();
