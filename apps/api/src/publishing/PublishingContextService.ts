import type { ProviderMembershipRole } from '@anticlock/contracts';
import type { ContentPublisher, PublisherProfileType } from '@anticlock/contracts';
import type { AuthClaims } from '../lib/auth.js';
import {
  listOwnedPublishers,
  resolveOwnedPublisher,
  type OwnedPublisher,
} from './publisher.js';

/**
 * Legacy publishing identity (`type: user | provider`) plus the canonical
 * publisher card. Kept for clients that still send the
 * `X-Knock-Context-*` headers; all checks go through `publisher.ts`.
 */
export type PublishingContext = {
  type: 'user' | 'provider';
  id: string;
  name: string;
  avatarUrl: string | null;
  role?: ProviderMembershipRole;
  profileType: PublisherProfileType;
  publisher: ContentPublisher;
};

function requireMobile(auth: AuthClaims) {
  if (auth.kind !== 'mobile') {
    throw Object.assign(new Error('Mobile session required'), {
      code: 'forbidden',
      status: 403,
    });
  }
  return auth.sub;
}

export function toPublishingContext(owned: OwnedPublisher): PublishingContext {
  return {
    type: owned.ref.type === 'business' ? 'provider' : 'user',
    id: owned.ref.id,
    name: owned.publisher.displayName,
    avatarUrl: owned.publisher.avatarUrl,
    ...(owned.role ? { role: owned.role } : {}),
    profileType: owned.ref.type,
    publisher: owned.publisher,
  };
}

export async function resolvePublishingContext(
  auth: AuthClaims,
  headers: { type?: string; id?: string },
): Promise<PublishingContext> {
  const ownerUserId = requireMobile(auth);
  if (headers.type && !['user', 'provider', 'personal', 'business'].includes(headers.type)) {
    throw Object.assign(new Error('Invalid publishing context'), {
      code: 'validation_error',
      status: 400,
    });
  }
  const isBusiness = headers.type === 'provider' || headers.type === 'business';
  if (isBusiness && !headers.id) {
    throw Object.assign(new Error('Invalid publishing context'), {
      code: 'validation_error',
      status: 400,
    });
  }
  return toPublishingContext(
    await resolveOwnedPublisher(ownerUserId, {
      id: headers.id ?? ownerUserId,
      type: headers.type ?? 'personal',
    }),
  );
}

export async function listPublishingIdentities(auth: AuthClaims) {
  const ownerUserId = requireMobile(auth);
  return (await listOwnedPublishers(ownerUserId)).map(toPublishingContext);
}
