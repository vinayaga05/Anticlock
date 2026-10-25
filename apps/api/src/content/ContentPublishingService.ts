import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { postEvent, publishContentEvent } from "../realtime/contentEvents.js";
import { z } from "zod";
import {
  ClipEditMetadataSchema,
  ContentFormatSchema,
  ContentMediaTypeSchema,
  refineContentShape,
  type ContentFormat,
  type ContentPublisher,
  type ContentLifecycleStatus,
  type CreateContentCommentRequest,
  type CreateContentDraftRequest,
  type UpdateContentDraftRequest,
} from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  contentContainers,
  contentPostComments,
  contentPostLikes,
  contentPosts,
  mobileUsers,
  providerServiceOfferings,
  providers,
} from "../db/schema.js";
import { mediaService } from "../media/MediaService.js";
import {
  authorColumnsFor,
  canViewerSee,
  contentRequiresReview,
  legacyAuthor,
  loadBlockedPublisherKeys,
  loadPublisher,
  loadPublishers,
  loadViewerContext,
  postVisibleToViewer,
  publisherKey,
  publisherRefFromAuthor,
  resolveOwnedPublisher,
  viewerCanManage,
  type PublisherRef,
  type ViewerContext,
} from "../publishing/publisher.js";
import { canProfileViewContent, getProfilePrivacy, hasAcceptedFollow, profileConnectionCounts, profileFollowService, profilesAreBlocked } from "../social/ProfileFollowService.js";
import { exceedsClipDuration, musicAttributionFromEdit } from "./musicTracks.js";

type Container = typeof contentContainers.$inferSelect;
type Post = typeof contentPosts.$inferSelect;

export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** Container states that can still be edited, uploaded to, or published. */
const OPEN_STATUSES = [
  "draft",
  "uploading",
  "processing",
  "ready_to_publish",
  "failed",
] as const;

function appError(
  message: string,
  code: string,
  status: 400 | 403 | 404 | 409
) {
  return Object.assign(new Error(message), { code, status });
}

const ContentShapeSchema = z
  .object({
    format: ContentFormatSchema,
    mediaType: ContentMediaTypeSchema,
    caption: z.string().max(2_200),
    mediaIds: z.array(z.string().uuid()).max(10),
    edit: ClipEditMetadataSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => refineContentShape(value, ctx));

/** Owner-facing lifecycle status for a draft and (optionally) its post. */
export function contentStatusOf(
  container: Pick<Container, "status"> | null,
  post?: Pick<Post, "status"> | null
): ContentLifecycleStatus {
  if (post) {
    const status = post.status as ContentLifecycleStatus;
    return ["published", "pending_review", "rejected", "removed"].includes(status)
      ? status
      : "published";
  }
  switch (container?.status) {
    case "ready_to_publish":
      return "draft";
    case "discarded":
      return "removed";
    case "draft":
    case "uploading":
    case "processing":
    case "pending_review":
    case "published":
    case "rejected":
    case "failed":
      return container.status;
    default:
      return "draft";
  }
}

function refOf(row: {
  authorMobileUserId: string | null;
  authorProviderId: string | null;
}): PublisherRef {
  const ref = publisherRefFromAuthor(row);
  if (!ref) throw appError("Content has no publisher", "invalid_content", 409);
  return ref;
}

/** Applies profile privacy and post audience after lifecycle/owner checks. */
async function viewerCanSeePublishedPost(
  viewer: ViewerContext,
  row: Post,
  viewerProfile: PublisherRef = { type: "personal", id: viewer.userId },
) {
  if (viewerCanManage(viewer, row)) return true;
  const publisher = refOf(row);
  if (!(await canProfileViewContent(viewerProfile, publisher))) return false;
  if (row.visibility === "public") return true;
  if (row.visibility === "followers") return hasAcceptedFollow(viewerProfile, publisher);
  return false;
}

export function serializeDraft(
  container: Container,
  publisher: ContentPublisher,
  post: Post | null
) {
  const ref = refOf(container);
  return {
    id: container.id,
    contentType: container.format as ContentFormat,
    contentStatus: contentStatusOf(container, post),
    visibility: container.visibility,
    ownerUserId: container.createdByMobileUserId,
    publisherProfileId: ref.id,
    publisherProfileType: ref.type,
    publisher,
    mediaType: container.mediaType,
    caption: container.caption,
    mediaIds: container.mediaIds,
    thumbnailMediaId: container.thumbnailMediaId,
    postId: post?.id ?? null,
    failureReason: container.failureReason ?? null,
    createdAt: container.createdAt.toISOString(),
    publishedAt: container.publishedAt?.toISOString() ?? null,
  };
}

async function requireOwnedContainer(ownerUserId: string, id: string) {
  const [container] = await db
    .select()
    .from(contentContainers)
    .where(
      and(
        eq(contentContainers.id, id),
        eq(contentContainers.createdByMobileUserId, ownerUserId)
      )
    )
    .limit(1);
  if (!container) throw appError("Draft not found", "not_found", 404);
  return container;
}

async function postForContainer(containerId: string) {
  const [post] = await db
    .select()
    .from(contentPosts)
    .where(eq(contentPosts.containerId, containerId))
    .limit(1);
  return post ?? null;
}

async function publisherFor(ref: PublisherRef) {
  const publisher = await loadPublisher(ref);
  if (!publisher) {
    throw appError("Publishing profile is not active", "forbidden", 403);
  }
  return publisher;
}

/** Immutable discovery metadata copied onto a provider Clip at publish time. */
async function providerClipMetadata(ref: PublisherRef, format: ContentFormat) {
  if (format !== "clip" || ref.type !== "business") {
    return { providerId: null, businessId: null, serviceCategoryId: null };
  }
  const [row] = await db
    .select({
      providerKind: providers.providerKind,
      serviceCategoryId: providerServiceOfferings.categoryId,
    })
    .from(providers)
    .leftJoin(
      providerServiceOfferings,
      eq(providerServiceOfferings.providerId, providers.id)
    )
    .where(and(eq(providers.id, ref.id), eq(providers.status, "active")))
    .orderBy(
      asc(providerServiceOfferings.createdAt),
      asc(providerServiceOfferings.id)
    )
    .limit(1);
  if (!row) throw appError("Publishing profile is not active", "forbidden", 403);
  return {
    providerId: ref.id,
    businessId: row.providerKind === "business" ? ref.id : null,
    serviceCategoryId: row.serviceCategoryId ?? null,
  };
}

export async function getDraft(ownerUserId: string, id: string) {
  const container = await requireOwnedContainer(ownerUserId, id);
  const [publisher, post] = await Promise.all([
    publisherFor(refOf(container)),
    postForContainer(container.id),
  ]);
  return serializeDraft(container, publisher, post);
}

/** Step 1: a draft fixes the owner and the selected publishing profile. */
export async function createDraft(
  ownerUserId: string,
  body: CreateContentDraftRequest
) {
  const owned = await resolveOwnedPublisher(ownerUserId, {
    id: body.publisherProfileId,
    type: body.publisherProfileType,
  });
  const format = body.contentType;
  const meta = body.metadata;
  if (meta.edit && format !== "clip") {
    throw appError("Edit metadata is only supported for Clips", "validation_error", 400);
  }
  const [container] = await db
    .insert(contentContainers)
    .values({
      createdByMobileUserId: ownerUserId,
      ...authorColumnsFor(owned.ref),
      format,
      mediaType: meta.mediaType ?? (format === "clip" ? "video" : "text"),
      caption: meta.caption ?? "",
      mediaIds: [],
      hashtags: [...new Set(meta.hashtags ?? [])],
      taggedMobileUserIds: [...new Set(meta.taggedUserIds ?? [])],
      location: meta.location ?? null,
      visibility: body.visibility,
      edit: format === "clip" ? meta.edit ?? null : null,
      status: "draft",
    })
    .returning();
  return serializeDraft(container!, owned.publisher, null);
}

/** Attach media / edit metadata. Only the owner, only before publishing. */
export async function updateDraft(
  ownerUserId: string,
  id: string,
  body: UpdateContentDraftRequest
) {
  const container = await requireOwnedContainer(ownerUserId, id);
  if (!(OPEN_STATUSES as readonly string[]).includes(container.status)) {
    throw appError("This content can no longer be edited", "invalid_status", 409);
  }
  const next: Partial<typeof contentContainers.$inferInsert> = {
    updatedAt: new Date(),
  };
  const meta = body.metadata;
  if (meta) {
    if (meta.edit !== undefined && container.format !== "clip" && meta.edit) {
      throw appError("Edit metadata is only supported for Clips", "validation_error", 400);
    }
    if (meta.mediaType !== undefined) next.mediaType = meta.mediaType;
    if (meta.caption !== undefined) next.caption = meta.caption;
    if (meta.hashtags !== undefined) next.hashtags = [...new Set(meta.hashtags)];
    if (meta.taggedUserIds !== undefined)
      next.taggedMobileUserIds = [...new Set(meta.taggedUserIds)];
    if (meta.location !== undefined) next.location = meta.location ?? null;
    if (meta.edit !== undefined && container.format === "clip")
      next.edit = meta.edit ?? null;
  }
  if (body.visibility !== undefined) next.visibility = body.visibility;
  if (body.mediaIds !== undefined) next.mediaIds = [...new Set(body.mediaIds)];
  if (body.thumbnailMediaId !== undefined)
    next.thumbnailMediaId = body.thumbnailMediaId;

  if (body.mediaIds !== undefined || body.thumbnailMediaId !== undefined) {
    const mediaIds = next.mediaIds ?? container.mediaIds;
    const thumbnail =
      next.thumbnailMediaId !== undefined
        ? next.thumbnailMediaId
        : container.thumbnailMediaId;
    const { state } = await mediaService.inspectMobileContentAssets(ownerUserId, [
      ...mediaIds,
      ...(thumbnail ? [thumbnail] : []),
    ]);
    if (state === "forbidden") {
      throw appError("Media was not uploaded by this account", "media_forbidden", 403);
    }
    // Ready media is NOT public yet: the draft waits for an explicit publish.
    next.status =
      state === "pending" ? "processing" : state === "failed" ? "failed" : "draft";
    next.failureReason = state === "failed" ? "Media upload failed" : null;
  }

  const [updated] = await db
    .update(contentContainers)
    .set(next)
    .where(
      and(
        eq(contentContainers.id, id),
        eq(contentContainers.createdByMobileUserId, ownerUserId),
        inArray(contentContainers.status, [...OPEN_STATUSES])
      )
    )
    .returning();
  if (!updated) {
    throw appError("This content can no longer be edited", "invalid_status", 409);
  }
  return serializeDraft(updated, await publisherFor(refOf(updated)), null);
}

/** An upload session tied to a draft moves it to `uploading`. */
export async function markDraftUploading(ownerUserId: string, draftId: string) {
  const container = await requireOwnedContainer(ownerUserId, draftId);
  if (!(OPEN_STATUSES as readonly string[]).includes(container.status)) {
    throw appError("This content can no longer be edited", "invalid_status", 409);
  }
  await db
    .update(contentContainers)
    .set({ status: "uploading", failureReason: null, updatedAt: new Date() })
    .where(
      and(
        eq(contentContainers.id, draftId),
        eq(contentContainers.createdByMobileUserId, ownerUserId),
        inArray(contentContainers.status, [...OPEN_STATUSES])
      )
    );
  return container;
}

export async function discardDraft(ownerUserId: string, id: string) {
  const [updated] = await db
    .update(contentContainers)
    .set({ status: "discarded", updatedAt: new Date() })
    .where(
      and(
        eq(contentContainers.id, id),
        eq(contentContainers.createdByMobileUserId, ownerUserId),
        inArray(contentContainers.status, [...OPEN_STATUSES])
      )
    )
    .returning({ id: contentContainers.id });
  if (!updated) {
    await requireOwnedContainer(ownerUserId, id);
    throw appError("Published content cannot be discarded", "invalid_status", 409);
  }
  return { id: updated.id, contentStatus: "removed" as const };
}

async function setContainerStatus(
  id: string,
  status: "processing" | "failed",
  failureReason: string | null
) {
  await db
    .update(contentContainers)
    .set({ status, failureReason, updatedAt: new Date() })
    .where(
      and(
        eq(contentContainers.id, id),
        inArray(contentContainers.status, [...OPEN_STATUSES])
      )
    );
}

/**
 * Publish a draft (also used by the legacy `/containers/:id/publish`).
 * Re-validates profile ownership, metadata, media readiness and visibility,
 * then either publishes immediately or, when CONTENT_REQUIRE_REVIEW=true,
 * parks the post in `pending_review`. The publisher is never changed here.
 */
export async function publishContainer(
  ownerUserId: string,
  containerId: string,
  options: { expectedPublisher?: Partial<PublisherRef> } = {}
) {
  const container = await requireOwnedContainer(ownerUserId, containerId);
  const ref = refOf(container);
  const expected = options.expectedPublisher;
  if (
    (expected?.id && expected.id !== ref.id) ||
    (expected?.type && expected.type !== ref.type)
  ) {
    throw appError(
      "Publishing identity does not match this content",
      "forbidden",
      403
    );
  }

  if (container.status === "published" || container.status === "pending_review") {
    const existing = await postForContainer(container.id);
    if (existing) {
      const publisher = await publisherFor(ref);
      return { post: existing, draft: serializeDraft(container, publisher, existing) };
    }
  }
  if (!(OPEN_STATUSES as readonly string[]).includes(container.status)) {
    throw appError("Content is not ready to publish", "invalid_status", 400);
  }

  // 403 when the owner can no longer publish as this profile.
  const owned = await resolveOwnedPublisher(ownerUserId, ref);

  ContentShapeSchema.parse({
    format: container.format,
    mediaType: container.mediaType,
    caption: container.caption,
    mediaIds: container.mediaIds,
    edit: container.edit ?? null,
  });

  const allMedia = [
    ...container.mediaIds,
    ...(container.thumbnailMediaId ? [container.thumbnailMediaId] : []),
  ];
  if (allMedia.length) {
    const { state } = await mediaService.inspectMobileContentAssets(
      ownerUserId,
      allMedia
    );
    if (state === "forbidden") {
      throw appError("Media was not uploaded by this account", "media_forbidden", 403);
    }
    if (state === "pending") {
      await setContainerStatus(container.id, "processing", null);
      throw appError("Media is still processing", "media_processing", 409);
    }
    if (state === "failed") {
      await setContainerStatus(container.id, "failed", "Media upload failed");
      throw appError("Media upload failed", "media_failed", 400);
    }
  }
  // Full asset checks (ownership, readiness, privacy matches visibility).
  const { assets } = await mediaService.requireMobileContentAssets(
    ownerUserId,
    container.mediaIds,
    container.thumbnailMediaId,
    container.visibility
  );
  if (container.format === "clip") {
    if (assets.length !== 1 || assets[0]?.kind !== "video") {
      throw appError("A Clip needs exactly one ready video", "invalid_clip_media", 400);
    }
    if (exceedsClipDuration(assets[0]?.durationMs)) {
      throw appError("Clips can be up to 90 seconds long", "clip_too_long", 400);
    }
  }

  const now = new Date();
  const review = contentRequiresReview();
  const status = review ? "pending_review" : "published";
  const firstVideo = assets.find((asset) => asset?.kind === "video");
  const duplicateClusterId =
    firstVideo?.checksumSha256 ?? firstVideo?.id ?? container.id;
  const clipProvider = await providerClipMetadata(ref, container.format as ContentFormat);

  // Claim the draft and create its post atomically: two taps or two devices
  // must never turn one draft into duplicate posts.
  const post = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(contentContainers)
      .set({
        status,
        failureReason: null,
        publishedAt: review ? null : now,
        updatedAt: now,
      })
      .where(
        and(
          eq(contentContainers.id, container.id),
          eq(contentContainers.createdByMobileUserId, ownerUserId),
          inArray(contentContainers.status, [...OPEN_STATUSES])
        )
      )
      .returning({ id: contentContainers.id });
    if (!claimed) {
      throw appError("Content is not ready to publish", "invalid_status", 400);
    }
    const [created] = await tx
      .insert(contentPosts)
      .values({
        containerId: container.id,
        createdByMobileUserId: ownerUserId,
        ...authorColumnsFor(owned.ref),
        ...clipProvider,
        format: container.format,
        mediaType: container.mediaType,
        caption: container.caption,
        mediaIds: container.mediaIds,
        thumbnailMediaId: container.thumbnailMediaId,
        hashtags: container.hashtags,
        taggedMobileUserIds: container.taggedMobileUserIds,
        location: container.location,
        duplicateClusterId,
        visibility: container.visibility,
        edit: container.edit ?? null,
        musicTrackId: container.edit?.music?.trackId ?? null,
        status,
        expiresAt:
          container.format === "story"
            ? new Date(now.getTime() + STORY_TTL_MS)
            : null,
        publishedAt: now,
      })
      .returning();
    return created!;
  });

  if (post.status === "published") {
    void publishContentEvent(postEvent("post.published", post));
  }
  const refreshed = await requireOwnedContainer(ownerUserId, container.id);
  return { post, draft: serializeDraft(refreshed, owned.publisher, post) };
}

// ── Viewer-facing reads ───────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function encodeCursor(post: Pick<Post, "publishedAt" | "id">) {
  return Buffer.from(`${post.publishedAt.toISOString()}|${post.id}`).toString(
    "base64url"
  );
}

function decodeCursor(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined;
  const [iso, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const at = iso ? new Date(iso) : null;
  if (!at || Number.isNaN(at.getTime()) || !id || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw appError("Invalid cursor", "validation_error", 400);
  }
  return or(
    lt(contentPosts.publishedAt, at),
    and(eq(contentPosts.publishedAt, at), lt(contentPosts.id, id))
  );
}

type ProviderClipCursor = {
  priority: 0 | 1;
  publishedAt: Date;
  id: string;
};

function encodeProviderClipCursor(row: {
  priority: number;
  post: Pick<Post, "publishedAt" | "id">;
}) {
  return Buffer.from(
    `${row.priority}|${row.post.publishedAt.toISOString()}|${row.post.id}`
  ).toString("base64url");
}

function decodeProviderClipCursor(cursor: string | undefined): ProviderClipCursor | null {
  if (!cursor) return null;
  const [rawPriority, iso, id] = Buffer.from(cursor, "base64url")
    .toString("utf8")
    .split("|");
  const priority = Number(rawPriority);
  const publishedAt = iso ? new Date(iso) : null;
  if (
    (priority !== 0 && priority !== 1) ||
    !publishedAt ||
    Number.isNaN(publishedAt.getTime()) ||
    !id ||
    !UUID_RE.test(id)
  ) {
    throw appError("Invalid cursor", "validation_error", 400);
  }
  return { priority, publishedAt, id };
}

function liveCondition(now: Date) {
  return or(isNull(contentPosts.expiresAt), gt(contentPosts.expiresAt, now))!;
}

export async function serializePosts(
  viewer: ViewerContext,
  rows: Post[],
  viewerProfile: PublisherRef = { type: "personal", id: viewer.userId },
) {
  if (!rows.length) return [];
  const publisherRefs = rows.map(row => refOf(row));
  const uniquePublisherRefs = [
    ...new Map(publisherRefs.map(item => [publisherKey(item), item])).values(),
  ];
  const [publishers, likedRows, relationshipEntries] = await Promise.all([
    loadPublishers(publisherRefs),
    db
      .select({ contentPostId: contentPostLikes.contentPostId })
      .from(contentPostLikes)
      .where(
        and(
          eq(contentPostLikes.mobileUserId, viewer.userId),
          inArray(
            contentPostLikes.contentPostId,
            rows.map((row) => row.id)
          )
        )
      ),
    Promise.all(
      uniquePublisherRefs.map(async publisherRef => [
        publisherKey(publisherRef),
        await profileFollowService.relationship(viewerProfile, publisherRef),
      ] as const),
    ),
  ]);
  const relationships = new Map(relationshipEntries);
  const liked = new Set(likedRows.map((row) => row.contentPostId));
  const items = await Promise.all(
    rows.map(async (row) => {
      const ref = refOf(row);
      const publisher = publishers.get(publisherKey(ref));
      if (!publisher) return null;
      const [media, poster] = await Promise.all([
        Promise.all(
          row.mediaIds.map((id) => mediaService.getContentMediaForAuthorizedViewer(id))
        ),
        row.thumbnailMediaId
          ? mediaService.getContentMediaForAuthorizedViewer(row.thumbnailMediaId)
          : Promise.resolve(null),
      ]);
      const deliverable = media.filter(
        (item): item is NonNullable<typeof item> => item !== null
      );
      if (row.mediaType !== "text" && deliverable.length === 0) return null;
      return {
        id: row.id,
        format: row.format as ContentFormat,
        mediaType: row.mediaType,
        contentStatus: contentStatusOf(null, row),
        status: row.status,
        caption: row.caption,
        mediaIds: row.mediaIds,
        media: deliverable,
        thumbnailMediaId: row.thumbnailMediaId,
        posterUrl: poster?.url ?? null,
        hashtags: row.hashtags,
        taggedUserIds: row.taggedMobileUserIds,
        location: row.location ?? null,
        visibility: row.visibility,
        duplicateClusterId: row.duplicateClusterId,
        music: musicAttributionFromEdit(row.edit),
        providerId: row.providerId,
        businessId: row.businessId,
        serviceCategoryId: row.serviceCategoryId,
        publisherProfileId: ref.id,
        publisherProfileType: ref.type,
        publisher,
        relationship: relationships.get(publisherKey(ref)),
        author: legacyAuthor(publisher),
        viewCount: row.viewCount,
        likeCount: row.likeCount,
        commentCount: row.commentCount,
        shareCount: row.shareCount,
        viewerHasLiked: liked.has(row.id),
        viewerCanManage: viewerCanManage(viewer, row),
        createdAt: row.createdAt.toISOString(),
        publishedAt: row.publishedAt.toISOString(),
        expiresAt: row.expiresAt?.toISOString() ?? null,
      };
    })
  );
  return items.filter((item): item is NonNullable<typeof item> => item !== null);
}

/**
 * Chronological, viewer-aware list used by the Flash feed, the Story tray
 * and profile tabs. Only `published`, live content the viewer is allowed to
 * see is returned; profile tabs filter by publisher profile, never by the
 * login user id.
 */
export async function listPosts(
  viewerUserId: string,
  query: {
    format: ContentFormat;
    publisher?: Partial<PublisherRef> & { id: string };
    viewerProfile?: PublisherRef;
    limit: number;
    cursor?: string;
  }
) {
  const now = new Date();
  const [viewer, blocked] = await Promise.all([
    loadViewerContext(viewerUserId),
    loadBlockedPublisherKeys(viewerUserId),
  ]);
  const conditions: (SQL | undefined)[] = [
    eq(contentPosts.format, query.format),
    eq(contentPosts.status, "published"),
    query.format === "story" ? gt(contentPosts.expiresAt, now) : liveCondition(now),
    decodeCursor(query.cursor),
  ];
  if (query.publisher) {
    conditions.push(eq(contentPosts.publisherProfileId, query.publisher.id));
    if (query.publisher.type) {
      conditions.push(eq(contentPosts.publisherProfileType, query.publisher.type));
    }
  }
  const rows = await db
    .select()
    .from(contentPosts)
    .where(and(...conditions))
    .orderBy(desc(contentPosts.publishedAt), desc(contentPosts.id))
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  const visible = (
    await Promise.all(
      page.map(async (row) =>
        !blocked.has(publisherKey(refOf(row))) && (await viewerCanSeePublishedPost(viewer, row, query.viewerProfile))
          ? row
          : null,
      ),
    )
  ).filter((row): row is Post => row !== null);
  return {
    items: await serializePosts(viewer, visible, query.viewerProfile),
    nextCursor:
      rows.length > query.limit && page.length
        ? encodeCursor(page[page.length - 1]!)
        : null,
  };
}

/**
 * Provider-first Clip feed: the selected provider's newest approved Clips,
 * then other active providers in exactly the same service category. The
 * cursor includes the provider-priority bucket so pagination cannot reorder
 * or skip rows when it crosses from the selected provider to its peers.
 */
export async function listProviderCategoryClips(
  viewerUserId: string,
  query: {
    providerId: string;
    serviceCategoryId: string;
    viewerProfile?: PublisherRef;
    limit: number;
    cursor?: string;
  }
) {
  if (!UUID_RE.test(query.providerId) || !query.serviceCategoryId.trim()) {
    throw appError("Provider Clip feed not found", "not_found", 404);
  }
  const [offering] = await db
    .select({ id: providerServiceOfferings.id })
    .from(providerServiceOfferings)
    .innerJoin(
      providers,
      and(
        eq(providers.id, providerServiceOfferings.providerId),
        eq(providers.status, "active")
      )
    )
    .where(
      and(
        eq(providerServiceOfferings.providerId, query.providerId),
        eq(providerServiceOfferings.categoryId, query.serviceCategoryId)
      )
    )
    .limit(1);
  if (!offering) {
    throw appError("Provider Clip feed not found", "not_found", 404);
  }

  const now = new Date();
  const cursor = decodeProviderClipCursor(query.cursor);
  const priority = sql<number>`CASE WHEN ${contentPosts.providerId} = ${query.providerId} THEN 0 ELSE 1 END`;
  const cursorCondition = cursor
    ? or(
        gt(priority, cursor.priority),
        and(
          sql`${priority} = ${cursor.priority}`,
          or(
            lt(contentPosts.publishedAt, cursor.publishedAt),
            and(
              eq(contentPosts.publishedAt, cursor.publishedAt),
              lt(contentPosts.id, cursor.id)
            )
          )
        )
      )
    : undefined;
  const [viewer, blocked] = await Promise.all([
    loadViewerContext(viewerUserId),
    loadBlockedPublisherKeys(viewerUserId),
  ]);
  const rows = await db
    .select({ post: contentPosts, priority })
    .from(contentPosts)
    .innerJoin(providers, eq(providers.id, contentPosts.providerId))
    .where(
      and(
        eq(contentPosts.format, "clip"),
        eq(contentPosts.status, "published"),
        inArray(contentPosts.visibility, ["public", "followers"]),
        eq(contentPosts.serviceCategoryId, query.serviceCategoryId),
        eq(providers.status, "active"),
        liveCondition(now),
        cursorCondition
      )
    )
    .orderBy(asc(priority), desc(contentPosts.publishedAt), desc(contentPosts.id))
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  const visible = (
    await Promise.all(
      page.map(async (row) =>
        !blocked.has(publisherKey(refOf(row.post))) &&
        (await viewerCanSeePublishedPost(viewer, row.post, query.viewerProfile))
          ? row.post
          : null
      )
    )
  ).filter((row): row is Post => row !== null);
  return {
    items: await serializePosts(viewer, visible, query.viewerProfile),
    nextCursor:
      rows.length > query.limit && page.length
        ? encodeProviderClipCursor(page[page.length - 1]!)
        : null,
  };
}

export async function getProfileSummary(
  viewerUserId: string,
  ref: PublisherRef,
  viewerProfile: PublisherRef = { type: "personal", id: viewerUserId },
) {
  const [publisher, viewer, blocked] = await Promise.all([
    loadPublisher(ref),
    loadViewerContext(viewerUserId),
    loadBlockedPublisherKeys(viewerUserId),
  ]);
  if (!publisher || blocked.has(publisherKey(ref))) {
    throw appError("Profile not found", "not_found", 404);
  }
  const now = new Date();
  const details = ref.type === "personal"
    ? await db.select({ bio: mobileUsers.bio, location: mobileUsers.location, website: mobileUsers.website })
        .from(mobileUsers).where(eq(mobileUsers.id, ref.id)).limit(1).then(rows => rows[0] ?? null)
    : await db.select({ publicProfile: providers.publicProfile })
        .from(providers).where(eq(providers.id, ref.id)).limit(1).then(rows => {
          const common = (rows[0]?.publicProfile?.common ?? {}) as Record<string, any>;
          const profile = (common.profile ?? {}) as Record<string, unknown>;
          const location = (common.location ?? {}) as Record<string, unknown>;
          const city = typeof location.city === "string" ? location.city : "";
          const area = typeof location.area === "string" ? location.area : "";
          return {
            bio: typeof profile.description === "string" ? profile.description : null,
            location: [area, city].filter(Boolean).join(", ") || null,
            website: null,
          };
        });
  const categoryRows = ref.type === "business"
    ? await db
        .select({ id: providerServiceOfferings.categoryId })
        .from(providerServiceOfferings)
        .where(eq(providerServiceOfferings.providerId, ref.id))
        .orderBy(
          asc(providerServiceOfferings.createdAt),
          asc(providerServiceOfferings.id)
        )
    : [];
  const relationship = await profileFollowService.relationship(viewerProfile, ref);
  const privacy = await getProfilePrivacy(ref);
  const maySeeProfileContent = relationship.canViewContent;
  const rows = maySeeProfileContent
    ? await db
        .select({ format: contentPosts.format, total: sql<number>`count(*)::int` })
        .from(contentPosts)
        .where(
          and(
            eq(contentPosts.publisherProfileId, ref.id),
            eq(contentPosts.publisherProfileType, ref.type),
            eq(contentPosts.status, "published"),
            liveCondition(now)
          )
        )
        .groupBy(contentPosts.format)
    : [];
  const byFormat = new Map(rows.map((row) => [row.format, Number(row.total)]));
  const clips = byFormat.get("clip") ?? 0;
  const flash = byFormat.get("flash") ?? 0;
  const socialCounts = await profileConnectionCounts(ref);
  return {
    publisher,
    details,
    serviceCategoryId: categoryRows[0]?.id ?? null,
    serviceCategoryIds: categoryRows.map((row) => row.id),
    relationship,
    ...relationship,
    isPrivate: privacy.isPrivate,
    allowMessages: privacy.allowMessages,
    socialCounts,
    counts: {
      posts: clips + flash,
      clips,
      flash,
      stories: byFormat.get("story") ?? 0,
    },
    viewerCanManage:
      ref.type === "personal"
        ? ref.id === viewer.userId
        : viewer.managedProviderIds.includes(ref.id),
  };
}

/**
 * Owner management view ("My Content") across every profile the user owns,
 * including drafts and non-public states. Never exposed to other viewers.
 */
export async function listMine(
  ownerUserId: string,
  options: { publisherProfileId?: string; limit?: number } = {}
) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  // Unfinished containers (no post yet) are queried on their own so a long
  // run of later publishes can never push drafts, processing or failed items
  // out of the owner's view.
  const containerConditions: SQL[] = [
    eq(contentContainers.createdByMobileUserId, ownerUserId),
    notInArray(contentContainers.status, ["discarded", "published"]),
    sql`NOT EXISTS (SELECT 1 FROM content_posts p WHERE p.container_id = ${contentContainers.id})`,
  ];
  const postConditions: SQL[] = [eq(contentPosts.createdByMobileUserId, ownerUserId)];
  if (options.publisherProfileId) {
    containerConditions.push(
      eq(contentContainers.publisherProfileId, options.publisherProfileId)
    );
    postConditions.push(eq(contentPosts.publisherProfileId, options.publisherProfileId));
  }
  const [containers, posts] = await Promise.all([
    db
      .select()
      .from(contentContainers)
      .where(and(...containerConditions))
      .orderBy(desc(contentContainers.createdAt))
      .limit(limit),
    db
      .select()
      .from(contentPosts)
      .where(and(...postConditions))
      .orderBy(desc(contentPosts.createdAt))
      .limit(limit),
  ]);
  const postContainerIds = new Set(posts.map((post) => post.containerId));
  const publishers = await loadPublishers([
    ...containers.map((row) => refOf(row)),
    ...posts.map((row) => refOf(row)),
  ]);
  const items = [
    ...posts.map((post) => ({ post, container: null as Container | null })),
    ...containers
      .filter((container) => !postContainerIds.has(container.id))
      .map((container) => ({ post: null as Post | null, container })),
  ]
    .map(({ post, container }) => {
      const row = (post ?? container)!;
      const ref = refOf(row);
      const publisher = publishers.get(publisherKey(ref));
      if (!publisher) return null;
      return {
        id: row.id,
        draftId: post ? post.containerId : container!.id,
        postId: post?.id ?? null,
        contentType: row.format as ContentFormat,
        contentStatus: contentStatusOf(container, post),
        visibility: row.visibility,
        ownerUserId,
        publisherProfileId: ref.id,
        publisherProfileType: ref.type,
        publisher,
        mediaType: row.mediaType,
        caption: row.caption,
        failureReason: container?.failureReason ?? null,
        createdAt: row.createdAt.toISOString(),
        publishedAt: post?.publishedAt.toISOString() ?? null,
        expiresAt: post?.expiresAt?.toISOString() ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    // Up to `limit` unfinished items plus up to `limit` posts; no shared
    // truncation, so in-progress work is always returned.
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { items };
}

/**
 * Shared engagement gate: the post must be published, live, visible to the
 * viewer, from an active publisher the viewer has not blocked. Returns 404
 * otherwise so hidden content is not disclosed.
 */
export async function requireVisiblePost(
  viewerUserId: string,
  postId: string,
  viewerProfile?: PublisherRef,
) {
  if (!UUID_RE.test(postId)) throw appError("Content not found", "not_found", 404);
  const now = new Date();
  const [viewer, blocked, rows] = await Promise.all([
    loadViewerContext(viewerUserId),
    loadBlockedPublisherKeys(viewerUserId),
    db
      .select()
      .from(contentPosts)
      .where(
        and(
          eq(contentPosts.id, postId),
          eq(contentPosts.status, "published"),
          liveCondition(now)
        )
      )
      .limit(1),
  ]);
  const post = rows[0];
  if (!post || !(await viewerCanSeePublishedPost(viewer, post, viewerProfile))) {
    throw appError("Content not found", "not_found", 404);
  }
  const ref = refOf(post);
  if (blocked.has(publisherKey(ref))) {
    throw appError("Content not found", "not_found", 404);
  }
  const publisher = await loadPublisher(ref);
  if (!publisher) throw appError("Content not found", "not_found", 404);
  return { post, viewer, publisher, ref };
}


/**
 * Whether this viewer could see the post before it was removed: same
 * privacy and block rules as the feed, ignoring the current status. Used
 * so removal notices only reach viewers who could have had the post.
 */
export async function viewerCouldSeePost(
  viewerUserId: string,
  postId: string,
  viewerProfile?: PublisherRef,
) {
  if (!UUID_RE.test(postId)) return false;
  const [viewer, blocked, rows] = await Promise.all([
    loadViewerContext(viewerUserId),
    loadBlockedPublisherKeys(viewerUserId),
    db.select().from(contentPosts).where(eq(contentPosts.id, postId)).limit(1),
  ]);
  const post = rows[0];
  if (!post || blocked.has(publisherKey(refOf(post)))) return false;
  return viewerCanSeePublishedPost(viewer, post, viewerProfile);
}

/**
 * One published post as the viewer's feed would show it, or 404 when the
 * viewer may not see it (private, blocked, removed, unpublished, expired).
 */
export async function getVisiblePost(
  viewerUserId: string,
  postId: string,
  viewerProfile?: PublisherRef,
) {
  const { post, viewer } = await requireVisiblePost(viewerUserId, postId, viewerProfile);
  const [item] = await serializePosts(viewer, [post], viewerProfile);
  if (!item) throw appError("Content not found", "not_found", 404);
  return item;
}

/**
 * Owner delete. The account that created the post, or a member who manages
 * the publishing business (the same rule as `viewerCanManage` on feed items),
 * can remove it; it then disappears from every feed, profile and engagement
 * path (status `removed`). Anyone else gets 404 so the existence of a post is
 * not disclosed.
 */
export async function deletePost(viewerUserId: string, postId: string) {
  if (!UUID_RE.test(postId)) throw appError("Content not found", "not_found", 404);
  const [[post], viewer] = await Promise.all([
    db.select().from(contentPosts).where(eq(contentPosts.id, postId)).limit(1),
    loadViewerContext(viewerUserId),
  ]);
  if (!post || !viewerCanManage(viewer, post)) {
    throw appError("Content not found", "not_found", 404);
  }
  if (post.status !== "removed") {
    await db
      .update(contentPosts)
      .set({ status: "removed" })
      .where(eq(contentPosts.id, post.id));
    void publishContentEvent(postEvent("post.removed", post));
  }
  return { id: post.id, contentStatus: "removed" as const };
}

type CommentRow = typeof contentPostComments.$inferSelect;

async function serializeComments(rows: CommentRow[]) {
  const publishers = await loadPublishers(rows.map((row) => refOf(row)));
  return rows
    .map((row) => {
      const ref = refOf(row);
      const publisher = publishers.get(publisherKey(ref));
      if (!publisher) return null;
      return {
        id: row.id,
        postId: row.contentPostId,
        body: row.body,
        publisherProfileId: ref.id,
        publisherProfileType: ref.type,
        publisher,
        author: legacyAuthor(publisher),
        createdAt: row.createdAt.toISOString(),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
}

export async function listComments(
  viewerUserId: string,
  postId: string,
  viewerProfile?: PublisherRef,
) {
  await requireVisiblePost(viewerUserId, postId, viewerProfile);
  const blocked = await loadBlockedPublisherKeys(viewerUserId);
  const rows = await db
    .select()
    .from(contentPostComments)
    .where(
      and(
        eq(contentPostComments.contentPostId, postId),
        eq(contentPostComments.status, "published")
      )
    )
    .orderBy(asc(contentPostComments.createdAt))
    .limit(200);
  return {
    items: await serializeComments(
      rows.filter((row) => !blocked.has(publisherKey(refOf(row))))
    ),
  };
}

/** Comment as the personal profile (default) or an owned business profile. */
export async function createComment(
  viewerUserId: string,
  postId: string,
  body: CreateContentCommentRequest
) {
  const owned = await resolveOwnedPublisher(viewerUserId, {
    id: body.publisherProfileId,
    type: body.publisherProfileType,
  });
  // The selected publisher is also the viewer identity. This matters when a
  // business follows a private profile: the business can see and comment on
  // the same post the feed already returned, even if the owner's personal
  // profile does not follow it.
  const { post } = await requireVisiblePost(viewerUserId, postId, owned.ref);
  if (await profilesAreBlocked(owned.ref, refOf(post))) {
    throw appError("Content not found", "not_found", 404);
  }
  const comment = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(contentPostComments)
      .values({
        contentPostId: post.id,
        ownerMobileUserId: viewerUserId,
        ...authorColumnsFor(owned.ref),
        body: body.body,
      })
      .returning();
    await tx
      .update(contentPosts)
      .set({ commentCount: sql`${contentPosts.commentCount} + 1` })
      .where(eq(contentPosts.id, post.id));
    return created!;
  });
  const [serialized] = await serializeComments([comment]);
  return serialized!;
}

// ── Admin review (only used when CONTENT_REQUIRE_REVIEW=true) ─────────────

export async function listPendingReview(limit = 50) {
  const rows = await db
    .select()
    .from(contentPosts)
    .where(eq(contentPosts.status, "pending_review"))
    .orderBy(asc(contentPosts.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
  const publishers = await loadPublishers(rows.map((row) => refOf(row)));
  return rows.map((row) => {
    const ref = refOf(row);
    return {
      id: row.id,
      format: row.format,
      mediaType: row.mediaType,
      caption: row.caption,
      mediaIds: row.mediaIds,
      visibility: row.visibility,
      contentStatus: contentStatusOf(null, row),
      publisherProfileId: ref.id,
      publisherProfileType: ref.type,
      publisher: publishers.get(publisherKey(ref)) ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/**
 * Approve or reject a pending post. Moderation only changes the content
 * status — never the publisher profile or owner.
 */
export async function reviewPost(
  postId: string,
  decision: "approve" | "reject",
  note?: string
) {
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(contentPosts)
      .where(and(eq(contentPosts.id, postId), eq(contentPosts.status, "pending_review")))
      .limit(1);
    if (!current) throw appError("Pending content not found", "not_found", 404);
    const status = decision === "approve" ? "published" : "rejected";
    const [updated] = await tx
      .update(contentPosts)
      .set({
        status,
        reviewNote: note ?? null,
        reviewedAt: now,
        ...(decision === "approve"
          ? {
              publishedAt: now,
              expiresAt:
                current.format === "story"
                  ? new Date(now.getTime() + STORY_TTL_MS)
                  : current.expiresAt,
            }
          : {}),
      })
      .where(and(eq(contentPosts.id, postId), eq(contentPosts.status, "pending_review")))
      .returning();
    if (!updated) throw appError("Pending content not found", "not_found", 404);
    if (updated.containerId) {
      await tx
        .update(contentContainers)
        .set({
          status,
          updatedAt: now,
          ...(decision === "approve" ? { publishedAt: now } : {}),
        })
        .where(eq(contentContainers.id, updated.containerId));
    }
    return {
      id: updated.id,
      contentStatus: contentStatusOf(null, updated),
      row: updated,
    };
  });
  if (result.row.status === "published") {
    void publishContentEvent(postEvent("post.published", result.row));
  }
  return { id: result.id, contentStatus: result.contentStatus };
}
