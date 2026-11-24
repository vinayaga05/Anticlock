import { and, asc, eq, gt, or, sql } from 'drizzle-orm';
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
  loadPublishers,
  publisherKey,
  resolveOwnedPublisher,
  type PublisherRef,
} from '../publishing/publisher.js';
import { notificationService } from '../notifications/NotificationService.js';
import { getStreamClient, isStreamConfigured } from '../lib/stream.js';
import { publishContentEvent } from '../realtime/contentEvents.js';
import { StreamChatService } from '../messages/StreamChatService.js';

type GraphTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lockProfiles(tx: GraphTransaction, ...profiles: PublisherRef[]) {
  for (const key of [...new Set(profiles.map(publisherKey))].sort()) {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
  }
}
const appError = (message: string, code: string, status: 400 | 403 | 404 | 409) =>
  Object.assign(new Error(message), { code, status });

export type ProfilePrivacy = {
  isPrivate: boolean;
  allowFollowRequests: boolean;
  showFollowerLists: boolean;
  allowMessages: boolean;
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
  canMessage: boolean,
): ProfileRelationship {
  const blocked = status === 'blocked';
  const following = status === 'following';
  return {
    canFollow: !isOwner && !blocked && (following || status === 'requested' || !privacy.isPrivate || privacy.allowFollowRequests),
    followStatus: isOwner ? 'not_following' : status,
    isFollowing: following,
    isRequested: status === 'requested',
    isBlocked: blocked,
    // A private profile exposes no normal content until accepted. Public
    // profiles still restrict `followers` visibility at the post gate.
    canViewContent: isOwner || (!privacy.isPrivate && !blocked) || following,
    canMessage: !isOwner && !blocked && canMessage,
  };
}

export async function getProfilePrivacy(target: PublisherRef, executor: Pick<typeof db, 'select'> = db): Promise<ProfilePrivacy> {
  if (target.type === 'personal') {
    const [row] = await executor
      .select({
        ownerUserId: mobileUsers.id,
        isPrivate: mobileUsers.isPrivate,
        allowFollowRequests: mobileUsers.allowFollowRequests,
        showFollowerLists: mobileUsers.showFollowerLists,
        allowMessages: mobileUsers.allowMessages,
      })
      .from(mobileUsers)
      .where(and(eq(mobileUsers.id, target.id), eq(mobileUsers.isActive, true)))
      .limit(1);
    if (!row) throw appError('Profile not found', 'not_found', 404);
    return row;
  }
  const [row] = await executor
    .select({
      ownerUserId: providers.mobileUserId,
      isPrivate: providers.isPrivate,
      allowFollowRequests: providers.allowFollowRequests,
      showFollowerLists: providers.showFollowerLists,
      allowMessages: providers.allowMessages,
    })
    .from(providers)
    .where(and(eq(providers.id, target.id), eq(providers.status, 'active'), sql`EXISTS (SELECT 1 FROM mobile_users owner WHERE owner.id = ${providers.mobileUserId} AND owner.is_active = true)`))
    .limit(1);
  if (!row) throw appError('Profile not found', 'not_found', 404);
  return row;
}

async function assertExisting(target: PublisherRef) {
  if (!(await loadPublisher(target))) throw appError('Profile not found', 'not_found', 404);
}

export async function profilesAreBlocked(a: PublisherRef, b: PublisherRef, executor: Pick<typeof db, 'select'> = db) {
  const [row] = await executor
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

export async function hasAcceptedFollowEitherDirection(a: PublisherRef, b: PublisherRef) {
  const [row] = await db
    .select({ id: profileFollows.id })
    .from(profileFollows)
    .where(
      and(
        eq(profileFollows.status, 'accepted'),
        or(
          and(
            eq(profileFollows.followerProfileId, a.id),
            eq(profileFollows.followerProfileType, a.type),
            eq(profileFollows.followedProfileId, b.id),
            eq(profileFollows.followedProfileType, b.type),
          ),
          and(
            eq(profileFollows.followerProfileId, b.id),
            eq(profileFollows.followerProfileType, b.type),
            eq(profileFollows.followedProfileId, a.id),
            eq(profileFollows.followedProfileType, a.type),
          ),
        ),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function canProfilesMessage(a: PublisherRef, b: PublisherRef) {
  if (same(a, b) || await profilesAreBlocked(a, b)) return false;
  const [aPrivacy, bPrivacy] = await Promise.all([getProfilePrivacy(a), getProfilePrivacy(b)]);
  if (aPrivacy.ownerUserId === bPrivacy.ownerUserId) return false;
  if (!aPrivacy.allowMessages || !bPrivacy.allowMessages) return false;
  return hasAcceptedFollowEitherDirection(a, b);
}

async function syncProfileConversation(a: PublisherRef, b: PublisherRef) {
  if (!isStreamConfigured()) return;
  const [aPrivacy, bPrivacy, aProfile, bProfile, eligible] = await Promise.all([
    getProfilePrivacy(a),
    getProfilePrivacy(b),
    loadPublisher(a),
    loadPublisher(b),
    canProfilesMessage(a, b),
  ]);
  if (!aProfile || !bProfile || aPrivacy.ownerUserId === bPrivacy.ownerUserId) return;
  const service = new StreamChatService(getStreamClient());
  if (eligible) {
    await service.createOrGetProfileChannel({
      viewerUserId: aPrivacy.ownerUserId,
      targetUserId: bPrivacy.ownerUserId,
      viewerProfile: { id: a.id, type: a.type, name: aProfile.displayName, image: aProfile.avatarUrl },
      targetProfile: { id: b.id, type: b.type, name: bProfile.displayName, image: bProfile.avatarUrl },
    });
  } else {
    await service.suspendProfileChannel({
      firstUserId: aPrivacy.ownerUserId,
      secondUserId: bPrivacy.ownerUserId,
      firstProfile: a,
      secondProfile: b,
    });
  }
}

async function syncProfileConversationQuietly(a: PublisherRef, b: PublisherRef) {
  try {
    await syncProfileConversation(a, b);
  } catch (error) {
    console.error('Failed to sync direct conversation:', error);
  }
}

/** Backfill or repair every eligible direct channel when an account connects. */
export async function syncAcceptedConversationsForUser(userId: string) {
  if (!isStreamConfigured()) return;
  const businesses = await db.select({ id: providers.id }).from(providers).where(and(
    eq(providers.mobileUserId, userId),
    eq(providers.status, 'active'),
  ));
  const owned: PublisherRef[] = [
    { id: userId, type: 'personal' },
    ...businesses.map(row => ({ id: row.id, type: 'business' as const })),
  ];
  const pairs = new Map<string, [PublisherRef, PublisherRef]>();
  for (const profile of owned) {
    const rows = await db.select({
      followerProfileId: profileFollows.followerProfileId,
      followerProfileType: profileFollows.followerProfileType,
      followedProfileId: profileFollows.followedProfileId,
      followedProfileType: profileFollows.followedProfileType,
    }).from(profileFollows).where(and(
      eq(profileFollows.status, 'accepted'),
      or(
        and(eq(profileFollows.followerProfileId, profile.id), eq(profileFollows.followerProfileType, profile.type)),
        and(eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type)),
      ),
    ));
    for (const row of rows) {
      const follower = { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] };
      const followed = { id: row.followedProfileId, type: row.followedProfileType as PublisherRef['type'] };
      const key = [publisherKey(follower), publisherKey(followed)].sort().join('|');
      pairs.set(key, [follower, followed]);
    }
  }
  await Promise.all([...pairs.values()].map(([a, b]) => syncProfileConversation(a, b)));
}

/** The content gate shared by feeds, direct post reads, comments and lists. */
export async function canProfileViewContent(viewer: PublisherRef, followed: PublisherRef) {
  if (same(viewer, followed)) return true;
  if (await profilesAreBlocked(viewer, followed)) return false;
  const privacy = await getProfilePrivacy(followed);
  return !privacy.isPrivate || hasAcceptedFollow(viewer, followed);
}


function activeProfile(id: typeof profileFollows.followerProfileId | typeof profileFollows.followedProfileId, type: typeof profileFollows.followerProfileType | typeof profileFollows.followedProfileType) {
  return sql`((${type} = 'personal' AND EXISTS (SELECT 1 FROM mobile_users u WHERE u.id = ${id} AND u.is_active = true))
    OR (${type} = 'business' AND EXISTS (SELECT 1 FROM providers p WHERE p.id = ${id} AND p.status = 'active' AND EXISTS (SELECT 1 FROM mobile_users owner WHERE owner.id = p.mobile_user_id AND owner.is_active = true)))) `;
}

export async function profileConnectionCounts(profile: PublisherRef) {
  const [followers, following, pending] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'accepted'), activeProfile(profileFollows.followerProfileId, profileFollows.followerProfileType),
    )),
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followerProfileId, profile.id), eq(profileFollows.followerProfileType, profile.type), eq(profileFollows.status, 'accepted'), activeProfile(profileFollows.followedProfileId, profileFollows.followedProfileType),
    )),
    db.select({ total: sql<number>`count(*)::int` }).from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'pending'), activeProfile(profileFollows.followerProfileId, profileFollows.followerProfileType),
    )),
  ]);
  return {
    followers: Number(followers[0]?.total ?? 0),
    following: Number(following[0]?.total ?? 0),
    pendingRequests: Number(pending[0]?.total ?? 0),
  };
}

async function socialChanged(a: PublisherRef, b?: PublisherRef) {
  const owners = b ? await Promise.all([getProfilePrivacy(a), getProfilePrivacy(b)]).then(rows => rows.map(row => row.ownerUserId)).catch(() => []) : undefined;
  await publishContentEvent({ type: 'social.changed', postId: a.id, format: '', publisherProfileId: a.id, publisherProfileType: a.type, at: new Date().toISOString(), affectedUserIds: owners });
}

async function viewerConnectionCounts(userId: string, profile: PublisherRef) {
  const counts = await profileConnectionCounts(profile);
  try { await resolveOwnedPublisher(userId, profile); }
  catch (error: any) {
    if (![403, 404].includes(error.status)) throw error;
    counts.pendingRequests = 0;
  }
  return counts;
}

export class ProfileFollowService {
  async relationship(viewer: PublisherRef, followed: PublisherRef): Promise<ProfileRelationship> {
    const privacy = await getProfilePrivacy(followed);
    if (same(viewer, followed)) return relationshipFor(privacy, 'not_following', true, false);
    if (await profilesAreBlocked(viewer, followed)) return relationshipFor(privacy, 'blocked', false, false);
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
    const canMessage = await canProfilesMessage(viewer, followed);
    return relationshipFor(
      privacy,
      row?.status === 'accepted' ? 'following' : row?.status === 'pending' ? 'requested' : 'not_following',
      false,
      canMessage,
    );
  }

  async follow(userId: string, input: CreateProfileFollowRequest) {
    const follower = ref({ id: input.followerProfileId, type: input.followerProfileType });
    const followed = ref({ id: input.followedProfileId, type: input.followedProfileType });
    if (same(follower, followed)) throw appError('You cannot follow yourself', 'cannot_follow_self', 400);
    await resolveOwnedPublisher(userId, follower);
    await assertExisting(followed);
    const { inserted, status, privacy } = await db.transaction(async tx => {
      await lockProfiles(tx, follower, followed);
      if (await profilesAreBlocked(follower, followed, tx)) throw appError('Profile is unavailable', 'profile_blocked', 403);
      const privacy = await getProfilePrivacy(followed, tx);
      const [existing] = await tx.select().from(profileFollows).where(and(
        eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
        eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      )).limit(1);
      if (existing) return { inserted: undefined, status: existing.status, privacy };
      if (privacy.isPrivate && !privacy.allowFollowRequests) {
        throw appError('This profile does not accept follow requests', 'follow_requests_disabled', 403);
      }
      const now = new Date();
      const status = privacy.isPrivate ? 'pending' : 'accepted';
      const [inserted] = await tx
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
        // A repeated tap must not downgrade an already accepted private follow.
        .onConflictDoNothing()
        .returning();
      return { inserted, status, privacy };
    });
    const row = inserted ?? (await db.select().from(profileFollows).where(and(
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
    )).limit(1))[0];
    const followerPublisher = await loadPublisher(follower);
    if (inserted) await notificationService.notifyUser(privacy.ownerUserId, {
      type: status === 'pending' ? 'follow_request' : 'new_follower',
      title: status === 'pending' ? 'Follow request' : 'New follower',
      body: `${followerPublisher?.displayName ?? 'Someone'} ${status === 'pending' ? 'requested to follow' : 'followed'} your ${followed.type === 'business' ? 'business' : 'profile'}`,
      data: { followerProfile: follower, followedProfile: followed },
    }).catch(() => undefined);
    if (status === 'accepted') await syncProfileConversationQuietly(follower, followed);
    await socialChanged(follower, followed);
    const [relationship, followedCounts, followerCounts] = await Promise.all([
      this.relationship(follower, followed),
      viewerConnectionCounts(userId, followed),
      profileConnectionCounts(follower),
    ]);
    return { follow: row!, relationship, followedCounts, followerCounts };
  }

  async unfollow(userId: string, follower: PublisherRef, followed: PublisherRef) {
    await resolveOwnedPublisher(userId, follower);
    await assertExisting(followed);
    const [removed] = await db.transaction(async tx => {
      await lockProfiles(tx, follower, followed);
      return tx
      .delete(profileFollows)
      .where(and(
        eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
        eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      ))
      .returning({ id: profileFollows.id });
    });
    if (removed) await syncProfileConversationQuietly(follower, followed);
    await socialChanged(follower, followed);
    const [relationship, followedCounts, followerCounts] = await Promise.all([
      this.relationship(follower, followed),
      viewerConnectionCounts(userId, followed),
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
    const publishers = await Promise.all(rows.map(async row => {
      const peer = { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] };
      return await profilesAreBlocked(followed, peer) ? null : loadPublisher(peer);
    }));
    return rows.map((row, index) => ({
      id: row.id,
      follower: publishers[index],
      createdAt: row.createdAt.toISOString(),
    })).filter(item => item.follower !== null);
  }

  async incomingPage(userId: string, followed: PublisherRef, options: { limit: number; cursor?: string }) {
    await resolveOwnedPublisher(userId, followed);
    const rows = await db.select().from(profileFollows).where(and(
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'), activeProfile(profileFollows.followerProfileId, profileFollows.followerProfileType),
      options.cursor ? gt(profileFollows.id, options.cursor) : undefined,
    )).orderBy(asc(profileFollows.id)).limit(options.limit + 1);
    const page = rows.slice(0, options.limit);
    const items = await Promise.all(page.map(async row => {
      const follower = { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] };
      if (await profilesAreBlocked(followed, follower)) return null;
      const profile = await loadPublisher(follower);
      return profile ? { id: row.id, follower: profile, createdAt: row.createdAt.toISOString() } : null;
    }));
    return { items: items.filter(item => item !== null), nextCursor: rows.length > options.limit ? page[page.length - 1]!.id : null };
  }

  async listConnections(
    userId: string, target: PublisherRef, viewer: PublisherRef,
    direction: 'followers' | 'following', options: { limit: number; cursor?: string } = { limit: 30 },
  ) {
    await resolveOwnedPublisher(userId, viewer);
    const privacy = await getProfilePrivacy(target);
    let ownsTarget = same(viewer, target);
    if (!ownsTarget) {
      try { await resolveOwnedPublisher(userId, target); ownsTarget = true; }
      catch (error: any) { if (![403, 404].includes(error.status)) throw error; }
    }
    if ((!privacy.showFollowerLists || privacy.isPrivate) && !ownsTarget &&
        (!privacy.showFollowerLists || !(await hasAcceptedFollow(viewer, target)))) {
      throw appError('This account’s connections are private', 'private_connections', 403);
    }
    if (await profilesAreBlocked(viewer, target)) throw appError('Profile not found', 'not_found', 404);
    const peerId = direction === 'followers' ? profileFollows.followerProfileId : profileFollows.followedProfileId;
    const peerType = direction === 'followers' ? profileFollows.followerProfileType : profileFollows.followedProfileType;
    const rows = await db.select().from(profileFollows).where(and(
      direction === 'followers'
        ? and(eq(profileFollows.followedProfileId, target.id), eq(profileFollows.followedProfileType, target.type))
        : and(eq(profileFollows.followerProfileId, target.id), eq(profileFollows.followerProfileType, target.type)),
      eq(profileFollows.status, 'accepted'),
      options.cursor ? gt(profileFollows.id, options.cursor) : undefined,
      activeProfile(peerId, peerType),
      sql`NOT EXISTS (SELECT 1 FROM profile_blocks b WHERE
        (b.blocker_profile_id = ${viewer.id} AND b.blocker_profile_type = ${viewer.type} AND b.blocked_profile_id = ${peerId} AND b.blocked_profile_type = ${peerType}) OR
        (b.blocked_profile_id = ${viewer.id} AND b.blocked_profile_type = ${viewer.type} AND b.blocker_profile_id = ${peerId} AND b.blocker_profile_type = ${peerType}))`,
    )).orderBy(asc(profileFollows.id)).limit(options.limit + 1);
    const page = rows.slice(0, options.limit);
    const refs = page.map(row => direction === 'followers'
      ? { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] }
      : { id: row.followedProfileId, type: row.followedProfileType as PublisherRef['type'] });
    const profiles = await loadPublishers(refs);
    const items = await Promise.all(refs.map(async peer => {
      const profile = profiles.get(publisherKey(peer));
      if (!profile) return null;
      try {
        return { profile, relationship: await this.relationship(viewer, peer), canRemove: ownsTarget && direction === 'followers' };
      } catch (error: any) { if (error.status === 404) return null; throw error; }
    }));
    const counts = await profileConnectionCounts(target);
    if (!ownsTarget) counts.pendingRequests = 0;
    return { items: items.filter(item => item !== null),
      nextCursor: rows.length > options.limit ? page[page.length - 1]!.id : null,
      counts, isOwner: ownsTarget };
  }

  async removeFollower(userId: string, followed: PublisherRef, follower: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    const [removed] = await db.transaction(async tx => {
      await lockProfiles(tx, follower, followed);
      return tx.delete(profileFollows).where(and(
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
    )).returning({ id: profileFollows.id });
    });
    if (removed) await syncProfileConversationQuietly(follower, followed);
    await socialChanged(follower, followed);
    return { removed: Boolean(removed), followedCounts: await profileConnectionCounts(followed) };
  }

  async accept(userId: string, followed: PublisherRef, follower: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    await assertExisting(follower);
    if (await profilesAreBlocked(follower, followed)) throw appError('Profile unavailable', 'profile_blocked', 403);
    const now = new Date();
    const [accepted] = await db.transaction(async tx => {
      await lockProfiles(tx, follower, followed);
      if (await profilesAreBlocked(follower, followed, tx)) throw appError('Profile unavailable', 'profile_blocked', 403);
      return tx.update(profileFollows).set({ status: 'accepted', acceptedAt: now, updatedAt: now }).where(and(
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'),
    )).returning();
    });
    if (!accepted) {
      if (await hasAcceptedFollow(follower, followed)) return { accepted: true };
      throw appError('Follow request not found', 'not_found', 404);
    }
    const followerPrivacy = await getProfilePrivacy(follower);
    await notificationService.notifyUser(followerPrivacy.ownerUserId, {
      type: 'follow_accepted', title: 'Follow request accepted', body: 'Your follow request was accepted.',
      data: { followerProfile: follower, followedProfile: followed },
    }).catch(() => undefined);
    await syncProfileConversationQuietly(follower, followed);
    await socialChanged(follower, followed);
    return accepted;
  }

  async reject(userId: string, followed: PublisherRef, follower: PublisherRef) {
    await resolveOwnedPublisher(userId, followed);
    const [removed] = await db.transaction(async tx => {
      await lockProfiles(tx, follower, followed);
      return tx.delete(profileFollows).where(and(
      eq(profileFollows.followerProfileId, follower.id), eq(profileFollows.followerProfileType, follower.type),
      eq(profileFollows.followedProfileId, followed.id), eq(profileFollows.followedProfileType, followed.type),
      eq(profileFollows.status, 'pending'),
    )).returning({ id: profileFollows.id });
    });
    await socialChanged(follower, followed);
    return { removed: Boolean(removed) };
  }

  async block(userId: string, blocker: PublisherRef, blocked: PublisherRef) {
    if (same(blocker, blocked)) throw appError('You cannot block yourself', 'cannot_block_self', 400);
    await resolveOwnedPublisher(userId, blocker);
    await assertExisting(blocked);
    await db.transaction(async tx => {
      await lockProfiles(tx, blocker, blocked);
      await tx.insert(profileBlocks).values({ blockerProfileId: blocker.id, blockerProfileType: blocker.type, blockedProfileId: blocked.id, blockedProfileType: blocked.type }).onConflictDoNothing();
      await tx.delete(profileFollows).where(or(
        and(eq(profileFollows.followerProfileId, blocker.id), eq(profileFollows.followerProfileType, blocker.type), eq(profileFollows.followedProfileId, blocked.id), eq(profileFollows.followedProfileType, blocked.type)),
        and(eq(profileFollows.followerProfileId, blocked.id), eq(profileFollows.followerProfileType, blocked.type), eq(profileFollows.followedProfileId, blocker.id), eq(profileFollows.followedProfileType, blocker.type)),
      ));
    });
    await syncProfileConversationQuietly(blocker, blocked);
    await socialChanged(blocker, blocked);
  }

  async unblock(userId: string, blocker: PublisherRef, blocked: PublisherRef) {
    await resolveOwnedPublisher(userId, blocker);
    const [removed] = await db.transaction(async tx => {
      await lockProfiles(tx, blocker, blocked);
      return tx.delete(profileBlocks).where(and(
      eq(profileBlocks.blockerProfileId, blocker.id), eq(profileBlocks.blockerProfileType, blocker.type),
      eq(profileBlocks.blockedProfileId, blocked.id), eq(profileBlocks.blockedProfileType, blocked.type),
    )).returning({ id: profileBlocks.id });
    });
    await socialChanged(blocker, blocked);
    return { removed: Boolean(removed) };
  }

  async updatePrivacy(userId: string, profile: PublisherRef, update: ProfilePrivacyUpdate) {
    await resolveOwnedPublisher(userId, profile);
    const { newlyAccepted, connections } = await db.transaction(async tx => {
      await lockProfiles(tx, profile);
      const values = { ...update, updatedAt: new Date() };
      if (profile.type === 'personal') {
        await tx.update(mobileUsers).set(values).where(eq(mobileUsers.id, profile.id));
      } else {
        await tx.update(providers).set(values).where(eq(providers.id, profile.id));
      }
      // Social convention: publishing a private profile auto-accepts its existing requests.
      const newlyAccepted = update.isPrivate === false
        ? await tx.update(profileFollows).set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() }).where(and(
            eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type), eq(profileFollows.status, 'pending'), activeProfile(profileFollows.followerProfileId, profileFollows.followerProfileType),
          )).returning({
            followerProfileId: profileFollows.followerProfileId,
            followerProfileType: profileFollows.followerProfileType,
          })
        : [];
      const connections = update.allowMessages !== undefined
        ? await tx.select({
            followerProfileId: profileFollows.followerProfileId,
            followerProfileType: profileFollows.followerProfileType,
            followedProfileId: profileFollows.followedProfileId,
            followedProfileType: profileFollows.followedProfileType,
          }).from(profileFollows).where(and(
            eq(profileFollows.status, 'accepted'),
            or(
              and(eq(profileFollows.followerProfileId, profile.id), eq(profileFollows.followerProfileType, profile.type)),
              and(eq(profileFollows.followedProfileId, profile.id), eq(profileFollows.followedProfileType, profile.type)),
            ),
          ))
        : [];
      return { newlyAccepted, connections };
    });
    const peers = [
      ...newlyAccepted.map(row => ({ id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] })),
      ...connections.map(row => row.followerProfileId === profile.id && row.followerProfileType === profile.type
        ? { id: row.followedProfileId, type: row.followedProfileType as PublisherRef['type'] }
        : { id: row.followerProfileId, type: row.followerProfileType as PublisherRef['type'] }),
    ];
    await Promise.all([...new Map(peers.map(peer => [publisherKey(peer), peer])).values()]
      .map(peer => syncProfileConversationQuietly(profile, peer)));
    await socialChanged(profile);
    return getProfilePrivacy(profile);
  }
}

export const profileFollowService = new ProfileFollowService();
