/**
 * Global active publishing profile (pure logic, no React Native imports).
 *
 * One account owns one personal profile plus any number of business
 * profiles. The *active* profile is the single app-wide answer to "who am I
 * acting as right now": Settings switches it, new Clip/Flash/Story drafts
 * start from it, and the header/profile entry points show it.
 *
 * It is persisted per owner account (MMKV in the app, see
 * `activeProfileStore.ts`) so it survives a relaunch and never leaks across
 * accounts on a shared device. When the persisted profile is no longer owned
 * or active (membership removed, business deactivated) resolution falls
 * back to the personal profile.
 */
import {
  identityProfileType,
  type KeyValueStore,
  type PublisherIdentityLike,
  type PublisherProfileType,
} from './publisherSelection';

export type PersistedActiveProfile = {
  ownerUserId: string;
  profileId: string;
  profileType: PublisherProfileType;
  selectedAt: string;
};

export const ACTIVE_PROFILE_KEY_PREFIX = 'publishing.activeProfile';

const isProfileType = (value: unknown): value is PublisherProfileType =>
  value === 'personal' || value === 'business';

export function createActiveProfileStorage(
  kv: KeyValueStore,
  prefix = ACTIVE_PROFILE_KEY_PREFIX,
) {
  const keyFor = (ownerUserId: string) => `${prefix}.${ownerUserId}`;
  return {
    load(ownerUserId: string): PersistedActiveProfile | null {
      const raw = kv.getString(keyFor(ownerUserId));
      if (!raw) return null;
      try {
        const value = JSON.parse(raw);
        if (
          value?.ownerUserId === ownerUserId &&
          typeof value?.profileId === 'string' &&
          value.profileId.length > 0 &&
          isProfileType(value?.profileType)
        ) {
          return value as PersistedActiveProfile;
        }
      } catch {
        // Corrupt value: treat as unset (falls back to personal).
      }
      return null;
    },
    save(
      ownerUserId: string,
      identity: Pick<PublisherIdentityLike, 'id' | 'type' | 'profileType'>,
    ): PersistedActiveProfile {
      const persisted: PersistedActiveProfile = {
        ownerUserId,
        profileId: identity.id,
        profileType: identityProfileType(identity),
        selectedAt: new Date().toISOString(),
      };
      kv.set(keyFor(ownerUserId), JSON.stringify(persisted));
      return persisted;
    },
    clear(ownerUserId: string) {
      kv.remove(keyFor(ownerUserId));
    },
  };
}

export type ActiveProfileStorage = ReturnType<typeof createActiveProfileStorage>;

/** The account's personal profile (always present for a signed-in owner). */
export function personalIdentity<T extends PublisherIdentityLike>(
  identities: readonly T[],
): T | null {
  return (
    identities.find(identity => identityProfileType(identity) === 'personal') ??
    identities[0] ??
    null
  );
}

export type ResolvedActiveProfile<T extends PublisherIdentityLike> = {
  /** Active profile (null only while identities are still loading). */
  active: T | null;
  /**
   * The persisted profile is no longer owned/active, so the personal
   * profile is used instead (the caller repairs the persisted value).
   */
  fallbackApplied: boolean;
};

export function resolveActiveProfile<T extends PublisherIdentityLike>(
  identities: readonly T[],
  persistedProfileId: string | null | undefined,
): ResolvedActiveProfile<T> {
  if (identities.length === 0) return { active: null, fallbackApplied: false };
  const persisted = persistedProfileId
    ? identities.find(identity => identity.id === persistedProfileId)
    : undefined;
  if (persisted) return { active: persisted, fallbackApplied: false };
  return {
    active: personalIdentity(identities),
    fallbackApplied: Boolean(persistedProfileId),
  };
}
