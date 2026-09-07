import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  INTEREST_MIN_SELECTIONS,
  type InterestOption,
  type UpdateMyInterestsRequest,
} from '@anticlock/contracts';
import { db } from '../db/client.js';
import {
  interestOptions,
  mobileUserInterests,
  mobileUsers,
} from '../db/schema.js';

function toInterestOption(row: typeof interestOptions.$inferSelect): InterestOption {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl ?? undefined,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

function applicationError(code: string, message: string, status: number) {
  return Object.assign(new Error(message), { code, status });
}

export class InterestService {
  async getForUser(userId: string) {
    const [users, activeOptions, selections] = await Promise.all([
      db
        .select({ interestsCompletedAt: mobileUsers.interestsCompletedAt })
        .from(mobileUsers)
        .where(eq(mobileUsers.id, userId))
        .limit(1),
      db
        .select()
        .from(interestOptions)
        .where(eq(interestOptions.isActive, true))
        .orderBy(asc(interestOptions.sortOrder), asc(interestOptions.name)),
      db
        .select({ interestId: mobileUserInterests.interestId })
        .from(mobileUserInterests)
        .where(eq(mobileUserInterests.mobileUserId, userId)),
    ]);

    const user = users[0];
    if (!user) throw applicationError('not_found', 'User not found', 404);
    const activeIds = new Set(activeOptions.map(option => option.id));

    return {
      options: activeOptions.map(toInterestOption),
      selectedInterestIds: selections
        .map(selection => selection.interestId)
        .filter(id => activeIds.has(id)),
      minSelections: INTEREST_MIN_SELECTIONS,
      needsOnboarding: !user.interestsCompletedAt,
    };
  }

  async updateForUser(userId: string, input: UpdateMyInterestsRequest) {
    const ids = [...new Set(input.interestIds)];
    if (ids.length < INTEREST_MIN_SELECTIONS) {
      throw applicationError(
        'minimum_interests_required',
        `Choose at least ${INTEREST_MIN_SELECTIONS} interests.`,
        400,
      );
    }

    const active = await db
      .select({ id: interestOptions.id })
      .from(interestOptions)
      .where(
        and(
          inArray(interestOptions.id, ids),
          eq(interestOptions.isActive, true),
        ),
      );
    if (active.length !== ids.length) {
      throw applicationError(
        'invalid_interest',
        'One or more selected interests are no longer available.',
        400,
      );
    }

    await db.transaction(async tx => {
      await tx
        .delete(mobileUserInterests)
        .where(eq(mobileUserInterests.mobileUserId, userId));
      await tx.insert(mobileUserInterests).values(
        ids.map(interestId => ({ mobileUserId: userId, interestId })),
      );
      await tx
        .update(mobileUsers)
        .set({ interestsCompletedAt: new Date(), updatedAt: new Date() })
        .where(eq(mobileUsers.id, userId));
    });

    return this.getForUser(userId);
  }

  async listForAdmin() {
    const rows = await db
      .select()
      .from(interestOptions)
      .orderBy(asc(interestOptions.sortOrder), asc(interestOptions.name));
    return rows.map(toInterestOption);
  }

  async createOption(input: InterestOption) {
    const [row] = await db
      .insert(interestOptions)
      .values({
        id: input.id,
        name: input.name,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      })
      .returning();
    return toInterestOption(row!);
  }

  async updateOption(id: string, input: Omit<InterestOption, 'id'>) {
    const [row] = await db
      .update(interestOptions)
      .set({
        name: input.name,
        imageUrl: input.imageUrl ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
        updatedAt: new Date(),
      })
      .where(eq(interestOptions.id, id))
      .returning();
    if (!row) throw applicationError('not_found', 'Interest not found', 404);
    return toInterestOption(row);
  }

  async deleteOption(id: string) {
    let row: { id: string } | undefined;
    try {
      [row] = await db
        .delete(interestOptions)
        .where(eq(interestOptions.id, id))
        .returning({ id: interestOptions.id });
    } catch (error) {
      if ((error as { code?: string }).code === '23503') {
        throw applicationError(
          'interest_in_use',
          'This interest is selected by members. Mark it inactive instead.',
          409,
        );
      }
      throw error;
    }
    if (!row) throw applicationError('not_found', 'Interest not found', 404);
  }
}

export const interestService = new InterestService();
