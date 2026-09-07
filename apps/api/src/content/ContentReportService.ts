import { and, eq } from 'drizzle-orm';
import type { CreateContentPostReportRequest } from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  contentPostReports,
  contentPosts,
  mobileUsers,
} from '../db/schema.js';
import type { AuthClaims } from '../lib/auth.js';

function appError(message: string, code: string, status: 400 | 403 | 404 | 409) {
  return Object.assign(new Error(message), { code, status });
}

async function requireMobileUser(auth: AuthClaims) {
  if (auth.kind !== 'mobile') {
    throw appError('A mobile session is required', 'forbidden', 403);
  }
  const [user] = await db
    .select({ id: mobileUsers.id })
    .from(mobileUsers)
    .where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true)))
    .limit(1);
  if (!user) {
    throw appError('Sign in to report a video', 'mobile_account_required', 403);
  }
  return user;
}

/** Moderation write path for profile-backed Clips (`content_posts`). */
export class ContentReportService {
  async create(
    auth: AuthClaims,
    contentPostId: string,
    body: CreateContentPostReportRequest,
  ) {
    const reporter = await requireMobileUser(auth);
    const [post] = await db
      .select({
        id: contentPosts.id,
        createdByMobileUserId: contentPosts.createdByMobileUserId,
        format: contentPosts.format,
        mediaType: contentPosts.mediaType,
        status: contentPosts.status,
      })
      .from(contentPosts)
      .where(eq(contentPosts.id, contentPostId))
      .limit(1);

    // A report is only meaningful for a live Clip. Treat unavailable content
    // as not found so clients cannot use this endpoint to probe private posts.
    if (
      !post ||
      post.status !== 'published' ||
      post.format !== 'clip' ||
      post.mediaType !== 'video'
    ) {
      throw appError('Video not found', 'not_found', 404);
    }
    if (post.createdByMobileUserId === reporter.id) {
      throw appError('You cannot report your own video', 'cannot_report_own_video', 400);
    }

    const [report] = await db
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
    if (!report) {
      throw appError(
        'You have already reported this video',
        'already_reported',
        409,
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
