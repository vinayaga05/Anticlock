import {
  and,
  asc,
  desc,
  eq,
  sql,
} from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  reelComments,
  reelLikes,
  reelReports,
  reelViewEvents,
  reels,
} from '../db/schema.js';

type Actor = {
  key: string;
  kind: 'mobile_user' | 'device';
};

export type ReportFilters = {
  status?: string;
  reelId?: string;
  limit: number;
};

/**
 * Server-owned engagement storage. Client requests can describe a playback
 * session or current like state, but they never provide aggregate counters.
 */
export class ReelEngagementRepository {
  async recordView(input: {
    reelId: string;
    actor: Actor;
    eventId: string;
    watchedMs: number;
    completed: boolean;
    sessionId?: string;
  }) {
    const [inserted] = await db
      .insert(reelViewEvents)
      .values({
        eventId: input.eventId,
        reelId: input.reelId,
        viewerKey: input.actor.key,
        viewerKind: input.actor.kind,
        sessionId: input.sessionId ?? null,
        watchedMs: input.watchedMs,
        completed: input.completed,
      })
      // There are two idempotency scopes: eventId for session-less clients,
      // and the partial DB index on (reel, viewer, session) for players that
      // emit an initial view followed by a completion event.
      .onConflictDoNothing()
      .returning({ id: reelViewEvents.id });

    if (inserted) {
      await db
        .update(reels)
        .set({
          viewCount: sql`${reels.viewCount} + 1`,
          completionCount: input.completed
            ? sql`${reels.completionCount} + 1`
            : reels.completionCount,
          updatedAt: new Date(),
        })
        .where(eq(reels.id, input.reelId));
      return { viewRecorded: true, completionRecorded: input.completed };
    }

    // A duplicate event without a session is already represented by eventId.
    if (!input.sessionId) {
      return { viewRecorded: false, completionRecorded: false };
    }

    const [existing] = await db
      .select()
      .from(reelViewEvents)
      .where(
        and(
          eq(reelViewEvents.reelId, input.reelId),
          eq(reelViewEvents.viewerKey, input.actor.key),
          eq(reelViewEvents.sessionId, input.sessionId),
        ),
      )
      .limit(1);
    if (!existing) {
      // A conflicting, invalid globally reused event ID should not alter a
      // different session's statistics.
      return { viewRecorded: false, completionRecorded: false };
    }

    if (input.completed && !existing.completed) {
      const [completed] = await db
        .update(reelViewEvents)
        .set({
          watchedMs: sql`GREATEST(${reelViewEvents.watchedMs}, ${input.watchedMs})`,
          completed: true,
        })
        .where(
          and(
            eq(reelViewEvents.id, existing.id),
            eq(reelViewEvents.completed, false),
          ),
        )
        .returning({ id: reelViewEvents.id });
      if (completed) {
        await db
          .update(reels)
          .set({
            completionCount: sql`${reels.completionCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(reels.id, input.reelId));
        return { viewRecorded: false, completionRecorded: true };
      }
      return { viewRecorded: false, completionRecorded: false };
    }

    await db
      .update(reelViewEvents)
      .set({
        watchedMs: sql`GREATEST(${reelViewEvents.watchedMs}, ${input.watchedMs})`,
      })
      .where(eq(reelViewEvents.id, existing.id));
    return { viewRecorded: false, completionRecorded: false };
  }

  async setLike(input: { reelId: string; actor: Actor; liked: boolean }) {
    if (input.liked) {
      const [inserted] = await db
        .insert(reelLikes)
        .values({
          reelId: input.reelId,
          actorKey: input.actor.key,
          actorKind: input.actor.kind,
        })
        .onConflictDoNothing({
          target: [reelLikes.reelId, reelLikes.actorKey],
        })
        .returning({ reelId: reelLikes.reelId });
      if (!inserted) return false;
      await db
        .update(reels)
        .set({
          likeCount: sql`${reels.likeCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(reels.id, input.reelId));
      return true;
    }

    const [deleted] = await db
      .delete(reelLikes)
      .where(
        and(
          eq(reelLikes.reelId, input.reelId),
          eq(reelLikes.actorKey, input.actor.key),
        ),
      )
      .returning({ reelId: reelLikes.reelId });
    if (!deleted) return false;
    await db
      .update(reels)
      .set({
        likeCount: sql`GREATEST(${reels.likeCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(reels.id, input.reelId));
    return true;
  }

  async createComment(input: { reelId: string; actor: Actor; body: string }) {
    const [comment] = await db
      .insert(reelComments)
      .values({
        reelId: input.reelId,
        actorKey: input.actor.key,
        actorKind: input.actor.kind,
        body: input.body,
      })
      .returning();
    await db
      .update(reels)
      .set({
        commentCount: sql`${reels.commentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(reels.id, input.reelId));
    return comment!;
  }

  async createReport(input: {
    reelId: string;
    actor: Actor;
    reason: string;
    details?: string;
  }) {
    const [report] = await db
      .insert(reelReports)
      .values({
        reelId: input.reelId,
        reporterKey: input.actor.key,
        reporterKind: input.actor.kind,
        reason: input.reason,
        details: input.details ?? null,
      })
      .onConflictDoNothing({
        target: [reelReports.reelId, reelReports.reporterKey],
      })
      .returning();
    if (!report) return null;
    await db
      .update(reels)
      .set({
        reportCount: sql`${reels.reportCount} + 1`,
        moderationStatus: 'under_review',
        updatedAt: new Date(),
      })
      .where(eq(reels.id, input.reelId));
    return report;
  }

  async listReports(filters: ReportFilters) {
    const conditions = [];
    if (filters.status) conditions.push(eq(reelReports.status, filters.status));
    if (filters.reelId) conditions.push(eq(reelReports.reelId, filters.reelId));
    return db
      .select({
        report: reelReports,
        reelTitle: reels.title,
      })
      .from(reelReports)
      .innerJoin(reels, eq(reelReports.reelId, reels.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(reelReports.status), desc(reelReports.createdAt))
      .limit(filters.limit);
  }

  async getReport(id: string) {
    const [row] = await db
      .select({ report: reelReports, reel: reels })
      .from(reelReports)
      .innerJoin(reels, eq(reelReports.reelId, reels.id))
      .where(eq(reelReports.id, id))
      .limit(1);
    return row ?? null;
  }

  async resolveReport(
    id: string,
    values: Pick<
      typeof reelReports.$inferInsert,
      'status' | 'resolutionAction' | 'resolutionNote' | 'resolvedBy' | 'resolvedAt'
    >,
  ) {
    const [row] = await db
      .update(reelReports)
      .set(values)
      .where(eq(reelReports.id, id))
      .returning();
    return row ?? null;
  }

  async countOpenReports(reelId: string) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reelReports)
      .where(and(eq(reelReports.reelId, reelId), eq(reelReports.status, 'open')));
    return Number(row?.count ?? 0);
  }

  async analyticsSummary(reelId: string) {
    const [views] = await db
      .select({
        views: sql<number>`count(*)::int`,
        uniqueViewers: sql<number>`count(distinct ${reelViewEvents.viewerKey})::int`,
        completedViews: sql<number>`count(*) filter (where ${reelViewEvents.completed})::int`,
      })
      .from(reelViewEvents)
      .where(eq(reelViewEvents.reelId, reelId));
    const [likes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reelLikes)
      .where(eq(reelLikes.reelId, reelId));
    const [comments] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reelComments)
      .where(
        and(
          eq(reelComments.reelId, reelId),
          eq(reelComments.status, 'visible'),
        ),
      );
    const [reports] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(reelReports)
      .where(eq(reelReports.reelId, reelId));

    const [viewDays, likeDays, commentDays] = await Promise.all([
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${reelViewEvents.createdAt}), 'YYYY-MM-DD')`,
          views: sql<number>`count(*)::int`,
          completedViews: sql<number>`count(*) filter (where ${reelViewEvents.completed})::int`,
        })
        .from(reelViewEvents)
        .where(eq(reelViewEvents.reelId, reelId))
        .groupBy(sql`date_trunc('day', ${reelViewEvents.createdAt})`)
        .orderBy(asc(sql`date_trunc('day', ${reelViewEvents.createdAt})`)),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${reelLikes.createdAt}), 'YYYY-MM-DD')`,
          likes: sql<number>`count(*)::int`,
        })
        .from(reelLikes)
        .where(eq(reelLikes.reelId, reelId))
        .groupBy(sql`date_trunc('day', ${reelLikes.createdAt})`)
        .orderBy(asc(sql`date_trunc('day', ${reelLikes.createdAt})`)),
      db
        .select({
          date: sql<string>`to_char(date_trunc('day', ${reelComments.createdAt}), 'YYYY-MM-DD')`,
          comments: sql<number>`count(*)::int`,
        })
        .from(reelComments)
        .where(
          and(
            eq(reelComments.reelId, reelId),
            eq(reelComments.status, 'visible'),
          ),
        )
        .groupBy(sql`date_trunc('day', ${reelComments.createdAt})`)
        .orderBy(asc(sql`date_trunc('day', ${reelComments.createdAt})`)),
    ]);

    const daily = new Map<
      string,
      { date: string; views: number; completedViews: number; likes: number; comments: number }
    >();
    for (const row of viewDays) {
      daily.set(row.date, {
        date: row.date,
        views: Number(row.views),
        completedViews: Number(row.completedViews),
        likes: 0,
        comments: 0,
      });
    }
    for (const row of likeDays) {
      const current = daily.get(row.date) ?? {
        date: row.date,
        views: 0,
        completedViews: 0,
        likes: 0,
        comments: 0,
      };
      current.likes = Number(row.likes);
      daily.set(row.date, current);
    }
    for (const row of commentDays) {
      const current = daily.get(row.date) ?? {
        date: row.date,
        views: 0,
        completedViews: 0,
        likes: 0,
        comments: 0,
      };
      current.comments = Number(row.comments);
      daily.set(row.date, current);
    }

    const totalViews = Number(views?.views ?? 0);
    const completedViews = Number(views?.completedViews ?? 0);
    return {
      views: totalViews,
      uniqueViewers: Number(views?.uniqueViewers ?? 0),
      completedViews,
      completionRate: totalViews ? completedViews / totalViews : 0,
      likes: Number(likes?.count ?? 0),
      comments: Number(comments?.count ?? 0),
      reports: Number(reports?.count ?? 0),
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  async listRecentlyViewed(viewerKey: string, limit = 10) {
    const rows = await db
      .select({
        reelId: reelViewEvents.reelId,
        title: reels.title,
        caption: reels.caption,
        creatorName: reels.creatorName,
        viewedAt: reelViewEvents.createdAt,
      })
      .from(reelViewEvents)
      .innerJoin(reels, eq(reels.id, reelViewEvents.reelId))
      .where(eq(reelViewEvents.viewerKey, viewerKey))
      .orderBy(desc(reelViewEvents.createdAt))
      .limit(limit);

    const seen = new Set<string>();
    return rows.filter(row => {
      if (seen.has(row.reelId)) return false;
      seen.add(row.reelId);
      return true;
    });
  }
}

export const reelEngagementRepository = new ReelEngagementRepository();
