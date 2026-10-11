import { and, asc, eq, or, sql } from 'drizzle-orm';
import type {
  CreateProfileFollowRequest,
  ProfileFollowTarget,
  ProfilePrivacyUpdate,
  ProfileRef,
  ProfileRelationship,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mobileUsers, profileBlocks, profileFollows, providers } from '../db/schema.js';
import {
  loadPublisher,
  publisherKey,
  resolveOwnedPublisher,
  type PublisherRef,
} from '../publishing/publisher.js';
import { notificationService } from '../notifications/NotificationService.js';

const appError = (message: string, code: string, status: 400 | 403 | 404 | 409) =>
  Object.assign(new Error(message), { code, status });

export type ProfilePrivacy = {
  isPrivate: boolean;
  allowFollowRequests: boolean;
  showFollowerLists: boolean;
  ownerUserId: string;
};

function same(a: PublisherRef, b: PublisherRef) {
  return a.id === b.id && a.type === b.type;
}

function ref(input: ProfileRef | PublisherRef): PublisherRef {
  return { id: input.id, type: input.type };
}

function relationshipFor(
  privacy: ProfilePrivacy,
  status: ProfileRelationship['followStatus'],
  isOwner: boolean,
): ProfileRelationship {
  const blocked = status === 'blocked';
  const following = status === 'following';
  return {
    canFollow: !isOwner && !blocked,
    followStatus: isOwner ? 'not_following' : status,
    isFollowing: following,
    isRequested: status === 'requested',
    isBlocked: blocked,
    // A private profile exposes no normal content until accepted. Public
    // profiles still restrict `followers` visibility at the post gate.
    canViewContent: isOwner || (!privacy.isPrivate && !blocked) || following,
  };
}

export async function getProfilePrivacy(target: PublisherRef): Promise<ProfilePrivacy> {
  if (target.type === 'personal') {
    const [row] = await db
      .select({
        ownerUserId: mobileUsers.id,
        isPrivate: mobileUsers.isPrivate,
        allowFollowRequests: mobileUsers.allowFollowRequests,
        showFollowerLists: mobileUsers.showFollowerLists,
      })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, target.id), eq(mobileUsers.isActive, true)))
      .limit(1);
    if (!row) throw appError('Profile not found', 'not_found', 404);
    return row;
  }
  const [row] = await db
    .select({
      ownerUserId: providers.mobileUserId,
      isPrivate: providers.isPrivate,
      allowFollowRequests: providers.allowFollowRequests,
      showFollowerLists: providers.showFollowerLists,
    })
    .from(providers)
    .where(and(eq(providers.id, target.id), eq(providers.status, 'active')))
    .limit(1);
  if (!row) throw appError('Profile not found', 'not_found', 404);
  return row;
}

async function assertExisting(target: PublisherRef) {
  if (!(await loadPublisher(target))) throw appError('Profile not found', 'not_found', 404);
}

export async function profilesAreBlocked(a: PublisherRef, b: PublisherRef) {
  const [row] = await db
    .select({ id: profileBlocks.id })
    .from(profileBlocks)
    .where(
      or(
        and(
          eq(profileBlocks.blockerProfileId, a.id),
          eq(profileBlocks.blockerProfileType, a.type),
          eq(profileBlocks.blockedProfileId, b.id),
          eq(profileBlocks.blockedProfileType, b.type),
        ),
        and(
          eq(profileBlocks.blockerProfileId, b.id),
          eq(profileBlocks.blockerProfileType, b.type),
          eq(profileBlocks.blockedProfileId, a.id),
          eq(profileBlocks.blockedProfileType, a.type),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasAcceptedFollow(follower: PublisherRef, followed: PublisherRef) {
  const [row] = await db
    .select({ id: profileFollows.id })
    .from(profileFollows)
    .where(
      and(
        eq(profileFollows.followerProfileId, follower.id),
        eq(profileFollows.followerProfileType, follower.type),
        eq(profileFollows.followedProfileId, followed.id),
        eq(profileFollows.followedProfileType, followed.type),
        eq(profileFollows.status, 'accepted'),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** The content gate shared by feeds, direct post reads, comments and lists. */
export async function canProfileViewContent(viewer: PublisherRef, followed: PublisherRef) {
  if (same(viewer, followed)) return true;
  if (await profilesAreBlocked(viewer, followed)) return false;
  const privacy = await getProfilePrivacy(followed);
  return !privacy.isPrivate || hasAcceptedFollow(viewer, followed);
}

export async function profileConnectionCounts(profile: PublisherRef) {
  const [followers, following, pending] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'accepted'),
    )),
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followerProfileId, profile.id), eq(profileFollows.followerProfileType, profile.type), eq(profileFollows.status, 'accepted'),
    )),
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'pending'),
    )),
  ]);
  return {
    followers: Number(followers[0]?.total ?? 0),
    following: Number(following[0]?.total ?? 0),
    pendingRequests: Number(pending[0]?.total ?? 0),
  };
}

export class ProfileFollowService {
  async relationship(viewer: PublisherRef, followed: PublisherRef): Promise<ProfileRelationship> {
    const privacy = await getProfilePrivacy(followed);
    if (same(viewer, followed)) return relationshipFor(privacy, 'not_following', true);
    if (await profilesAreBlocked(viewer, followed)) return relationshipFor(privacy, 'blocked', false);
    const [row] = await db
      .select({ status: profileFollows.status })
      .from(profileFollows)
      .where(
        and(
          eq(profileFollows.followerProfileId, viewer.id),
          eq(profileFollows.followerProfileType, viewer.type),
          eq(profileFollows.followedProfileId, followed.id),
          eq(profileFollows.followedProfileType, followed.type),
        ),
      )
      .limit(1);
    return relationshipFor(
      privacy,
      row?.status === 'accepted' ? 'following' : row?.status === 'pending' ? 'requested' : 'not_following',
      false,
    );
  }

  async follow(userId: string, input: CreateProfileFollowRequest) {
    const follower = ref({ id: input.followerProfileId, type: input.followerProfileType });
    const followed = ref({ id: input.followedProfileId, type: input.followedProfileType });
    if (same(follower, followed)) throw appError('You cannot follow yourself', 'cannot_follow_self', 400);
    await resolveOwnedPublisher(userId, follower);
    await assertExisting(followed);
    if (await profilesAreBlocked(follower, followed)) throw appError('Profile is unavailable', 'profile_blocked', 403);
    const privacy = await getProfilePrivacy(followed);
    if (privacy.isPrivate && !privacy.allowFollowRequests) {
      throw appError('This profile does not accept follow requests', 'follow_requests_disabled', 403);
    }
    const now = new Date();
    const status = privacy.isPrivate ? 'pending' : 'accepted';
    const [row] = await db
      .insert(profileFollows)
      .values({
        followerProfileId: follower.id,
        followerProfileType: follower.type,
        followedProfileId: followed.id,
        followedProfileType: followed.type,
        status,
        acceptedAt: status === 'accepted' ? now : null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          profileFollows.followerProfileId,
          profileFollows.followedProfileId,
        ],
        set: { status, acceptedAt: status === 'accepted' ? now : null, updatedAt: now },
      })
      .returning();
    const followerPublisher = await loadPublisher(follower);
    await notificationService.notifyUser(privacy.ownerUserId, {
      type: status === 'pending' ? 'follow_request' : 'new_follower',
      title: status === 'pending' ? 'Follow request' : 'New follower',
      body: `${followerPublisher?.displayName ?? 'Someone'} ${status === 'pending' ? 'requested to follow' : 'followed'} your ${followed.type === 'business' ? 'business' : 'profile'}`,
      data: { followerProfile: follower, followedProfile: followed },
    }).catch(() => undefined);
    const [relationship, followedCounts, followerCounts] = await Promise.all([
      this.relationship(follower, followed),
      profileConnectionCounts(followed),
      profileConnectionCounts(follower),
    ]);
    return { follow: row!, relationship, followedCounts, followerCounts };
  }

  async unfollow(userId: string, follower: PublisherRef, followed: PublisherRef) {
    await resolveOwnedPublisher(userId, follower);
    await assertExisting(followed);
    const [removed] = await db
      .delete(profileFollows)
      .where(and(
        eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
        eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      ))
      .returning({ id: profileFollows.id });
    const [relationship, followedCounts, followerCounts] = await Promise.all([
      this.relationship(follower, followed),
      profileConnectionCounts(followed),
      profileConnectionCounts(follower),
    ]);
    return { removed: Boolean(removed), relationship, followedCounts, followerCounts };
  }

  async incoming(userId: string, followed: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    const rows = await db.select().from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, followed.id),
      eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'),
    )).orderBy(asc(profileFollows.createdAt));
    const publishers = await Promise.all(rows.map(row => loadPublisher({ id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] })));
    return rows.map((row, index) => ({
      id: row.id,
      follower: publishers[index],
      createdAt: row.createdAt.toISOString(),
    })).filter(item => item.follower !== null);
  }

  async listConnections(
    userId: string,
    target: PublisherRef,
    viewer: PublisherRef,
    direction: 'followers' | 'following',
  ) {
    await resolveOwnedPublisher(userId, viewer);
    const privacy = await getProfilePrivacy(target);
    const ownsTarget = same(viewer, target);
    if (!privacy.showFollowerLists && !ownsTarget) throw appError('Profile list is private', 'not_found', 404);
    if (privacy.isPrivate && !ownsTarget && !(await hasAcceptedFollow(viewer, target))) {
      throw appError('Profile list is private', 'not_found', 404);
    }
    if (await profilesAreBlocked(viewer, target)) throw appError('Profile not found', 'not_found', 404);
    const rows = await db.select().from(profileFollows).where(and(
      direction === 'followers'
        ? and(eq(profileFollows.followedProfileId, target.id), eq(profileFollows.followedProfileType, target.type))
        : and(eq(profileFollows.followerProfileId, target.id), eq(profileFollows.followerProfileType, target.type)),
      eq(profileFollows.status, 'accepted'),
    )).orderBy(asc(profileFollows.acceptedAt));
    const refs = rows.map(row => direction === 'followers'
      ? { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] }
      : { id: row.followedProfileId, type: row.followedProfileType as PublisherRef['type'] });
    const profiles = await Promise.all(refs.map(item => loadPublisher(item)));
    return profiles.filter((item): item is NonNullable<typeof item> => item !== null);
  }

  async accept(userId: string, followed: PublisherRef, follower: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    const now = new Date();
    const [accepted] = await db.update(profileFollows).set({ status: 'accepted', acceptedAt: now, updatedAt: now }).where(and(
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'),
    )).returning();
    if (!accepted) throw appError('Follow request not found', 'not_found', 404);
    const followerPrivacy = await getProfilePrivacy(follower);
    await notificationService.notifyUser(followerPrivacy.ownerUserId, {
      type: 'follow_accepted', title: 'Follow request accepted', body: 'Your follow request was accepted.',
      data: { followerProfile: follower, followedProfile: followed },
    }).catch(() => undefined);
    return accepted;
  }

  async reject(userId: string, followed: PublisherRef, follower: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    const [removed] = await db.delete(profileFollows).where(and(
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'),
    )).returning({ id: profileFollows.id });
    return { removed: Boolean(removed) };
  }

  async block(userId: string, blocker: PublisherRef, blocked: PublisherRef) {
    if (same(blocker, blocked)) throw appError('You cannot block yourself', 'cannot_block_self', 400);
    await resolveOwnedPublisher(userId, blocker);
    await assertExisting(blocked);
    await db.transaction(async tx => {
      await tx.insert(profileBlocks).values({ blockerProfileId: blocker.id, blockerProfileType: blocker.type, blockedProfileId: blocked.id, blockedProfileType: blocked.type }).onConflictDoNothing();
      await tx.delete(profileFollows).where(or(
        and(eq(profileFollows.followerProfileId, blocker.id), eq(profileFollows.followerProfileType, blocker.type), eq(profileFollows.followedProfileId, blocked.id), eq(profileFollows.followedProfileType, blocked.type)),
        and(eq(profileFollows.followerProfileId, blocked.id), eq(profileFollows.followerProfileType, blocked.type), eq(profileFollows.followedProfileId, blocker.id), eq(profileFollows.followedProfileType, blocker.type)),
      ));
    });
  }

  async unblock(userId: string, blocker: PublisherRef, blocked: PublisherRef) {
    await resolveOwnedPublisher(userId, blocker);
    const [removed] = await db.delete(profileBlocks).where(and(
      eq(profileBlocks.blockerProfileId, blocker.id), eq(profileBlocks.blockerProfileType, blocker.type),
      eq(profileBlocks.blockedProfileId, blocked.id), eq(profileBlocks.blockedProfileType, blocked.type),
    )).returning({ id: profileBlocks.id });
    return { removed: Boolean(removed) };
  }

  async updatePrivacy(userId: string, profile: PublisherRef, update: ProfilePrivacyUpdate) {
    await resolveOwnedPublisher(userId, profile);
    const values = { ...update, updatedAt: new Date() };
    if (profile.type === 'personal') {
      await db.update(mobileUsers).set(values).where(eq(mobileUsers.id, profile.id));
    } else {
      await db.update(providers).set(values).where(eq(providers.id, profile.id));
    }
    // Social convention: publishing a private profile auto-accepts its existing requests.
    if (!update.isPrivate) {
      const now = new Date();
      await db.update(profileFollows).set({ status: 'accepted', acceptedAt: now, updatedAt: now }).where(and(
        eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'pending'),
      ));
    }
    return getProfilePrivacy(profile);
  }
}

export const profileFollowService = new ProfileFollowService();
