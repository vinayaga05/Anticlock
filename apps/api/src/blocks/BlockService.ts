import { and, asc, eq } from 'drizzle-orm';
import type {
  CreateProfileBlockRequest,
  ProfileBlock,
  ProfileBlockTarget,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  mobileUserBlocks,
  mobileUsers,
  providers,
} from '../db/schema.js';
import type { AuthClaims } from '../lib/auth.js';

export type BlockedProfileIds = {
  mobileUserIds: ReadonlySet<string>;
  providerIds: ReadonlySet<string>;
};

type ProfileBlockMutation = {
  block: ProfileBlock;
  created: boolean;
};

function appError(message: string, code: string, status: 400 | 403 | 404) {
  return Object.assign(new Error(message), { code, status });
}

async function requireMobileUser(auth: AuthClaims) {
  if (auth.kind !== 'mobile') {
    throw appError('A mobile session is required', 'forbidden', 403);
  }

  // Guest/device sessions deliberately do not have a row in mobile_users.
  // Blocks are a durable account preference, so they must not be attached to
  // a disposable device identifier.
  const [user] = await db
    .select({ id: mobileUsers.id })
    .from(mobileUsers)
    .where(and(eq(mobileUsers.id, auth.sub), eq(mobileUsers.isActive, true)))
    .limit(1);
  if (!user) {
    throw appError('Sign in to block a profile', 'mobile_account_required', 403);
  }
  return user;
}

function toProfileBlock(row: typeof mobileUserBlocks.$inferSelect): ProfileBlock {
  const isBusiness = Boolean(row.blockedProviderId);
  return {
    type: isBusiness ? 'business' : 'user',
    id: (isBusiness ? row.blockedProviderId : row.blockedMobileUserId)!,
    createdAt: row.createdAt.toISOString(),
  };
}

async function findBlock(
  blockerMobileUserId: string,
  target: ProfileBlockTarget,
) {
  const condition =
    target.type === 'business'
      ? and(
          eq(mobileUserBlocks.blockerMobileUserId, blockerMobileUserId),
          eq(mobileUserBlocks.blockedProviderId, target.id),
        )
      : and(
          eq(mobileUserBlocks.blockerMobileUserId, blockerMobileUserId),
          eq(mobileUserBlocks.blockedMobileUserId, target.id),
        );
  const [row] = await db
    .select()
    .from(mobileUserBlocks)
    .where(condition)
    .limit(1);
  return row ?? null;
}

/**
 * Read once per feed request and reuse for candidate filtering. This works for
 * both the legacy editorial Reels feed and the publishing feed without
 * exposing a block list to an unauthenticated viewer.
 */
export async function getBlockedProfileIds(
  blockerMobileUserId: string,
): Promise<BlockedProfileIds> {
  const rows = await db
    .select({
      blockedMobileUserId: mobileUserBlocks.blockedMobileUserId,
      blockedProviderId: mobileUserBlocks.blockedProviderId,
    })
    .from(mobileUserBlocks)
    .where(eq(mobileUserBlocks.blockerMobileUserId, blockerMobileUserId));

  return {
    mobileUserIds: new Set(
      rows
        .map(row => row.blockedMobileUserId)
        .filter((id): id is string => Boolean(id)),
    ),
    providerIds: new Set(
      rows
        .map(row => row.blockedProviderId)
        .filter((id): id is string => Boolean(id)),
    ),
  };
}

/** True when this exact profile (not its owner or membership) was blocked. */
export function isProfileBlocked(
  blocked: BlockedProfileIds,
  author: { type: 'user' | 'business'; id: string } | null | undefined,
) {
  if (!author) return false;
  return author.type === 'business'
    ? blocked.providerIds.has(author.id)
    : blocked.mobileUserIds.has(author.id);
}

export class BlockService {
  async create(
    auth: AuthClaims,
    target: CreateProfileBlockRequest,
  ): Promise<ProfileBlockMutation> {
    const blocker = await requireMobileUser(auth);

    if (target.type === 'user') {
      if (target.id === blocker.id) {
        throw appError('You cannot block yourself', 'cannot_block_self', 400);
      }
      const [targetUser] = await db
        .select({ id: mobileUsers.id })
        .from(mobileUsers)
        .where(and(eq(mobileUsers.id, target.id), eq(mobileUsers.isActive, true)))
        .limit(1);
      if (!targetUser) {
        throw appError('User profile not found', 'profile_not_found', 404);
      }
    } else {
      const [targetProvider] = await db
        .select({ id: providers.id, mobileUserId: providers.mobileUserId })
        .from(providers)
        .where(and(eq(providers.id, target.id), eq(providers.status, 'active')))
        .limit(1);
      if (!targetProvider) {
        throw appError('Business profile not found', 'profile_not_found', 404);
      }
      if (targetProvider.mobileUserId === blocker.id) {
        throw appError('You cannot block your own business', 'cannot_block_self', 400);
      }
    }

    const [inserted] = await db
      .insert(mobileUserBlocks)
      .values({
        blockerMobileUserId: blocker.id,
        blockedMobileUserId: target.type === 'user' ? target.id : null,
        blockedProviderId: target.type === 'business' ? target.id : null,
      })
      .onConflictDoNothing()
      .returning();

    if (inserted) {
      return { block: toProfileBlock(inserted), created: true };
    }

    // Repeating a block is safe and idempotent. This avoids duplicate client
    // taps turning a privacy preference into an error state.
    const existing = await findBlock(blocker.id, target);
    if (existing) return { block: toProfileBlock(existing), created: false };

    // A target can be deleted concurrently after validation. Do not claim the
    // block succeeded when no durable row was created.
    throw appError('Profile is no longer available', 'profile_not_found', 404);
  }

  async list(auth: AuthClaims): Promise<ProfileBlock[]> {
    const blocker = await requireMobileUser(auth);
    const rows = await db
      .select()
      .from(mobileUserBlocks)
      .where(eq(mobileUserBlocks.blockerMobileUserId, blocker.id))
      .orderBy(asc(mobileUserBlocks.createdAt));
    return rows.map(toProfileBlock);
  }

  async remove(auth: AuthClaims, target: ProfileBlockTarget) {
    const blocker = await requireMobileUser(auth);
    const condition =
      target.type === 'business'
        ? and(
            eq(mobileUserBlocks.blockerMobileUserId, blocker.id),
            eq(mobileUserBlocks.blockedProviderId, target.id),
          )
        : and(
            eq(mobileUserBlocks.blockerMobileUserId, blocker.id),
            eq(mobileUserBlocks.blockedMobileUserId, target.id),
          );
    const [removed] = await db
      .delete(mobileUserBlocks)
      .where(condition)
      .returning({ id: mobileUserBlocks.id });
    return { removed: Boolean(removed) };
  }
}

export const blockService = new BlockService();
