import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  usePublishingIdentitiesQuery,
  type PublishingIdentity,
} from '@/shared/api/publishingHooks';
import {
  resolveActivePublisher,
  type PublishFormat,
} from './publisherSelection';
import { getActiveProfileIdSnapshot } from './activeProfileStore';

/**
 * Profile selection shared by the Reel, Flash and Story composers.
 *
 * - a NEW draft starts from the global active profile (Settings switcher),
 *   read once when the composer mounts
 * - `initialProfileId` / `restore()` let a recovered draft keep the profile
 *   it was saved with, even if the global active profile changed since
 * - the creator may change the profile before publishing (`select`); that
 *   choice belongs to this draft only and does not move the global profile
 * - once resolved, the selection is locked in: a later global switch, an
 *   upload, a retry or draft recovery never silently changes it
 * - one owned profile → auto-selected; a profile that is no longer owned
 *   falls back to the personal profile and `fallbackApplied` is reported
 */
export function usePublisherSelection(
  format: PublishFormat,
  initialProfileId?: string | null,
) {
  const query = usePublishingIdentitiesQuery();
  const identities = useMemo(() => query.data ?? [], [query.data]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () => initialProfileId ?? getActiveProfileIdSnapshot(),
  );

  const resolved = resolveActivePublisher(identities, selectedId);
  const resolvedId = resolved.active?.id ?? null;

  // Lock in the first resolved profile so it can never drift afterwards.
  useEffect(() => {
    if (selectedId === null && resolvedId !== null) setSelectedId(resolvedId);
  }, [selectedId, resolvedId]);

  const select = useCallback(
    (identityOrId: PublishingIdentity | string) => {
      const identity =
        typeof identityOrId === 'string'
          ? identities.find(item => item.id === identityOrId)
          : identityOrId;
      if (!identity) return;
      setSelectedId(identity.id);
    },
    [identities],
  );

  /** Re-apply the profile a recovered draft was saved with. */
  const restore = useCallback((profileId: string | null | undefined) => {
    if (profileId) setSelectedId(profileId);
  }, []);

  return {
    format,
    identities,
    identity: resolved.active,
    selectedId: resolvedId ?? selectedId,
    needsSwitcher: resolved.needsSwitcher,
    fallbackApplied: resolved.fallbackApplied,
    isLoading: query.isLoading,
    select,
    restore,
  };
}
