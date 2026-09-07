import { and, eq } from 'drizzle-orm';
import type { ProviderMembershipRole } from '@anticlock/contracts';
import { db } from '../db/client.js';
import { mobileUsers, providerMemberships, providers } from '../db/schema.js';
import type { AuthClaims } from '../lib/auth.js';

export type PublishingContext = {
  type: 'user' | 'provider';
  id: string;
  name: string;
  avatarUrl: string | null;
  role?: ProviderMembershipRole;
};

const publishingRoles = new Set<ProviderMembershipRole>([
  'owner',
  'admin',
  'content_creator',
]);

export async function resolvePublishingContext(
  auth: AuthClaims,
  headers: { type?: string; id?: string },
): Promise<PublishingContext> {
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }

  const type = headers.type ?? 'user';
  const id = headers.id ?? auth.sub;
  if (type === 'user') {
    if (id !== auth.sub) {
      throw Object.assign(new Error('You can only publish as yourself'), {
        code: 'forbidden',
        status: 403,
      });
    }
    const [user] = await db
      .select()
      .from(mobileUsers)
      .where(eq(mobileUsers.id, auth.sub))
      .limit(1);
    if (!user) throw Object.assign(new Error('User not found'), { code: 'not_found', status: 404 });
    return { type: 'user', id: user.id, name: user.displayName, avatarUrl: user.avatarUrl };
  }

  if (type !== 'provider' || !headers.id) {
    throw Object.assign(new Error('Invalid publishing context'), {
      code: 'validation_error',
      status: 400,
    });
  }

  const [membership] = await db
    .select({ role: providerMemberships.role, provider: providers })
    .from(providerMemberships)
    .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
    .where(
      and(
        eq(providerMemberships.mobileUserId, auth.sub),
        eq(providerMemberships.providerId, headers.id),
        eq(providers.status, 'active'),
      ),
    )
    .limit(1);
  const role = membership?.role as ProviderMembershipRole | undefined;
  if (!membership || !role || !publishingRoles.has(role)) {
    throw Object.assign(new Error('You do not have permission to publish for this business'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return {
    type: 'provider',
    id: membership.provider.id,
    name: membership.provider.name,
    avatarUrl: null,
    role,
  };
}

export async function listPublishingIdentities(auth: AuthClaims) {
  const personal = await resolvePublishingContext(auth, { type: 'user', id: auth.sub });
  const memberships = await db
    .select({ role: providerMemberships.role, provider: providers })
    .from(providerMemberships)
    .innerJoin(providers, eq(providerMemberships.providerId, providers.id))
    .where(and(eq(providerMemberships.mobileUserId, auth.sub), eq(providers.status, 'active')));
  return [
    personal,
    ...memberships
      .filter(membership => publishingRoles.has(membership.role as ProviderMembershipRole))
      .map(membership => ({
        type: 'provider' as const,
        id: membership.provider.id,
        name: membership.provider.name,
        avatarUrl: null,
        role: membership.role as ProviderMembershipRole,
      })),
  ];
}
