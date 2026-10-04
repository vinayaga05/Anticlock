import { Hono } from 'hono';
import { and, count, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  contentPostReports,
  contentPosts,
  mobileUsers,
  providers,
  reelReports,
  reels,
  users,
} from '../db/schema.js';
import { writeAudit } from '../lib/audit.js';
import { requireAuth, requirePermission, type AppEnv } from '../middleware/auth.js';

type ReportStatus = 'open' | 'resolved' | 'dismissed';
type ContentType = 'reel' | 'content_post';

type ModerationListQuery = {
  status?: ReportStatus;
  contentType?: ContentType;
  reason?: string;
  limit?: string;
  cursor?: string;
};

type ModerationActionRequest = {
  action: 'dismiss' | 'remove_content' | 'warn_user' | 'suspend_user';
  note: string;
};

export const moderationAdminRoutes = new Hono<AppEnv>();

moderationAdminRoutes.use('*', requireAuth);
moderationAdminRoutes.use('*', requirePermission('moderation.act'));

/**
 * List all reports with pagination and filters.
 * Combines reel_reports and content_post_reports.
 */
moderationAdminRoutes.get('/reports', async c => {
  const query: ModerationListQuery = c.req.query();
  const limitParam = parseInt(query.limit ?? '20', 10);
  const limit = Math.min(Math.max(limitParam, 1), 100);
  const cursorParam = query.cursor;
  const statusFilter: ReportStatus = (query.status as ReportStatus) ?? 'open';
  const contentTypeFilter = query.contentType as ContentType | undefined;
  const reasonFilter = query.reason;

  let reelReportsQuery = db
    .select({
      id: reelReports.id,
      contentId: reelReports.reelId,
      contentType: sql<'reel'>`'reel'`,
      reporterKey: reelReports.reporterKey,
      reporterKind: reelReports.reporterKind,
      reason: reelReports.reason,
      details: reelReports.details,
      status: reelReports.status,
      resolutionAction: reelReports.resolutionAction,
      resolutionNote: reelReports.resolutionNote,
      resolvedBy: reelReports.resolvedBy,
      createdAt: reelReports.createdAt,
      resolvedAt: reelReports.resolvedAt,
      // Join reel details
      contentTitle: reels.title,
      contentCaption: reels.caption,
      contentCreatorName: reels.creatorName,
      contentStatus: reels.status,
      reporterMobileUserId: sql<string | null>`NULL`,
    })
    .from(reelReports)
    .innerJoin(reels, eq(reelReports.reelId, reels.id))
    .where(eq(reelReports.status, statusFilter))
    .orderBy(desc(reelReports.createdAt))
    .limit(limit + 1);

  if (reasonFilter) {
    reelReportsQuery = reelReportsQuery.where(eq(reelReports.reason, reasonFilter));
  }

  if (cursorParam) {
    reelReportsQuery = reelReportsQuery.where(sql`${reelReports.createdAt} < ${cursorParam}`);
  }

  let contentPostReportsQuery = db
    .select({
      id: contentPostReports.id,
      contentId: contentPostReports.contentPostId,
      contentType: sql<'content_post'>`'content_post'`,
      reporterKey: sql<string>`''`,
      reporterKind: sql<string>`'mobile_user'`,
      reason: contentPostReports.reason,
      details: contentPostReports.details,
      status: contentPostReports.status,
      resolutionAction: contentPostReports.resolutionAction,
      resolutionNote: contentPostReports.resolutionNote,
      resolvedBy: contentPostReports.resolvedBy,
      createdAt: contentPostReports.createdAt,
      resolvedAt: contentPostReports.resolvedAt,
      // Join content post details
      contentTitle: sql<string | null>`NULL`,
      contentCaption: contentPosts.caption,
      contentCreatorName: sql<string | null>`NULL`,
      contentStatus: contentPosts.status,
      reporterMobileUserId: contentPostReports.reporterMobileUserId,
    })
    .from(contentPostReports)
    .innerJoin(contentPosts, eq(contentPostReports.contentPostId, contentPosts.id))
    .where(eq(contentPostReports.status, statusFilter))
    .orderBy(desc(contentPostReports.createdAt))
    .limit(limit + 1);

  if (reasonFilter) {
    contentPostReportsQuery = contentPostReportsQuery.where(
      eq(contentPostReports.reason, reasonFilter)
    );
  }

  if (cursorParam) {
    contentPostReportsQuery = contentPostReportsQuery.where(
      sql`${contentPostReports.createdAt} < ${cursorParam}`
    );
  }

  // Fetch based on content type filter
  let allReports: any[] = [];
  if (!contentTypeFilter || contentTypeFilter === 'reel') {
    const reelReportsData = await reelReportsQuery;
    allReports = allReports.concat(reelReportsData);
  }
  if (!contentTypeFilter || contentTypeFilter === 'content_post') {
    const contentPostReportsData = await contentPostReportsQuery;
    allReports = allReports.concat(contentPostReportsData);
  }

  // Sort by createdAt and limit
  allReports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const hasMore = allReports.length > limit;
  const reports = allReports.slice(0, limit);

  // Enrich with reporter and resolver names
  const reporterUserIds = new Set<string>();
  const resolverUserIds = new Set<string>();

  for (const report of reports) {
    if (report.reporterMobileUserId) {
      reporterUserIds.add(report.reporterMobileUserId);
    }
    if (report.resolvedBy) {
      resolverUserIds.add(report.resolvedBy);
    }
  }

  const reporters = await db
    .select({ id: mobileUsers.id, displayName: mobileUsers.displayName })
    .from(mobileUsers)
    .where(
      sql`${mobileUsers.id} IN (${sql.join(Array.from(reporterUserIds).map(id => sql`${id}`), sql`, `)})`
    );

  const resolvers = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(
      sql`${users.id} IN (${sql.join(Array.from(resolverUserIds).map(id => sql`${id}`), sql`, `)})`
    );

  const reporterMap = new Map(reporters.map(r => [r.id, r.displayName]));
  const resolverMap = new Map(resolvers.map(r => [r.id, r.name]));

  // Get report count for each content
  const contentIds = reports.map(r => r.contentId);
  const reelIds = reports.filter(r => r.contentType === 'reel').map(r => r.contentId);
  const postIds = reports.filter(r => r.contentType === 'content_post').map(r => r.contentId);

  const reelReportCounts = reelIds.length
    ? await db
        .select({
          reelId: reelReports.reelId,
          count: count(),
        })
        .from(reelReports)
        .where(
          sql`${reelReports.reelId} IN (${sql.join(reelIds.map(id => sql`${id}`), sql`, `)})`
        )
        .groupBy(reelReports.reelId)
    : [];

  const postReportCounts = postIds.length
    ? await db
        .select({
          contentPostId: contentPostReports.contentPostId,
          count: count(),
        })
        .from(contentPostReports)
        .where(
          sql`${contentPostReports.contentPostId} IN (${sql.join(postIds.map(id => sql`${id}`), sql`, `)})`
        )
        .groupBy(contentPostReports.contentPostId)
    : [];

  const reportCountMap = new Map<string, number>();
  for (const r of reelReportCounts) {
    reportCountMap.set(r.reelId, r.count);
  }
  for (const r of postReportCounts) {
    reportCountMap.set(r.contentPostId, r.count);
  }

  const data = reports.map(r => ({
    id: r.id,
    contentId: r.contentId,
    contentType: r.contentType,
    contentTitle: r.contentTitle,
    contentCaption: r.contentCaption,
    contentCreatorName: r.contentCreatorName,
    contentStatus: r.contentStatus,
    reporterName:
      r.reporterKind === 'mobile_user' && r.reporterMobileUserId
        ? reporterMap.get(r.reporterMobileUserId) ?? 'Unknown'
        : r.reporterKey,
    reason: r.reason,
    details: r.details,
    status: r.status,
    resolutionAction: r.resolutionAction,
    resolutionNote: r.resolutionNote,
    resolvedByName: r.resolvedBy ? resolverMap.get(r.resolvedBy) ?? 'Unknown' : null,
    reportCount: reportCountMap.get(r.contentId) ?? 1,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  }));

  return c.json({
    data,
    meta: {
      nextCursor: hasMore
        ? reports[reports.length - 1]?.createdAt.toISOString()
        : null,
    },
  });
});

/**
 * Get detailed view of a single report
 */
moderationAdminRoutes.get('/reports/:contentType/:id', async c => {
  const contentType = c.req.param('contentType') as ContentType;
  const id = c.req.param('id');

  if (contentType === 'reel') {
    const [report] = await db
      .select({
        id: reelReports.id,
        contentId: reelReports.reelId,
        reporterKey: reelReports.reporterKey,
        reporterKind: reelReports.reporterKind,
        reason: reelReports.reason,
        details: reelReports.details,
        status: reelReports.status,
        resolutionAction: reelReports.resolutionAction,
        resolutionNote: reelReports.resolutionNote,
        resolvedBy: reelReports.resolvedBy,
        createdAt: reelReports.createdAt,
        resolvedAt: reelReports.resolvedAt,
        // Reel details
        contentTitle: reels.title,
        contentCaption: reels.caption,
        contentCreatorName: reels.creatorName,
        contentStatus: reels.status,
        contentMediaId: reels.mediaId,
      })
      .from(reelReports)
      .innerJoin(reels, eq(reelReports.reelId, reels.id))
      .where(eq(reelReports.id, id))
      .limit(1);

    if (!report) {
      return c.json({ error: { code: 'not_found', message: 'Report not found' } }, 404);
    }

    // Get all reports for this content
    const allReports = await db
      .select({
        id: reelReports.id,
        reporterKey: reelReports.reporterKey,
        reason: reelReports.reason,
        status: reelReports.status,
        createdAt: reelReports.createdAt,
      })
      .from(reelReports)
      .where(eq(reelReports.reelId, report.contentId))
      .orderBy(desc(reelReports.createdAt));

    return c.json({
      data: {
        ...report,
        createdAt: report.createdAt.toISOString(),
        resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
        allReports: allReports.map(r => ({
          id: r.id,
          reporterKey: r.reporterKey,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } else {
    const [report] = await db
      .select({
        id: contentPostReports.id,
        contentId: contentPostReports.contentPostId,
        reporterMobileUserId: contentPostReports.reporterMobileUserId,
        reason: contentPostReports.reason,
        details: contentPostReports.details,
        status: contentPostReports.status,
        resolutionAction: contentPostReports.resolutionAction,
        resolutionNote: contentPostReports.resolutionNote,
        resolvedBy: contentPostReports.resolvedBy,
        createdAt: contentPostReports.createdAt,
        resolvedAt: contentPostReports.resolvedAt,
        // Content post details
        contentCaption: contentPosts.caption,
        contentStatus: contentPosts.status,
        contentMediaIds: contentPosts.mediaIds,
        contentFormat: contentPosts.format,
        authorMobileUserId: contentPosts.authorMobileUserId,
        authorProviderId: contentPosts.authorProviderId,
      })
      .from(contentPostReports)
      .innerJoin(contentPosts, eq(contentPostReports.contentPostId, contentPosts.id))
      .where(eq(contentPostReports.id, id))
      .limit(1);

    if (!report) {
      return c.json({ error: { code: 'not_found', message: 'Report not found' } }, 404);
    }

    // Get reporter name
    const [reporter] = report.reporterMobileUserId
      ? await db
          .select({ displayName: mobileUsers.displayName })
          .from(mobileUsers)
          .where(eq(mobileUsers.id, report.reporterMobileUserId))
          .limit(1)
      : [];

    // Get author name
    let authorName = 'Unknown';
    if (report.authorMobileUserId) {
      const [author] = await db
        .select({ displayName: mobileUsers.displayName })
        .from(mobileUsers)
        .where(eq(mobileUsers.id, report.authorMobileUserId))
        .limit(1);
      authorName = author?.displayName ?? 'Unknown';
    } else if (report.authorProviderId) {
      const [author] = await db
        .select({ name: providers.name })
        .from(providers)
        .where(eq(providers.id, report.authorProviderId))
        .limit(1);
      authorName = author?.name ?? 'Unknown';
    }

    // Get all reports for this content
    const allReports = await db
      .select({
        id: contentPostReports.id,
        reporterMobileUserId: contentPostReports.reporterMobileUserId,
        reason: contentPostReports.reason,
        status: contentPostReports.status,
        createdAt: contentPostReports.createdAt,
      })
      .from(contentPostReports)
      .where(eq(contentPostReports.contentPostId, report.contentId))
      .orderBy(desc(contentPostReports.createdAt));

    return c.json({
      data: {
        ...report,
        reporterName: reporter?.displayName ?? 'Unknown',
        authorName,
        createdAt: report.createdAt.toISOString(),
        resolvedAt: report.resolvedAt ? report.resolvedAt.toISOString() : null,
        allReports: allReports.map(r => ({
          id: r.id,
          reporterMobileUserId: r.reporterMobileUserId,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  }
});

/**
 * Take moderation action on a report
 */
moderationAdminRoutes.post('/reports/:contentType/:id/action', async c => {
  const contentType = c.req.param('contentType') as ContentType;
  const reportId = c.req.param('id');
  const body = (await c.req.json()) as ModerationActionRequest;
  const auth = c.get('auth');

  if (!body.note || body.note.trim().length === 0) {
    return c.json(
      { error: { code: 'validation_error', message: 'Note is required' } },
      400
    );
  }

  const validActions = ['dismiss', 'remove_content', 'warn_user', 'suspend_user'];
  if (!validActions.includes(body.action)) {
    return c.json(
      { error: { code: 'validation_error', message: 'Invalid action' } },
      400
    );
  }

  await db.transaction(async tx => {
    if (contentType === 'reel') {
      const [report] = await tx
        .select({
          id: reelReports.id,
          reelId: reelReports.reelId,
          status: reelReports.status,
        })
        .from(reelReports)
        .where(eq(reelReports.id, reportId))
        .limit(1);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'open') {
        throw new Error('Report already resolved');
      }

      // Update report
      await tx
        .update(reelReports)
        .set({
          status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
          resolutionAction: body.action,
          resolutionNote: body.note,
          resolvedBy: auth.sub,
          resolvedAt: new Date(),
        })
        .where(eq(reelReports.id, reportId));

      // Apply action to content
      if (body.action === 'remove_content') {
        await tx
          .update(reels)
          .set({
            moderationStatus: 'removed',
            status: 'archived',
            updatedAt: new Date(),
          })
          .where(eq(reels.id, report.reelId));
      }

      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email,
        action: 'moderation.action_taken',
        entityType: 'reel_report',
        entityId: reportId,
        metadata: { action: body.action, contentId: report.reelId },
      });
    } else {
      const [report] = await tx
        .select({
          id: contentPostReports.id,
          contentPostId: contentPostReports.contentPostId,
          status: contentPostReports.status,
        })
        .from(contentPostReports)
        .where(eq(contentPostReports.id, reportId))
        .limit(1);

      if (!report) {
        throw new Error('Report not found');
      }

      if (report.status !== 'open') {
        throw new Error('Report already resolved');
      }

      // Update report
      await tx
        .update(contentPostReports)
        .set({
          status: body.action === 'dismiss' ? 'dismissed' : 'resolved',
          resolutionAction: body.action,
          resolutionNote: body.note,
          resolvedBy: auth.sub,
          resolvedAt: new Date(),
        })
        .where(eq(contentPostReports.id, reportId));

      // Apply action to content
      if (body.action === 'remove_content') {
        await tx
          .update(contentPosts)
          .set({
            status: 'removed',
          })
          .where(eq(contentPosts.id, report.contentPostId));
      }

      await writeAudit({
        actorId: auth.sub,
        actorEmail: auth.email,
        action: 'moderation.action_taken',
        entityType: 'content_post_report',
        entityId: reportId,
        metadata: { action: body.action, contentId: report.contentPostId },
      });
    }
  });

  return c.json({ ok: true });
});
