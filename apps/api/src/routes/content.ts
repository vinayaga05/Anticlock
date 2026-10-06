import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { Hono } from "hono";
import {
  ContentFormatSchema,
  CompleteUploadRequestSchema,
  CreateContentContainerRequestSchema,
  CreateContentUploadRequestSchema,
  RecordContentClipViewRequestSchema,
  SetContentClipLikeRequestSchema,
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
} from "../publishing/PublishingContextService.js";
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
  const ageHours = sql`
    GREATEST(
      0,
      EXTRACT(EPOCH FROM (${now} - ${contentPosts.publishedAt})) / 3600.0
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
    : and(
        eq(mobileUserBlocks.blockerMobileUserId, mobileUserId),
        eq(mobileUserBlocks.blockedMobileUserId, author.id)
      );
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
    const actor = await resolvePublishingContext(auth, requestContext(c));
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
        authorMobileUserId: actor.type === "user" ? actor.id : null,
        authorProviderId: actor.type === "provider" ? actor.id : null,
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
    const actor = await resolvePublishingContext(auth, requestContext(c));
    const [container] = await db
      .select()
      .from(contentContainers)
      .where(
        and(
          eq(contentContainers.id, c.req.param("id")),
          eq(contentContainers.createdByMobileUserId, mobileUserId)
        )
      )
      .limit(1);
    if (!container)
      throw Object.assign(new Error("Content container not found"), {
        code: "not_found",
        status: 404,
      });
    if (container.status !== "ready_to_publish")
      throw Object.assign(new Error("Content is not ready to publish"), {
        code: "invalid_status",
        status: 400,
      });
    if (
      actor.type === "user"
        ? container.authorMobileUserId !== actor.id
        : container.authorProviderId !== actor.id
    ) {
      throw Object.assign(
        new Error("Publishing identity does not match this container"),
        { code: "forbidden", status: 403 }
      );
    }
    // Recheck asset ownership/readiness at publish time; an archived or
    // moderated asset must not be smuggled through an old draft.
    const { assets } = await mediaService.requireMobileContentAssets(
      mobileUserId,
      container.mediaIds,
      container.thumbnailMediaId,
      container.visibility
    );
    if (
      container.format === "clip" &&
      (assets.length !== 1 || assets[0]?.kind !== "video")
    ) {
      throw Object.assign(new Error("A Clip needs exactly one ready video"), {
        code: "invalid_clip_media",
        status: 400,
      });
    }
    const now = new Date();
    const expiresAt =
      container.format === "story"
        ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
        : null;
    const firstVideo = assets.find((asset) => asset.kind === "video");
    const duplicateClusterId =
      firstVideo?.checksumSha256 ?? firstVideo?.id ?? container.id;
    // Claim the draft state and create its post in one transaction. Two taps
    // (or two devices) must not turn one prepared upload into duplicate posts.
    const post = await db.transaction(async (tx) => {
      const [publishedContainer] = await tx
        .update(contentContainers)
        .set({ status: "published", publishedAt: now })
        .where(
          and(
            eq(contentContainers.id, container.id),
            eq(contentContainers.createdByMobileUserId, mobileUserId),
            eq(contentContainers.status, "ready_to_publish")
          )
        )
        .returning({ id: contentContainers.id });
      if (!publishedContainer) {
        throw Object.assign(new Error("Content is not ready to publish"), {
          code: "invalid_status",
          status: 400,
        });
      }

      const [createdPost] = await tx
        .insert(contentPosts)
        .values({
          containerId: container.id,
          createdByMobileUserId: mobileUserId,
          authorMobileUserId: container.authorMobileUserId,
          authorProviderId: container.authorProviderId,
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
          status: "published",
          expiresAt,
          publishedAt: now,
        })
        .returning();
      return createdPost!;
    });
    return c.json(
      {
        post: {
          id: post.id,
          format: post.format,
          expiresAt: post.expiresAt?.toISOString() ?? null,
        },
      },
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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DELIVERY_CLAIM_TTL_MS);
    const selected = await db.transaction(async (tx) => {
      // The advisory lock serializes a user's refreshes across API instances.
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${mobileUserId}))`
      );

      // Re-read blocks under the same transaction immediately before writes.
      // A blocked user or business is filtered before it can consume a claim.
      const blockRows = await tx
        .select({
          blockedMobileUserId: mobileUserBlocks.blockedMobileUserId,
          blockedProviderId: mobileUserBlocks.blockedProviderId,
        })
        .from(mobileUserBlocks)
        .where(eq(mobileUserBlocks.blockerMobileUserId, mobileUserId));
      const blockedMobileUserIds = new Set(
        blockRows
          .map((row) => row.blockedMobileUserId)
          .filter((id): id is string => Boolean(id))
      );
      const blockedProviderIds = new Set(
        blockRows
          .map((row) => row.blockedProviderId)
          .filter((id): id is string => Boolean(id))
      );

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
          .where(
            and(
              eq(contentPosts.format, "clip"),
              eq(contentPosts.mediaType, "video"),
              eq(contentPosts.status, "published"),
              eq(contentPosts.visibility, "public"),
              or(
                isNull(contentPosts.expiresAt),
                gt(contentPosts.expiresAt, now)
              )
            )
          )
          .orderBy(
            desc(scoreOrder),
            desc(contentPosts.publishedAt),
            asc(contentPosts.id)
          )
          .limit(CLIP_FEED_CANDIDATE_BATCH_SIZE)
          .offset(offset);
        if (batch.length === 0) break;
        offset += batch.length;

        for (const post of batch) {
          const authorIsBlocked = post.authorProviderId
            ? blockedProviderIds.has(post.authorProviderId)
            : post.authorMobileUserId
            ? blockedMobileUserIds.has(post.authorMobileUserId)
            : true;
          if (
            authorIsBlocked ||
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
      return claimed;
    });

    const likedRows = selected.length
      ? await db
          .select({ contentPostId: contentPostLikes.contentPostId })
          .from(contentPostLikes)
          .where(
            and(
              eq(contentPostLikes.mobileUserId, mobileUserId),
              inArray(
                contentPostLikes.contentPostId,
                selected.map((candidate) => candidate.post.id)
              )
            )
          )
      : [];
    const likedPostIds = new Set(likedRows.map((row) => row.contentPostId));

    return c.json({
      items: selected.map((candidate) => {
        const post = candidate.post;
        return {
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
          author: candidate.author,
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
          music: musicAttributionFromEdit(post.edit),
        };
      }),
      nextCursor: null,
    });
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
contentMobileRoutes.put("/posts/:id/like", async (c) => {
  try {
    const mobileUserId = await requireActiveMobile(c.get("auth"));
    const body = SetContentClipLikeRequestSchema.parse(await c.req.json());
    const now = new Date();
    const { post, author } = await requireEligiblePublicClipForEngagement(
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
          .where(publishedPublicClipCondition(post.id, now))
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
        .where(publishedPublicClipCondition(post.id, now))
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
  const items = await Promise.all(
    rows.map(async (post) => {
      if (post.authorProviderId) {
        const [provider] = await db
          .select()
          .from(providers)
          .where(eq(providers.id, post.authorProviderId))
          .limit(1);
        return {
          ...post,
          author: {
            type: "provider",
            id: post.authorProviderId,
            name: provider?.name ?? "Business",
            avatarUrl: null,
          },
        };
      }
      const [user] = await db
        .select()
        .from(mobileUsers)
        .where(eq(mobileUsers.id, post.authorMobileUserId!))
        .limit(1);
      return {
        ...post,
        author: {
          type: "user",
          id: post.authorMobileUserId,
          name: user?.displayName ?? "User",
          avatarUrl: user?.avatarUrl ?? null,
        },
      };
    })
  );
  return c.json({ items });
});
