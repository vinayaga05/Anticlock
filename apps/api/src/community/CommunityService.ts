import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type {
  Community,
  CommunityDetail,
  CommunityMember,
  CreateCommunityRequest,
  UpdateCommunityRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  communities,
  communityMembers,
  mobileUsers,
} from '../db/schema.js';

export class CommunityService {
  async createCommunity(
    ownerId: string,
    request: CreateCommunityRequest,
  ): Promise<Community> {
    const [row] = await db
      .insert(communities)
      .values({
        ownerId,
        name: request.name,
        slug: request.slug,
        description: request.description,
        tags: request.tags ?? [],
        memberCount: 1,
        postCount: 0,
        status: 'published',
      })
      .returning();

    await db.insert(communityMembers).values({
      communityId: row!.id,
      mobileUserId: ownerId,
      role: 'owner',
    });

    return this.getCommunityById(row!.id);
  }

  async getCommunity(communityId: string, viewerId?: string): Promise<CommunityDetail | null> {
    const community = await this.getCommunityById(communityId);
    if (!community) return null;

    const [owner] = await db
      .select({
        displayName: mobileUsers.displayName,
        avatarUrl: mobileUsers.avatarUrl,
      })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, community.ownerId));

    let membership = null;
    if (viewerId) {
      [membership] = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.communityId, communityId),
            eq(communityMembers.mobileUserId, viewerId),
          ),
        );
    }

    return {
      ...community,
      ownerName: owner?.displayName ?? 'Unknown',
      ownerAvatarUrl: owner?.avatarUrl ?? undefined,
      isMember: !!membership,
      myRole: membership ? (membership.role as 'owner' | 'moderator' | 'member') : null,
    };
  }

  private async getCommunityById(communityId: string): Promise<Community> {
    const [row] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId));

    if (!row) {
      throw Object.assign(new Error('Community not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? undefined,
      imageUrl: row.imageUrl ?? undefined,
      coverUrl: row.coverUrl ?? undefined,
      memberCount: row.memberCount,
      postCount: row.postCount,
      tags: (row.tags as string[]) ?? [],
      status: row.status as 'draft' | 'published' | 'archived',
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      suspendedAt: row.suspendedAt?.toISOString() ?? null,
    };
  }

  async getCommunityBySlug(slug: string): Promise<Community | null> {
    const [row] = await db
      .select()
      .from(communities)
      .where(eq(communities.slug, slug));

    if (!row) return null;
    return this.getCommunityById(row.id);
  }

  async listCommunities(
    options: {
      search?: string;
      tags?: string[];
      status?: 'draft' | 'published' | 'archived';
      limit?: number;
      cursor?: string;
    } = {},
    viewerId?: string,
  ): Promise<{ communities: CommunityDetail[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);
    const conditions = [];

    if (options.status) {
      conditions.push(eq(communities.status, options.status));
    }

    if (options.search) {
      conditions.push(
        or(
          ilike(communities.name, `%${options.search}%`),
          ilike(communities.description, `%${options.search}%`),
        )!,
      );
    }

    if (options.tags && options.tags.length > 0) {
      conditions.push(
        sql`${communities.tags} @> ${JSON.stringify(options.tags)}`,
      );
    }

    const rows = await db
      .select()
      .from(communities)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(communities.createdAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const communitiesWithDetails = await Promise.all(
      items.map((row) => this.getCommunity(row.id, viewerId)),
    );

    return {
      communities: communitiesWithDetails.filter((c): c is CommunityDetail => c !== null),
      nextCursor: hasMore ? items[items.length - 1]!.createdAt.toISOString() : null,
    };
  }

  async listMyCommunities(
    userId: string,
    options: {
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ communities: CommunityDetail[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 20, 100);

    const rows = await db
      .select({
        community: communities,
      })
      .from(communityMembers)
      .innerJoin(communities, eq(communityMembers.communityId, communities.id))
      .where(eq(communityMembers.mobileUserId, userId))
      .orderBy(desc(communityMembers.joinedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const communitiesWithDetails = await Promise.all(
      items.map((row) => this.getCommunity(row.community.id, userId)),
    );

    return {
      communities: communitiesWithDetails.filter((c): c is CommunityDetail => c !== null),
      nextCursor: hasMore
        ? items[items.length - 1]!.community.createdAt.toISOString()
        : null,
    };
  }

  async updateCommunity(
    communityId: string,
    request: UpdateCommunityRequest,
  ): Promise<Community> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (request.name !== undefined) updateData.name = request.name;
    if (request.description !== undefined) updateData.description = request.description;
    if (request.tags !== undefined) updateData.tags = request.tags;
    if (request.status !== undefined) updateData.status = request.status;

    const [row] = await db
      .update(communities)
      .set(updateData)
      .where(eq(communities.id, communityId))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Community not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    return this.getCommunityById(communityId);
  }

  async deleteCommunity(communityId: string): Promise<void> {
    await db.delete(communities).where(eq(communities.id, communityId));
  }

  async suspendCommunity(communityId: string): Promise<Community> {
    const [row] = await db
      .update(communities)
      .set({
        status: 'archived',
        suspendedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId))
      .returning();

    if (!row) {
      throw Object.assign(new Error('Community not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    return this.getCommunityById(communityId);
  }

  async joinCommunity(communityId: string, userId: string): Promise<CommunityMember> {
    const [existing] = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.mobileUserId, userId),
        ),
      );

    if (existing) {
      throw Object.assign(new Error('Already a member'), {
        code: 'already_member',
        status: 409,
      });
    }

    const [member] = await db
      .insert(communityMembers)
      .values({
        communityId,
        mobileUserId: userId,
        role: 'member',
      })
      .returning();

    await db
      .update(communities)
      .set({
        memberCount: sql`${communities.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId));

    const [user] = await db
      .select({
        displayName: mobileUsers.displayName,
        avatarUrl: mobileUsers.avatarUrl,
      })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, userId));

    return {
      id: member!.id,
      communityId: member!.communityId,
      mobileUserId: member!.mobileUserId,
      role: member!.role as 'owner' | 'moderator' | 'member',
      userName: user?.displayName ?? 'Unknown',
      userAvatarUrl: user?.avatarUrl ?? undefined,
      joinedAt: member!.joinedAt.toISOString(),
    };
  }

  async leaveCommunity(communityId: string, userId: string): Promise<void> {
    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, communityId));

    if (!community) {
      throw Object.assign(new Error('Community not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    if (community.ownerId === userId) {
      throw Object.assign(new Error('Owner cannot leave community'), {
        code: 'forbidden',
        status: 403,
      });
    }

    const result = await db
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.mobileUserId, userId),
        ),
      );

    await db
      .update(communities)
      .set({
        memberCount: sql`GREATEST(${communities.memberCount} - 1, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId));
  }

  async listMembers(
    communityId: string,
    options: {
      limit?: number;
      cursor?: string;
    } = {},
  ): Promise<{ members: CommunityMember[]; nextCursor: string | null }> {
    const limit = Math.min(options.limit ?? 50, 100);

    const rows = await db
      .select({
        member: communityMembers,
        user: {
          displayName: mobileUsers.displayName,
          avatarUrl: mobileUsers.avatarUrl,
        },
      })
      .from(communityMembers)
      .innerJoin(mobileUsers, eq(communityMembers.mobileUserId, mobileUsers.id))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(desc(communityMembers.joinedAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const members: CommunityMember[] = items.map((row) => ({
      id: row.member.id,
      communityId: row.member.communityId,
      mobileUserId: row.member.mobileUserId,
      role: row.member.role as 'owner' | 'moderator' | 'member',
      userName: row.user.displayName,
      userAvatarUrl: row.user.avatarUrl ?? undefined,
      joinedAt: row.member.joinedAt.toISOString(),
    }));

    return {
      members,
      nextCursor: hasMore
        ? items[items.length - 1]!.member.joinedAt.toISOString()
        : null,
    };
  }

  async updateMemberRole(
    communityId: string,
    memberId: string,
    role: 'owner' | 'moderator' | 'member',
  ): Promise<CommunityMember> {
    const [member] = await db
      .update(communityMembers)
      .set({ role })
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.mobileUserId, memberId),
        ),
      )
      .returning();

    if (!member) {
      throw Object.assign(new Error('Member not found'), {
        code: 'not_found',
        status: 404,
      });
    }

    const [user] = await db
      .select({
        displayName: mobileUsers.displayName,
        avatarUrl: mobileUsers.avatarUrl,
      })
      .from(mobileUsers)
      .where(eq(mobileUsers.id, memberId));

    return {
      id: member.id,
      communityId: member.communityId,
      mobileUserId: member.mobileUserId,
      role: member.role as 'owner' | 'moderator' | 'member',
      userName: user?.displayName ?? 'Unknown',
      userAvatarUrl: user?.avatarUrl ?? undefined,
      joinedAt: member.joinedAt.toISOString(),
    };
  }

  async getMemberRole(communityId: string, userId: string): Promise<string | null> {
    const [member] = await db
      .select({ role: communityMembers.role })
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.communityId, communityId),
          eq(communityMembers.mobileUserId, userId),
        ),
      );

    return member?.role ?? null;
  }
}

export const communityService = new CommunityService();
