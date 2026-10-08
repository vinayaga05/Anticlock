import { and, eq, gt, isNull, or } from "drizzle-orm";
import type { CreateContentPostReportRequest } from "@anticlock/contracts";
import { db } from "../db/client.js";
import {
  contentPostReports,
  contentPosts,
  mobileUserBlocks,
  mobileUsers,
  providers,
} from "../db/schema.js";
import type { AuthClaims } from "../lib/auth.js";
import { mediaService } from "../media/MediaService.js";
import { requireVisiblePost } from "./ContentPublishingService.js";

function appError(
  message: string,
  code: string,
  status: 400 | 403 | 404 | 409
) {
  return Object.assign(new Error(message), { code, status });
}

async function requireMobileUser(auth: AuthClaims) {
  if (auth.kind !== "mobile") {
    throw appError("A mobile session is required", "forbidden", 403);
  }
  const [user] = await db
    .select({ id: mobileUsers.id })
    .from(mobileUsers)
    .where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true)))
    .limit(1);
  if (!user) {
    throw appError("Sign in to report a video", "mobile_account_required", 403);
  }
  return user;
}

function videoNotFound() {
  return appError("Video not found", "not_found", 404);
}

/**
 * Reporting follows the same visibility boundary as the current Clip feed:
 * public, live, active-author videos only. When follower/friend Clip feeds
 * are introduced, this should be replaced with their shared access-policy
 * check rather than widening this route on its own.
 */
async function requireReportablePublicClip(
  reporterMobileUserId: string,
  contentPostId: string
) {
  const now = new Date();
  const [post] = await db
    .select({
      id: contentPosts.id,
      createdByMobileUserId: contentPosts.createdByMobileUserId,
      authorMobileUserId: contentPosts.authorMobileUserId,
      authorProviderId: contentPosts.authorProviderId,
      mediaIds: contentPosts.mediaIds,
    })
    .from(contentPosts)
    .where(
      and(
        eq(contentPosts.id, contentPostId),
        eq(contentPosts.status, "published"),
        eq(contentPosts.format, "clip"),
        eq(contentPosts.mediaType, "video"),
        eq(contentPosts.visibility, "public"),
        or(isNull(contentPosts.expiresAt), gt(contentPosts.expiresAt, now))
      )
    )
    .limit(1);
  if (!post || !post.mediaIds[0]) throw videoNotFound();

  const author = post.authorProviderId
    ? { type: "provider" as const, id: post.authorProviderId }
    : post.authorMobileUserId
    ? { type: "user" as const, id: post.authorMobileUserId }
    : null;
  if (!author) throw videoNotFound();

  const [activeAuthor, block, isDeliverable] = await Promise.all([
    author.type === "provider"
      ? db
          .select({ id: providers.id })
          .from(providers)
          .where(
            and(eq(providers.id, author.id), eq(providers.status, "active"))
          )
          .limit(1)
      : db
          .select({ id: mobileUsers.id })
          .from(mobileUsers)
          .where(
            and(eq(mobileUsers.id, author.id), eq(mobileUsers.isActive, true))
          )
          .limit(1),
    db
      .select({ id: mobileUserBlocks.id })
      .from(mobileUserBlocks)
      .where(
        author.type === "provider"
          ? and(
              eq(mobileUserBlocks.blockerMobileUserId, reporterMobileUserId),
              eq(mobileUserBlocks.blockedProviderId, author.id)
            )
          : and(
              eq(mobileUserBlocks.blockerMobileUserId, reporterMobileUserId),
              eq(mobileUserBlocks.blockedMobileUserId, author.id)
            )
      )
      .limit(1),
    mediaService.isPublicContentDeliverable(post.mediaIds[0], "video"),
  ]);
  if (!activeAuthor[0] || block[0] || !isDeliverable) throw videoNotFound();

  return { post, author };
}

/**
 * Public Clips keep the feed-equivalent gate above. Flash posts, Stories and
 * non-public content use the shared audience check, so reports work for
 * content from personal and business publishers wherever a viewer can see it.
 */
async function requireReportablePost(
  reporterMobileUserId: string,
  contentPostId: string
) {
  const [row] = await db
    .select({ format: contentPosts.format, visibility: contentPosts.visibility })
    .from(contentPosts)
    .where(eq(contentPosts.id, contentPostId))
    .limit(1);
  if (!row) throw videoNotFound();
  if (row.format === "clip" && row.visibility === "public") {
    return requireReportablePublicClip(reporterMobileUserId, contentPostId);
  }
  const { post, ref } = await requireVisiblePost(
    reporterMobileUserId,
    contentPostId
  );
  return {
    post,
    author: {
      type: ref.type === "business" ? ("provider" as const) : ("user" as const),
      id: ref.id,
    },
  };
}

/** Moderation write path for profile-backed content (`content_posts`). */
export class ContentReportService {
  async create(
    auth: AuthClaims,
    contentPostId: string,
    body: CreateContentPostReportRequest
  ) {
    const reporter = await requireMobileUser(auth);
    const { post, author } = await requireReportablePost(
      reporter.id,
      contentPostId
    );
    if (post.createdByMobileUserId === reporter.id) {
      throw appError(
        "You cannot report your own video",
        "cannot_report_own_video",
        400
      );
    }

    const report = await db.transaction(async (tx) => {
      // A block may have been created while the author/media checks above
      // were resolving. Recheck it immediately before the moderation write so
      // a blocked profile can never be used as a report-target probe.
      const [block] = await tx
        .select({ id: mobileUserBlocks.id })
        .from(mobileUserBlocks)
        .where(
          author.type === "provider"
            ? and(
                eq(mobileUserBlocks.blockerMobileUserId, reporter.id),
                eq(mobileUserBlocks.blockedProviderId, author.id)
              )
            : and(
                eq(mobileUserBlocks.blockerMobileUserId, reporter.id),
                eq(mobileUserBlocks.blockedMobileUserId, author.id)
              )
        )
        .limit(1);
      if (block) throw videoNotFound();

      const [created] = await tx
        .insert(contentPostReports)
        .values({
          contentPostId: post.id,
          reporterMobileUserId: reporter.id,
          reason: body.reason,
          details: body.details ?? null,
        })
        .onConflictDoNothing({
          target: [
            contentPostReports.contentPostId,
            contentPostReports.reporterMobileUserId,
          ],
        })
        .returning();
      return created ?? null;
    });
    if (!report) {
      throw appError(
        "You have already reported this video",
        "already_reported",
        409
      );
    }

    return {
      id: report.id,
      contentPostId: report.contentPostId,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    };
  }
}

export const contentReportService = new ContentReportService();
