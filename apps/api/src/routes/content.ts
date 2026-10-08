import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { Hono } from "hono";
import {
  ContentFormatSchema,
  ContentPostsQuerySchema,
  CompleteUploadRequestSchema,
  CreateContentCommentRequestSchema,
  CreateContentContainerRequestSchema,
  CreateContentDraftRequestSchema,
  CreateContentUploadRequestSchema,
  PublishContentDraftRequestSchema,
  RecordContentClipViewRequestSchema,
  SetContentClipLikeRequestSchema,
  UpdateContentDraftRequestSchema,
} from "@anticlock/contracts";
import { ZodError } from "zod";
import { db } from "../db/client.js";
import {
  contentClusterDeliveries,
  contentContainers,
  contentPostLikes,
  contentPostDeliveries,
  contentPostViewEvents,
  contentPosts,
  mobileUserBlocks,
  mobileUsers,
  providers,
} from "../db/schema.js";
import { mediaService } from "../media/MediaService.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import {
  listPublishingIdentities,
  resolvePublishingContext,
  toPublishingContext,
} from "../publishing/PublishingContextService.js";
import {
  authorColumnsFor,
  legacyAuthor,
  loadPublishers,
  loadViewerContext,
  normalizePublisherType,
  publisherKey,
  publisherRefFromAuthor,
  resolveOwnedPublisher,
  viewerCanManage,
} from "../publishing/publisher.js";
import {
  createComment,
  createDraft,
  deletePost,
  discardDraft,
  getDraft,
  getPost,
  getProfileSummary,
  listComments,
  listMine,
  listPosts,
  markDraftUploading,
  notReportedByViewer,
  publishContainer,
  requireVisiblePost,
  updateDraft,
} from "../content/ContentPublishingService.js";
import {
  exceedsClipDuration,
  listActiveMusicTracks,
  musicAttributionFromEdit,
} from "../content/musicTracks.js";

function errorResponse(error: unknown) {
  const err = error as { status?: number; code?: string; message?: string };
  const validationError = error instanceof ZodError;
  return {
    status: (validationError ? 400 : err.status ?? 500) as
      | 400
      | 403
      | 404
      | 409
      | 410
      | 500,
    body: {
      error: {
        code: validationError ? "validation_error" : err.code ?? "error",
        message: validationError
          ? "Invalid request"
          : err.message ?? "Unexpected error",
      },
    },
  };
}

function requestContext(c: {
  req: { header: (name: string) => string | undefined };
}) {
  return {
    type: c.req.header("x-anticlock-context-type"),
    id: c.req.header("x-anticlock-context-id"),
  };
}

function requireMobile(auth: { kind: string; sub: string }) {
  if (auth.kind !== "mobile") {
    throw Object.assign(new Error("Mobile session required"), {
      code: "forbidden",
      status: 403,
    });
  }
  return auth.sub;
}

async function requireActiveMobile(auth: { kind: string; sub: string }) {
  const mobileUserId = requireMobile(auth);
  const [user] = await db
    .select({ id: mobileUsers.id })
    .from(mobileUsers)
    .where(
      and(eq(mobileUsers.id, mobileUserId), eq(mobileUsers.isActive, true))
    )
    .limit(1);
  if (!user) {
    throw Object.assign(new Error("Active mobile account required"), {
      code: "mobile_account_required",
      status: 403,
    });
  }
  return mobileUserId;
}

type ClipPost = typeof contentPosts.$inferSelect;

type ClipFeedAuthor = {
  type: "user" | "provider";
  id: string;
  name: string;
  avatarUrl: string | null;
};

type PreparedClipCandidate = {
  post: ClipPost;
  author: ClipFeedAuthor;
  playbackUrl: string;
  posterUrl: string | null;
  trendingScore: number;
};

const DELIVERY_CLAIM_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const CLIP_FEED_CANDIDATE_BATCH_SIZE = 120;
/** One account can contribute one counted view to one Clip per day. */
export const CONTENT_CLIP_VIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

export function contentClipViewWindowStart(now = new Date()) {
  return new Date(now.getTime() - CONTENT_CLIP_VIEW_WINDOW_MS);
}

/**
 * Rank Clips by weighted engagement while allowing fresh, popular content to
 * surface ahead of an indefinitely dominant historical post. The score is
 * intentionally calculated in application code so the returned score and the
 * sort order cannot diverge due to database-specific numeric coercion.
 */
export function calculateClipTrendingScore(
  post: Pick<
    ClipPost,
    "viewCount" | "likeCount" | "commentCount" | "shareCount" | "publishedAt"
  >,
  now = new Date()
) {
  const count = (value: number) => Math.max(0, value);
  const ageHours = Math.max(
    0,
    (now.getTime() - post.publishedAt.getTime()) / (60 * 60 * 1000)
  );
  const engagement =
    count(post.viewCount) * 0.05 +
    count(post.likeCount) * 4 +
    count(post.commentCount) * 6 +
    count(post.shareCount) * 8;
  const score = (engagement + 1) / Math.pow(ageHours + 2, 1.15);
  return Math.round(score * 1000) / 1000;
}

/**
 * Database counterpart of `calculateClipTrendingScore`. It lets PostgreSQL
 * order the whole eligible catalog before we resolve media URLs, instead of
 * restricting discovery to a recent, arbitrary slice of posts.
 */
function clipTrendingScoreOrder(now: Date) {
  const engagement = sql`
    GREATEST(${contentPosts.viewCount}, 0) * 0.05 +
    GREATEST(${contentPosts.likeCount}, 0) * 4 +
    GREATEST(${contentPosts.commentCount}, 0) * 6 +
    GREATEST(${contentPosts.shareCount}, 0) * 8
  `;
  // Bind the timestamp as an ISO string. Interpolating a raw Date here makes
  // the drizzle/postgres-js driver throw ("argument must be of type string
  // … Received an instance of Date"), which turned every Clips feed request
  // into a 500 and hid all user-published Clips.
  const ageHours = sql`
    GREATEST(
      0,
      EXTRACT(EPOCH FROM (${now.toISOString()}::timestamptz - ${contentPosts.publishedAt})) / 3600.0
    )
  `;
  // PostgreSQL can only round to a precision for numeric values. Matching the
  // returned three-decimal score keeps its tie-break order deterministic.
  return sql<number>`
    ROUND(((${engagement} + 1) / POWER(${ageHours} + 2, 1.15))::numeric, 3)
  `;
}

async function resolveClipAuthor(
  post: ClipPost
): Promise<ClipFeedAuthor | null> {
  if (post.authorProviderId) {
    const [provider] = await db
      .select({ id: providers.id, name: providers.name })
      .from(providers)
      .where(
        and(
          eq(providers.id, post.authorProviderId),
          eq(providers.status, "active")
        )
      )
      .limit(1);
    return provider
      ? {
          type: "provider",
          id: provider.id,
          name: provider.name,
          avatarUrl: null,
        }
      : null;
  }

  if (!post.authorMobileUserId) return null;
  const [user] = await db
    .select({
      id: mobileUsers.id,
      displayName: mobileUsers.displayName,
      avatarUrl: mobileUsers.avatarUrl,
    })
    .from(mobileUsers)
    .where(
      and(
        eq(mobileUsers.id, post.authorMobileUserId),
        eq(mobileUsers.isActive, true)
      )
    )
    .limit(1);
  return user
    ? {
        type: "user",
        id: user.id,
        name: user.displayName,
        avatarUrl: user.avatarUrl,
      }
    : null;
}

/**
 * Resolve all delivery dependencies before a row is claimed. Otherwise a
 * deleted asset or inactive author can consume the viewer's no-repeat claim
 * and leave the client with an empty page.
 */
async function prepareClipCandidate(
  post: ClipPost,
  now: Date
): Promise<PreparedClipCandidate | null> {
  const playbackMediaId = post.mediaIds[0];
  if (!playbackMediaId) return null;

  const [playbackUrl, posterUrl, author] = await Promise.all([
    mediaService.getPublicContentDeliveryUrl(playbackMediaId, "video"),
    post.thumbnailMediaId
      ? mediaService.getPublicContentDeliveryUrl(post.thumbnailMediaId, "image")
      : Promise.resolve(null),
    resolveClipAuthor(post),
  ]);
  if (!playbackUrl || !author) return null;

  return {
    post,
    author,
    playbackUrl,
    posterUrl,
    trendingScore: calculateClipTrendingScore(post, now),
  };
}

function publishedPublicClipCondition(contentPostId: string, now: Date) {
  return and(
    eq(contentPosts.id, contentPostId),
    eq(contentPosts.format, "clip"),
    eq(contentPosts.mediaType, "video"),
    eq(contentPosts.status, "published"),
    eq(contentPosts.visibility, "public"),
    or(isNull(contentPosts.expiresAt), gt(contentPosts.expiresAt, now))
  );
}

function clipNotFoundError() {
  return Object.assign(new Error("Clip not found"), {
    code: "not_found",
    status: 404,
  });
}

function blockConditionForAuthor(mobileUserId: string, author: ClipFeedAuthor) {
  return author.type === "provider"
    ? and(
        eq(mobileUserBlocks.blockerMobileUserId, mobileUserId),
        eq(mobileUserBlocks.blockedProviderId, author.id)
      )
    : or(
        and(
          eq(mobileUserBlocks.blockerMobileUserId, mobileUserId),
          eq(mobileUserBlocks.blockedMobileUserId, author.id)
        ),
        // A person who blocked the viewer is hidden from them as well.
        and(
          eq(mobileUserBlocks.blockerMobileUserId, author.id),
          eq(mobileUserBlocks.blockedMobileUserId, mobileUserId)
        )
      );
}

/** Rows that can enter a viewer's Clips feed (before block filtering). */
function eligibleClipConditions(viewerUserId: string, now: Date): SQL {
  return and(
    eq(contentPosts.format, "clip"),
    eq(contentPosts.mediaType, "video"),
    eq(contentPosts.status, "published"),
    eq(contentPosts.visibility, "public"),
    or(isNull(contentPosts.expiresAt), gt(contentPosts.expiresAt, now)),
    notReportedByViewer(viewerUserId)
  )!;
}

/** How long an author's own new Reel is pinned to the top of their feed. */
const OWN_FRESH_CLIP_MS = 24 * 60 * 60 * 1000;

type ClipFeedCursor = { recycleOffset: number };

function encodeClipFeedCursor(cursor: ClipFeedCursor) {
  return Buffer.from(JSON.stringify({ r: cursor.recycleOffset })).toString(
    "base64url"
  );
}

function decodeClipFeedCursor(raw: string | undefined): ClipFeedCursor {
  if (!raw) return { recycleOffset: 0 };
  try {
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const offset = Number(value?.r);
    if (Number.isInteger(offset) && offset >= 0 && offset < 100_000) {
      return { recycleOffset: offset };
    }
  } catch {
    // fall through
  }
  throw Object.assign(new Error("Invalid cursor"), {
    code: "validation_error",
    status: 400,
  });
}

/**
 * Engagement is only accepted for the same playable public Clip that can
 * enter the feed. Returning not_found for a block avoids disclosing whether a
 * blocked profile still has a particular post.
 */
async function requireEligiblePublicClipForEngagement(
  mobileUserId: string,
  contentPostId: string,
  now: Date
) {
  const [post] = await db
    .select()
    .from(contentPosts)
    .where(publishedPublicClipCondition(contentPostId, now))
    .limit(1);
  if (!post || !post.mediaIds[0]) throw clipNotFoundError();

  const author = await resolveClipAuthor(post);
  if (!author) throw clipNotFoundError();

  const [block] = await db
    .select({ id: mobileUserBlocks.id })
    .from(mobileUserBlocks)
    .where(blockConditionForAuthor(mobileUserId, author))
    .limit(1);
  if (block) throw clipNotFoundError();

  if (
    !(await mediaService.isPublicContentDeliverable(post.mediaIds[0], "video"))
  ) {
    throw clipNotFoundError();
  }

  return { post, author };
}

export const contentMobileRoutes = new Hono<AppEnv>();
contentMobileRoutes.use("/identities", requireAuth);
contentMobileRoutes.use("/uploads", requireAuth);
contentMobileRoutes.use("/uploads/*", requireAuth);
contentMobileRoutes.use("/containers", requireAuth);
contentMobileRoutes.use("/containers/*", requireAuth);
contentMobileRoutes.use("/posts", requireAuth);
contentMobileRoutes.use("/posts/*", requireAuth);
contentMobileRoutes.use("/music-tracks", requireAuth);
contentMobileRoutes.use("/drafts", requireAuth);
contentMobileRoutes.use("/drafts/*", requireAuth);
contentMobileRoutes.use("/profiles/*", requireAuth);
contentMobileRoutes.use("/mine", requireAuth);

/**
 * Server-managed music for the Clip editor. Returns only tracks an operator
 * has activated; an empty list is expected until licensed tracks are added.
 */
contentMobileRoutes.get("/music-tracks", async (c) => {
  try {
    await requireActiveMobile(c.get("auth"));
    return c.json({ tracks: await listActiveMusicTracks() });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.get("/identities", async (c) => {
  try {
    await requireActiveMobile(c.get("auth"));
    return c.json({
      identities: await listPublishingIdentities(c.get("auth")),
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** Mobile-owned upload sessions, separate from the admin Media Library. */
contentMobileRoutes.post("/uploads", async (c) => {
  try {
    const auth = c.get("auth");
    const mobileUserId = await requireActiveMobile(auth);
    const body = CreateContentUploadRequestSchema.parse(await c.req.json());
    const identity = await resolvePublishingContext(auth, requestContext(c));
    if (body.draftId) {
      // Only the draft owner can upload into it; it moves to `uploading`.
      await markDraftUploading(mobileUserId, body.draftId);
    }
    const upload = await mediaService.createMobileContentUploadSession(
      mobileUserId,
      body
    );
    return c.json({ upload, identity }, 201);
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.put("/uploads/:sessionId/content", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    await mediaService.putMobileContentLocalContent(
      mobileUserId,
      c.req.param("sessionId"),
      Buffer.from(await c.req.arrayBuffer())
    );
    return c.json({ ok: true });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post("/uploads/:sessionId/complete", async (c) => {
  try {
    const body = CompleteUploadRequestSchema.parse(
      await c.req.json().catch(() => ({}))
    );
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const result = await mediaService.completeMobileContentUpload(
      mobileUserId,
      c.req.param("sessionId"),
      body.checksumSha256
    );
    return c.json({
      asset: result.asset,
      duplicateOf: result.duplicateOf ?? null,
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post("/containers", async (c) => {
  try {
    const auth = c.get("auth");
    const mobileUserId = await requireActiveMobile(auth);
    const body = CreateContentContainerRequestSchema.parse(await c.req.json());
    // The body's publisherProfileId wins over the legacy context headers.
    const headerContext = requestContext(c);
    const owned = await resolveOwnedPublisher(mobileUserId, {
      id: body.publisherProfileId ?? headerContext.id ?? mobileUserId,
      type:
        body.publisherProfileType ??
        normalizePublisherType(headerContext.type) ??
        (body.publisherProfileId ? undefined : "personal"),
    });
    const actor = toPublishingContext(owned);
    const mediaIds = [...new Set(body.mediaIds)];
    const { assets } = await mediaService.requireMobileContentAssets(
      mobileUserId,
      mediaIds,
      body.thumbnailMediaId,
      body.visibility
    );
    if (
      body.format === "clip" &&
      (assets.length !== 1 || assets[0]?.kind !== "video")
    ) {
      throw Object.assign(new Error("A Clip needs exactly one ready video"), {
        code: "invalid_clip_media",
        status: 400,
      });
    }
    if (body.format === "clip" && exceedsClipDuration(assets[0]?.durationMs)) {
      throw Object.assign(new Error("Clips can be up to 90 seconds long"), {
        code: "clip_too_long",
        status: 400,
      });
    }
    const [container] = await db
      .insert(contentContainers)
      .values({
        createdByMobileUserId: mobileUserId,
        ...authorColumnsFor(owned.ref),
        format: body.format,
        mediaType: body.mediaType,
        caption: body.caption,
        mediaIds,
        thumbnailMediaId: body.thumbnailMediaId ?? null,
        hashtags: [...new Set(body.hashtags)],
        taggedMobileUserIds: [...new Set(body.taggedUserIds)],
        location: body.location ?? null,
        visibility: body.visibility,
        edit: body.format === "clip" ? body.edit ?? null : null,
        status: "ready_to_publish",
      })
      .returning();
    return c.json(
      {
        container: {
          id: container!.id,
          status: container!.status,
          format: container!.format,
          author: actor,
          publisherProfileId: owned.ref.id,
          publisherProfileType: owned.ref.type,
          publisher: owned.publisher,
          createdAt: container!.createdAt.toISOString(),
        },
      },
      201
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post("/containers/:id/publish", async (c) => {
  try {
    const auth = c.get("auth");
    const mobileUserId = await requireActiveMobile(auth);
    const headerContext = requestContext(c);
    // Legacy clients send the identity they selected as headers. It must
    // match the container's publisher; the shared publish path re-validates
    // ownership, media readiness and visibility.
    const result = await publishContainer(mobileUserId, c.req.param("id"), {
      expectedPublisher: headerContext.type
        ? {
            id: headerContext.id ?? mobileUserId,
            type: normalizePublisherType(headerContext.type),
          }
        : undefined,
    });
    return c.json(
      {
        post: {
          id: result.post.id,
          format: result.post.format,
          expiresAt: result.post.expiresAt?.toISOString() ?? null,
          contentStatus: result.draft.contentStatus,
          publisherProfileId: result.draft.publisherProfileId,
          publisherProfileType: result.draft.publisherProfileType,
        },
      },
      201
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

// ── Draft-first publishing (`/v1/content/drafts`) ───────────────────────────
// select profile → create draft (owner + publisher fixed) → upload media with
// `draftId` → attach media → publish. Only the owner can touch a draft.

contentMobileRoutes.post("/drafts", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = CreateContentDraftRequestSchema.parse(await c.req.json());
    return c.json({ draft: await createDraft(mobileUserId, body) }, 201);
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.get("/drafts/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    return c.json({ draft: await getDraft(mobileUserId, c.req.param("id")) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.patch("/drafts/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = UpdateContentDraftRequestSchema.parse(await c.req.json());
    return c.json({
      draft: await updateDraft(mobileUserId, c.req.param("id"), body),
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.delete("/drafts/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    return c.json({ draft: await discardDraft(mobileUserId, c.req.param("id")) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post("/drafts/:id/publish", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = PublishContentDraftRequestSchema.parse(
      await c.req.json().catch(() => ({}))
    );
    const result = await publishContainer(mobileUserId, c.req.param("id"), {
      expectedPublisher: body.publisherProfileId
        ? { id: body.publisherProfileId }
        : undefined,
    });
    return c.json(
      {
        draft: result.draft,
        post: {
          id: result.post.id,
          format: result.post.format,
          contentStatus: result.draft.contentStatus,
          expiresAt: result.post.expiresAt?.toISOString() ?? null,
        },
      },
      201
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** Owner "My Content": every owned profile, every status. */
contentMobileRoutes.get("/mine", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const publisherProfileId = c.req.query("publisherProfileId");
    return c.json(
      await listMine(mobileUserId, {
        publisherProfileId:
          publisherProfileId && /^[0-9a-f-]{36}$/i.test(publisherProfileId)
            ? publisherProfileId
            : undefined,
        limit: Number(c.req.query("limit") ?? 50) || 50,
      })
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/**
 * Viewer-aware feed for Flash, Stories and profile tabs. `data` is kept as
 * an alias of `items` for the current mobile client.
 */
contentMobileRoutes.get("/posts", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const query = ContentPostsQuerySchema.parse({
      format: c.req.query("format"),
      publisherProfileId: c.req.query("publisherProfileId"),
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
    });
    const publisherType = normalizePublisherType(
      c.req.query("publisherProfileType")
    );
    const result = await listPosts(mobileUserId, {
      format: query.format,
      publisher: query.publisherProfileId
        ? { id: query.publisherProfileId, type: publisherType }
        : undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({ ...result, data: result.items });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

function profileRef(type: string, id: string) {
  const profileType = normalizePublisherType(type);
  if (!profileType || !/^[0-9a-f-]{36}$/i.test(id)) {
    throw Object.assign(new Error("Profile not found"), {
      code: "not_found",
      status: 404,
    });
  }
  return { type: profileType, id };
}

/** Public profile header + counts for a personal or business profile. */
contentMobileRoutes.get("/profiles/:type/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const ref = profileRef(c.req.param("type"), c.req.param("id"));
    return c.json({ profile: await getProfileSummary(mobileUserId, ref) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** Content published AS this profile (never by login user id). */
contentMobileRoutes.get("/profiles/:type/:id/posts", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const ref = profileRef(c.req.param("type"), c.req.param("id"));
    const query = ContentPostsQuerySchema.parse({
      format: c.req.query("format") ?? "clip",
      limit: c.req.query("limit"),
      cursor: c.req.query("cursor"),
    });
    const result = await listPosts(mobileUserId, {
      format: query.format,
      publisher: ref,
      limit: query.limit,
      cursor: query.cursor,
    });
    return c.json({ ...result, data: result.items });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.get("/posts/:id/comments", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    return c.json(await listComments(mobileUserId, c.req.param("id")));
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

contentMobileRoutes.post("/posts/:id/comments", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = CreateContentCommentRequestSchema.parse(await c.req.json());
    return c.json(
      { comment: await createComment(mobileUserId, c.req.param("id"), body) },
      201
    );
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/**
 * Authenticated Clips feed. It claims both a post and its exact media cluster
 * for the same 90-day retention period, so refreshes and concurrent devices
 * cannot surface repeated videos or duplicate uploads to one viewer.
 */
contentMobileRoutes.get("/feeds/clip", requireAuth, async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const limit = Math.min(
      Math.max(Number(c.req.query("limit") ?? 12) || 12, 1),
      30
    );
    const cursor = decodeClipFeedCursor(c.req.query("cursor"));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DELIVERY_CLAIM_TTL_MS);
    const selected = await db.transaction(async (tx) => {
      // The advisory lock serializes a user's refreshes across API instances.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${mobileUserId}))`
      );

      // Re-read blocks under the same transaction immediately before writes.
      // A blocked user or business is filtered before it can consume a claim.
      // People who blocked the viewer are hidden from them too.
      const blockRows = await tx
        .select({
          blockerMobileUserId: mobileUserBlocks.blockerMobileUserId,
          blockedMobileUserId: mobileUserBlocks.blockedMobileUserId,
          blockedProviderId: mobileUserBlocks.blockedProviderId,
        })
        .from(mobileUserBlocks)
        .where(
          or(
            eq(mobileUserBlocks.blockerMobileUserId, mobileUserId),
            eq(mobileUserBlocks.blockedMobileUserId, mobileUserId)
          )
        );
      const blockedMobileUserIds = new Set<string>();
      const blockedProviderIds = new Set<string>();
      for (const row of blockRows) {
        if (row.blockerMobileUserId !== mobileUserId) {
          blockedMobileUserIds.add(row.blockerMobileUserId);
          continue;
        }
        if (row.blockedMobileUserId) blockedMobileUserIds.add(row.blockedMobileUserId);
        if (row.blockedProviderId) blockedProviderIds.add(row.blockedProviderId);
      }
      const isBlocked = (post: ClipPost) =>
        post.authorProviderId
          ? blockedProviderIds.has(post.authorProviderId)
          : post.authorMobileUserId
          ? blockedMobileUserIds.has(post.authorMobileUserId)
          : true;

      await tx
        .delete(contentPostDeliveries)
        .where(
          and(
            eq(contentPostDeliveries.mobileUserId, mobileUserId),
            lte(contentPostDeliveries.expiresAt, now)
          )
        );
      await tx
        .delete(contentClusterDeliveries)
        .where(
          and(
            eq(contentClusterDeliveries.mobileUserId, mobileUserId),
            lte(contentClusterDeliveries.expiresAt, now)
          )
        );
      const [postClaims, clusterClaims] = await Promise.all([
        tx
          .select({ id: contentPostDeliveries.contentPostId })
          .from(contentPostDeliveries)
          .where(
            and(
              eq(contentPostDeliveries.mobileUserId, mobileUserId),
              gt(contentPostDeliveries.expiresAt, now)
            )
          ),
        tx
          .select({ id: contentClusterDeliveries.duplicateClusterId })
          .from(contentClusterDeliveries)
          .where(
            and(
              eq(contentClusterDeliveries.mobileUserId, mobileUserId),
              gt(contentClusterDeliveries.expiresAt, now)
            )
          ),
      ]);
      const deliveredPosts = new Set(postClaims.map((claim) => claim.id));
      const deliveredClusters = new Set(clusterClaims.map((claim) => claim.id));
      const claimed: PreparedClipCandidate[] = [];
      const scoreOrder = clipTrendingScoreOrder(now);
      // The author's own Reel from the last day leads their feed, so a new
      // upload is visible to them immediately (as on other Reels apps).
      const ownFreshFirst = sql<number>`CASE WHEN ${contentPosts.createdByMobileUserId} = ${mobileUserId}
        AND ${contentPosts.publishedAt} > ${new Date(now.getTime() - OWN_FRESH_CLIP_MS).toISOString()}::timestamptz
        THEN 0 ELSE 1 END`;
      let offset = 0;

      // Start with the highest-ranked rows from the entire eligible catalog,
      // then continue in small pages only when a row has already been seen,
      // blocked, or becomes unavailable during preparation. This avoids the
      // previous "newest 120" ceiling while keeping media URL work bounded in
      // the normal case.
      while (claimed.length < limit) {
        const batch = await tx
          .select()
          .from(contentPosts)
          .where(eligibleClipConditions(mobileUserId, now))
          .orderBy(
            asc(ownFreshFirst),
            desc(scoreOrder),
            desc(contentPosts.publishedAt),
            asc(contentPosts.id)
          )
          .limit(CLIP_FEED_CANDIDATE_BATCH_SIZE)
          .offset(offset);
        if (batch.length === 0) break;
        offset += batch.length;

        for (const post of batch) {
          if (
            isBlocked(post) ||
            deliveredPosts.has(post.id) ||
            deliveredClusters.has(post.duplicateClusterId)
          ) {
            continue;
          }

          // This is deliberately inside the serialized claim path. An invalid
          // or newly unavailable video/author never consumes a no-repeat row.
          const candidate = await prepareClipCandidate(post, now);
          if (!candidate) continue;

          const [postClaim] = await tx
            .insert(contentPostDeliveries)
            .values({
              mobileUserId,
              contentPostId: post.id,
              expiresAt,
            })
            .onConflictDoNothing()
            .returning({ id: contentPostDeliveries.contentPostId });
          if (!postClaim) continue;

          const [clusterClaim] = await tx
            .insert(contentClusterDeliveries)
            .values({
              mobileUserId,
              duplicateClusterId: post.duplicateClusterId,
              expiresAt,
            })
            .onConflictDoNothing()
            .returning({ id: contentClusterDeliveries.duplicateClusterId });
          if (!clusterClaim) {
            // Do not leave a phantom post claim after a cluster claim loses a
            // race with another request.
            await tx
              .delete(contentPostDeliveries)
              .where(
                and(
                  eq(contentPostDeliveries.mobileUserId, mobileUserId),
                  eq(contentPostDeliveries.contentPostId, post.id)
                )
              );
            continue;
          }
          deliveredPosts.add(post.id);
          deliveredClusters.add(post.duplicateClusterId);
          claimed.push(candidate);
          if (claimed.length >= limit) break;
        }

        if (batch.length < CLIP_FEED_CANDIDATE_BATCH_SIZE) break;
      }

      if (claimed.length >= limit) {
        // More unseen Reels may exist; the next page claims them.
        return { items: claimed, nextRecycleOffset: cursor.recycleOffset };
      }

      // Everything unseen has been delivered. Instead of an empty feed, keep
      // the viewer scrolling through Reels they were already shown (best
      // first). These rows are not re-claimed, so nothing new is consumed.
      const recycled: PreparedClipCandidate[] = [];
      const claimedIds = claimed.map((candidate) => candidate.post.id);
      let recycleOffset = cursor.recycleOffset;
      let exhausted = false;
      while (claimed.length + recycled.length < limit) {
        const batch = await tx
          .select()
          .from(contentPosts)
          .where(
            and(
              eligibleClipConditions(mobileUserId, now),
              sql`${contentPosts.id} IN (
                SELECT ${contentPostDeliveries.contentPostId} FROM ${contentPostDeliveries}
                WHERE ${contentPostDeliveries.mobileUserId} = ${mobileUserId}
                  AND ${contentPostDeliveries.expiresAt} > ${now.toISOString()}::timestamptz
              )`,
              claimedIds.length ? notInArray(contentPosts.id, claimedIds) : undefined
            )
          )
          .orderBy(
            desc(scoreOrder),
            desc(contentPosts.publishedAt),
            asc(contentPosts.id)
          )
          .limit(CLIP_FEED_CANDIDATE_BATCH_SIZE)
          .offset(recycleOffset);
        if (batch.length === 0) {
          exhausted = true;
          break;
        }
        for (const post of batch) {
          recycleOffset += 1;
          if (isBlocked(post)) continue;
          const candidate = await prepareClipCandidate(post, now);
          if (!candidate) continue;
          recycled.push(candidate);
          if (claimed.length + recycled.length >= limit) break;
        }
        if (
          batch.length < CLIP_FEED_CANDIDATE_BATCH_SIZE &&
          claimed.length + recycled.length < limit
        ) {
          exhausted = true;
          break;
        }
      }
      return {
        items: [...claimed, ...recycled],
        nextRecycleOffset: exhausted ? null : recycleOffset,
      };
    });

    const items = selected.items;
    const [likedRows, viewer] = await Promise.all([
      items.length
        ? db
            .select({ contentPostId: contentPostLikes.contentPostId })
            .from(contentPostLikes)
            .where(
              and(
                eq(contentPostLikes.mobileUserId, mobileUserId),
                inArray(
                  contentPostLikes.contentPostId,
                  items.map((candidate) => candidate.post.id)
                )
              )
            )
        : Promise.resolve([]),
      loadViewerContext(mobileUserId),
    ]);
    const likedPostIds = new Set(likedRows.map((row) => row.contentPostId));
    const publisherRefs = items
      .map((candidate) => publisherRefFromAuthor(candidate.post))
      .filter((ref): ref is NonNullable<typeof ref> => ref !== null);
    const publishers = await loadPublishers(publisherRefs);

    return c.json({
      items: items.map((candidate) => {
        const post = candidate.post;
        const ref = publisherRefFromAuthor(post);
        const publisher = ref ? publishers.get(publisherKey(ref)) ?? null : null;
        return {
          publisherProfileId: ref?.id ?? candidate.author.id,
          publisherProfileType: ref?.type ?? (candidate.author.type === "provider" ? "business" : "personal"),
          publisher,
          id: post.id,
          format: post.format,
          mediaType: post.mediaType,
          status: post.status,
          caption: post.caption,
          mediaIds: post.mediaIds,
          thumbnailMediaId: post.thumbnailMediaId,
          hashtags: post.hashtags,
          // The public contract intentionally avoids persistence-specific
          // names such as `taggedMobileUserIds`.
          taggedUserIds: post.taggedMobileUserIds,
          location: post.location,
          visibility: post.visibility,
          author: publisher ? legacyAuthor(publisher) : candidate.author,
          createdAt: post.createdAt.toISOString(),
          publishedAt: post.publishedAt.toISOString(),
          expiresAt: post.expiresAt?.toISOString() ?? null,
          playbackUrl: candidate.playbackUrl,
          posterUrl: candidate.posterUrl,
          duplicateClusterId: post.duplicateClusterId,
          trendingScore: candidate.trendingScore,
          viewCount: post.viewCount,
          likeCount: post.likeCount,
          commentCount: post.commentCount,
          shareCount: post.shareCount,
          viewerHasLiked: likedPostIds.has(post.id),
          viewerCanManage: viewerCanManage(viewer, post),
          music: musicAttributionFromEdit(post.edit),
        };
      }),
      nextCursor:
        selected.nextRecycleOffset === null
          ? null
          : encodeClipFeedCursor({ recycleOffset: selected.nextRecycleOffset }),
    });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** One visible post, e.g. a shared Reel link. */
contentMobileRoutes.get("/posts/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    return c.json({ post: await getPost(mobileUserId, c.req.param("id")) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/** Owner (or managing business member) removes a published post. */
contentMobileRoutes.delete("/posts/:id", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    return c.json({ post: await deletePost(mobileUserId, c.req.param("id")) });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/**
 * Records one meaningful playback impression. A viewer can add at most one
 * count for a Clip per 24-hour window; reusing an event id remains a safe
 * retry, and new ids cannot be used to inflate the aggregate.
 */
contentMobileRoutes.post("/posts/:id/view-events", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = RecordContentClipViewRequestSchema.parse(await c.req.json());
    const now = new Date();
    const { post, author } = await requireEligiblePublicClipForEngagement(
      mobileUserId,
      c.req.param("id"),
      now
    );
    const data = await db.transaction(async (tx) => {
      // Serializing this exact viewer/Clip pair makes the window check and
      // insert atomic even when a client retries from multiple devices.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`content-clip-view:${mobileUserId}:${post.id}`}))`
      );
      const [block] = await tx
        .select({ id: mobileUserBlocks.id })
        .from(mobileUserBlocks)
        .where(blockConditionForAuthor(mobileUserId, author))
        .limit(1);
      if (block) throw clipNotFoundError();

      const [recentView] = await tx
        .select({ id: contentPostViewEvents.id })
        .from(contentPostViewEvents)
        .where(
          and(
            eq(contentPostViewEvents.contentPostId, post.id),
            eq(contentPostViewEvents.mobileUserId, mobileUserId),
            gt(contentPostViewEvents.createdAt, contentClipViewWindowStart(now))
          )
        )
        .limit(1);
      if (recentView) return { recorded: false };

      const [event] = await tx
        .insert(contentPostViewEvents)
        .values({
          contentPostId: post.id,
          mobileUserId,
          eventId: body.eventId,
          watchedMs: body.watchedMs,
        })
        .onConflictDoNothing()
        .returning({ id: contentPostViewEvents.id });
      if (!event) return { recorded: false };

      const [updated] = await tx
        .update(contentPosts)
        .set({ viewCount: sql`${contentPosts.viewCount} + 1` })
        .where(publishedPublicClipCondition(post.id, now))
        .returning({ viewCount: contentPosts.viewCount });
      if (!updated) throw clipNotFoundError();
      return { recorded: true, viewCount: updated.viewCount };
    });
    return c.json({ data });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

/**
 * A set-state like endpoint makes repeats and racing devices idempotent while
 * keeping the rank counter server-owned.
 */
/**
 * Public Clips keep their stricter feed-equivalent gate (playable public
 * video). Every other post (Flash, Stories, non-public content the viewer may
 * see) goes through the shared audience check, so likes work for personal
 * and business publishers alike.
 */
async function requireLikeablePost(
  mobileUserId: string,
  contentPostId: string,
  now: Date
) {
  const [row] = await db
    .select({ format: contentPosts.format, visibility: contentPosts.visibility })
    .from(contentPosts)
    .where(eq(contentPosts.id, contentPostId))
    .limit(1);
  if (row?.format === "clip" && row.visibility === "public") {
    const { post, author } = await requireEligiblePublicClipForEngagement(
      mobileUserId,
      contentPostId,
      now
    );
    return {
      post,
      author,
      updateCondition: publishedPublicClipCondition(post.id, now),
    };
  }
  const { post, publisher } = await requireVisiblePost(mobileUserId, contentPostId);
  return {
    post,
    author: legacyAuthor(publisher) as ClipFeedAuthor,
    updateCondition: and(
      eq(contentPosts.id, post.id),
      eq(contentPosts.status, "published")
    ),
  };
}

contentMobileRoutes.put("/posts/:id/like", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = SetContentClipLikeRequestSchema.parse(await c.req.json());
    const now = new Date();
    const { post, author, updateCondition } = await requireLikeablePost(
      mobileUserId,
      c.req.param("id"),
      now
    );
    const data = await db.transaction(async (tx) => {
      const [block] = await tx
        .select({ id: mobileUserBlocks.id })
        .from(mobileUserBlocks)
        .where(blockConditionForAuthor(mobileUserId, author))
        .limit(1);
      if (block) throw clipNotFoundError();

      if (body.liked) {
        const [like] = await tx
          .insert(contentPostLikes)
          .values({ contentPostId: post.id, mobileUserId })
          .onConflictDoNothing()
          .returning({ contentPostId: contentPostLikes.contentPostId });
        if (!like) return { liked: true, changed: false };

        const [updated] = await tx
          .update(contentPosts)
          .set({ likeCount: sql`${contentPosts.likeCount} + 1` })
          .where(updateCondition)
          .returning({ likeCount: contentPosts.likeCount });
        if (!updated) throw clipNotFoundError();
        return { liked: true, changed: true, likeCount: updated.likeCount };
      }

      const [removed] = await tx
        .delete(contentPostLikes)
        .where(
          and(
            eq(contentPostLikes.contentPostId, post.id),
            eq(contentPostLikes.mobileUserId, mobileUserId)
          )
        )
        .returning({ contentPostId: contentPostLikes.contentPostId });
      if (!removed) return { liked: false, changed: false };

      const [updated] = await tx
        .update(contentPosts)
        .set({ likeCount: sql`GREATEST(${contentPosts.likeCount} - 1, 0)` })
        .where(updateCondition)
        .returning({ likeCount: contentPosts.likeCount });
      if (!updated) throw clipNotFoundError();
      return { liked: false, changed: true, likeCount: updated.likeCount };
    });
    return c.json({ data });
  } catch (error) {
    const { status, body } = errorResponse(error);
    return c.json(body, status);
  }
});

export const contentPublicRoutes = new Hono<AppEnv>();
contentPublicRoutes.get("/feeds/:format", async (c) => {
  const parsed = ContentFormatSchema.safeParse(c.req.param("format"));
  if (!parsed.success)
    return c.json(
      { error: { code: "validation_error", message: "Unknown feed format" } },
      400
    );
  const now = new Date();
  const rows = await db
    .select()
    .from(contentPosts)
    .where(
      and(
        eq(contentPosts.format, parsed.data),
        eq(contentPosts.status, "published"),
        // This endpoint has no viewer identity, so it must never reveal content
        // intended for followers, friends, or a community.
        eq(contentPosts.visibility, "public"),
        parsed.data === "story" ? gt(contentPosts.expiresAt, now) : undefined
      )
    )
    .orderBy(desc(contentPosts.publishedAt))
    .limit(50);
  const publishers = await loadPublishers(
    rows
      .map((post) => publisherRefFromAuthor(post))
      .filter((ref): ref is NonNullable<typeof ref> => ref !== null)
  );
  const items = rows.flatMap((post) => {
    const ref = publisherRefFromAuthor(post);
    const publisher = ref ? publishers.get(publisherKey(ref)) : undefined;
    // Inactive users / non-active businesses are dropped, as in every feed.
    if (!ref || !publisher) return [];
    // Owner id and moderator notes are internal; never send them to the
    // unauthenticated feed.
    const {
      createdByMobileUserId: _owner,
      reviewNote: _reviewNote,
      reviewedAt: _reviewedAt,
      ...rest
    } = post;
    void _owner;
    void _reviewNote;
    void _reviewedAt;
    return [
      {
        ...rest,
        publisherProfileId: ref.id,
        publisherProfileType: ref.type,
        publisher,
        author: legacyAuthor(publisher),
      },
    ];
  });
  return c.json({ items });
});
