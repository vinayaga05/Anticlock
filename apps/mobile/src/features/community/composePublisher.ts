import {
  identityProfileType,
  type PublisherIdentityLike,
  type PublisherProfileType,
} from '@/shared/publishing/publisherSelection';

export type ComposePublisherRef = { id: string; type?: PublisherProfileType };

/** An explicitly chosen business must never fall back to the personal profile. */
export function resolveComposePublisher<T extends PublisherIdentityLike & { role?: string }>(
  identities: readonly T[],
  active: T | null,
  selected: ComposePublisherRef | null,
): T | null {
  const target = selected ?? (active ? { id: active.id, type: identityProfileType(active) } : null);
  if (!target) return null;
  const identity = identities.find(item => item.id === target.id && (
    !target.type || identityProfileType(item) === target.type
  ));
  return identity && identity.role !== 'analyst' ? identity : null;
}
