import { and, desc, eq, sql } from 'drizzle-orm';
import type {
  CommunityPost,
  CommunityPostComment,
  CommunityPostReport,
  CreateCommunityPostRequest,
  CreateCommentRequest,
  ReportPostRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  communityPosts,
  communityPostLikes,
  communityPostComments,
  communityPostReports,
  communities,
  mobileUsers,
  mediaAssets,
} from '../db/schema.js';

export class CommunityPostService {
  async createPost(
    communityId: string,
    authorId: string,
    request: CreateCommunityPostRequest,
  ): Promise<CommunityPost> {
    const [row] = await db
      .insert(communityPosts)
      .values({
        communityId,
        authorId,
        content: request.content,
        mediaAssetId: request.mediaAssetId ?? null,
        likeCount: 0,
        commentCount: 0,
        status: 'visible',
      })
      .returning();

    await db
      .update(communities)
      .set({
        postCount: sql`${communities.postCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId));

    return this.getPostById(row!.id, authorId);
  }

  async getPost(postId: string, viewerId?: string): Promise<CommunityPost | null> {
    try {
      return await this.getPostById(postId, viewerId);
    } catch {
      return null;
    }
  }

  private async getPostById(postId: string, viewerId?: string): Promise<CommunityPost> {
    const [row] = await db
      .select({
        post: communityPosts,
        author: {
          displayName: mobileUsers.displayName,
          avatarUrl: mobileUsers.avatarUrl,
        },
        media: {
          url: mediaAssets.url,
        },
      })
      .from(communityPosts)
      .innerJoin(mobileUsers, eq(communityPosts.authorId, mobileUsers.id))
      .leftJoin(mediaAssets, eq(communityPosts.mediaAssetId, mediaAssets.id))
      .where(eq(communityPosts.id, postId));

    if (!row) {
      throw Object.assign(new Error('Post not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    let isLiked = false;
    if (viewerId) {
      const [like] = await db
        .select()
        .from(communityPostLikes)
        .where(
          and(
            eq(communityPostLikes.postId, postId),
            eq(communityPostLikes.mobileUserId, viewerId),
          ),
        );
      isLiked = !!like;
    }

    return {
      id: row.post.id,
      communityId: row.post.communityId,
      authorId: row.post.authorId,
      authorName: row.author.displayName,
      authorAvatarUrl: row.author.avatarUrl ?? undefined,
      content: row.post.content,
      mediaUrl: row.media?.url ?? undefined,
      likeCount: row.post.likeCount,
      commentCount: row.post.commentCount,
      isLiked,
      status: row.post.status as 'visible' | 'removed',
      createdAt: row.post.createdAt.toISOString(),
      updatedAt: row.post.updatedAt.toISOString(),
      removedAt: row.post.removedAt?.toISOString() ?? null,
    };
  }

  async listPosts(
    communityId: string,
    options: {
      limit?: number;
      cursor?: string;
    } = {},
    viewerId?: string,
  ): Promise<{ posts: CommunityPost[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const rows = await db
      .select({
        post: communityPosts,
        author: {
          displayName: mobileUsers.displayName,
          avatarUrl: mobileUsers.avatarUrl,
        },
        media: {
          url: mediaAssets.url,
        },
      })
      .from(communityPosts)
      .innerJoin(mobileUsers, eq(communityPosts.authorId, mobileUsers.id))
      .leftJoin(mediaAssets, eq(communityPosts.mediaAssetId, mediaAssets.id))
      .where(
        and(
          eq(communityPosts.communityId, communityId),
          eq(communityPosts.status, 'visible'),
        ),
      )
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    let likedPostIds: Set<string> = new Set();
    if (viewerId) {
      const postIds = items.map((row) => row.post.id);
      const likes = await db
        .select({ postId: communityPostLikes.postId })
        .from(communityPostLikes)
        .where(
          and(
            sql`${communityPostLikes.postId} = ANY(${postIds})`,
            eq(communityPostLikes.mobileUserId, viewerId),
          ),
        );
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    const posts: CommunityPost[] = items.map((row) => ({
      id: row.post.id,
      communityId: row.post.communityId,
      authorId: row.post.authorId,
      authorName: row.author.displayName,
      authorAvatarUrl: row.author.avatarUrl ?? undefined,
      content: row.post.content,
      mediaUrl: row.media?.url ?? undefined,
      likeCount: row.post.likeCount,
      commentCount: row.post.commentCount,
      isLiked: likedPostIds.has(row.post.id),
      status: row.post.status as 'visible' | 'removed',
      createdAt: row.post.createdAt.toISOString(),
      updatedAt: row.post.updatedAt.toISOString(),
      removedAt: row.post.removedAt?.toISOString() ?? null,
    }));

    return {
      posts,
      nextCursor: hasMore
        ? items[items.length - 1]!.post.createdAt.toISOString()
        : null,
    };
  }

  async likePost(postId: string, userId: string): Promise<void> {
    try {
      await db.insert(communityPostLikes).values({
        postId,
        mobileUserId: userId,
      });

      await db
        .update(communityPosts)
        .set({
          likeCount: sql`${communityPosts.likeCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(communityPosts.id, postId));
    } catch {
      // Already liked (unique constraint violation)
    }
  }

  async unlikePost(postId: string, userId: string): Promise<void> {
    const result = await db
      .delete(communityPostLikes)
      .where(
        and(
          eq(communityPostLikes.postId, postId),
          eq(communityPostLikes.mobileUserId, userId),
        ),
      );

    await db
      .update(communityPosts)
      .set({
        likeCount: sql`GREATEST(${communityPosts.likeCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));
  }

  async createComment(
    postId: string,
    authorId: string,
    request: CreateCommentRequest,
  ): Promise<CommunityPostComment> {
    const [row] = await db
      .insert(communityPostComments)
      .values({
        postId,
        authorId,
        content: request.content,
      })
      .returning();

    await db
      .update(communityPosts)
      .set({
        commentCount: sql`${communityPosts.commentCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId));

    const [author] = await db
      .select({
        displayName: mobileUsers.displayName,
        avatarUrl: mobileUsers.avatarUrl,
      })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, authorId));

    return {
      id: row!.id,
      postId: row!.postId,
      authorId: row!.authorId,
      authorName: author?.displayName ?? 'Unknown',
      authorAvatarUrl: author?.avatarUrl ?? undefined,
      content: row!.content,
      createdAt: row!.createdAt.toISOString(),
    };
  }

  async listComments(postId: string): Promise<{ comments: CommunityPostComment[] }> {
    const rows = await db
      .select({
        comment: communityPostComments,
        author: {
          displayName: mobileUsers.displayName,
          avatarUrl: mobileUsers.avatarUrl,
        },
      })
      .from(communityPostComments)
      .innerJoin(mobileUsers, eq(communityPostComments.authorId, mobileUsers.id))
      .where(eq(communityPostComments.postId, postId))
      .orderBy(communityPostComments.createdAt);

    const comments: CommunityPostComment[] = rows.map((row) => ({
      id: row.comment.id,
      postId: row.comment.postId,
      authorId: row.comment.authorId,
      authorName: row.author.displayName,
      authorAvatarUrl: row.author.avatarUrl ?? undefined,
      content: row.comment.content,
      createdAt: row.comment.createdAt.toISOString(),
    }));

    return { comments };
  }

  async reportPost(
    postId: string,
    reporterId: string,
    request: ReportPostRequest,
  ): Promise<void> {
    try {
      await db.insert(communityPostReports).values({
        postId,
        reporterMobileUserId: reporterId,
        reason: request.reason,
        details: request.details ?? null,
        status: 'open',
      });
    } catch {
      // Already reported (unique constraint violation)
      throw Object.assign(new Error('Already reported'), {
        code: 'already_reported',
        status: 409,
      });
    }
  }

  async removePost(postId: string): Promise<CommunityPost> {
    const [row] = await db
      .update(communityPosts)
      .set({
        status: 'removed',
        removedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(communityPosts.id, postId))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Post not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    return this.getPostById(postId);
  }

  async listReports(options: {
    status?: 'open' | 'resolved';
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ reports: CommunityPostReport[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);
    const conditions = [];

    if (options.status) {
      conditions.push(eq(communityPostReports.status, options.status));
    }

    const rows = await db
      .select({
        report: communityPostReports,
        reporter: {
          displayName: mobileUsers.displayName,
        },
        post: {
          content: communityPosts.content,
          communityId: communityPosts.communityId,
        },
        community: {
          name: communities.name,
        },
      })
      .from(communityPostReports)
      .innerJoin(mobileUsers, eq(communityPostReports.reporterMobileUserId, mobileUsers.id))
      .innerJoin(communityPosts, eq(communityPostReports.postId, communityPosts.id))
      .innerJoin(communities, eq(communityPosts.communityId, communities.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(communityPostReports.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const reports: CommunityPostReport[] = items.map((row) => ({
      id: row.report.id,
      postId: row.report.postId,
      reporterMobileUserId: row.report.reporterMobileUserId,
      reporterName: row.reporter.displayName,
      communityName: row.community.name,
      postContent: row.post.content.slice(0, 200),
      reason: row.report.reason,
      details: row.report.details ?? undefined,
      status: row.report.status as 'open' | 'resolved',
      createdAt: row.report.createdAt.toISOString(),
      resolvedAt: row.report.resolvedAt?.toISOString() ?? null,
    }));

    return {
      reports,
      nextCursor: hasMore
        ? items[items.length - 1]!.report.createdAt.toISOString()
        : null,
    };
  }

  async resolveReport(reportId: string): Promise<void> {
    await db
      .update(communityPostReports)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(communityPostReports.id, reportId));
  }
}

export const communityPostService = new CommunityPostService();
