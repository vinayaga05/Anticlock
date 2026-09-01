import { eq } from 'drizzle-orm';
import type { MobileRole } from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mobileUserRoles, providers } from '../db/schema.js';

export async function getMobileUserContext(mobileUserId: string) {
  const roleRows = await db
    .select()
    .from(mobileUserRoles)
    .where(eq(mobileUserRoles.mobileUserId, mobileUserId));
  const roles = roleRows.map(r => r.roleId as MobileRole);

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.mobileUserId, mobileUserId))
    .limit(1);

  return {
    roles,
    providerId: provider?.id ?? null,
  };
}
