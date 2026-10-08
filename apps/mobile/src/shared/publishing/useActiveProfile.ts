import { useCallback, useEffect, useMemo } from 'react';
import {
  usePublishingIdentitiesQuery,
  type PublishingIdentity,
} from '@/shared/api/publishingHooks';
import { readStoredSession } from '@/shared/services/auth/authService';
import { resolveActiveProfile } from './activeProfile';
import {
  activeProfileStorage,
  useActiveProfileStore,
} from './activeProfileStore';

const EMPTY: PublishingIdentity[] = [];

/**
 * App-wide active profile: the owned identities (personal first, then
 * businesses) resolved against the persisted global choice.
 *
 * - switching (`setActive`) updates every subscriber immediately and is
 *   persisted per account in MMKV
 * - a persisted profile that is no longer owned/active falls back to the
 *   personal profile, and the persisted value is repaired once the
 *   identities list has loaded successfully
 */
export function useActiveProfile() {
  const ownerUserId = readStoredSession()?.user.id ?? null;
  const query = usePublishingIdentitiesQuery();
  const identities = query.data ?? EMPTY;
  const hydrate = useActiveProfileStore(s => s.hydrate);
  const storeOwner = useActiveProfileStore(s => s.ownerUserId);
  const storedProfileId = useActiveProfileStore(s => s.profileId);
  const storeSetActive = useActiveProfileStore(s => s.setActive);

  const hydrated = Boolean(ownerUserId) && storeOwner === ownerUserId;
  useEffect(() => {
    if (ownerUserId && !hydrated) hydrate(ownerUserId);
  }, [ownerUserId, hydrated, hydrate]);
  // Before hydration, read MMKV synchronously so the first render already
  // shows the persisted choice (no flash of the personal profile).
  const persistedId = hydrated
    ? storedProfileId
    : ownerUserId
      ? activeProfileStorage.load(ownerUserId)?.profileId ?? null
      : null;

  const resolved = useMemo(
    () => resolveActiveProfile(identities, persistedId),
    [identities, persistedId],
  );

  const setActive = useCallback(
    (identity: PublishingIdentity) => {
      if (!ownerUserId) return;
      storeSetActive(ownerUserId, identity);
    },
    [ownerUserId, storeSetActive],
  );

  const shouldRepair =
    query.isSuccess && resolved.fallbackApplied && resolved.active !== null;
  useEffect(() => {
    if (shouldRepair && resolved.active) setActive(resolved.active);
  }, [shouldRepair, resolved.active, setActive]);

  return {
    identities,
    active: resolved.active,
    fallbackApplied: resolved.fallbackApplied,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    setActive,
  };
}
