import { useCallback, useMemo, useState } from 'react';
import {
  usePublishingIdentitiesQuery,
  type PublishingIdentity,
} from '@/shared/api/publishingHooks';
import {
  resolveActivePublisher,
  type PublishFormat,
} from './publisherSelection';
import { publisherSelectionStore } from './publisherSelectionStorage';

/**
 * Profile selection shared by the Reel, Flash and Story composers.
 *
 * - one owned profile → auto-selected
 * - several → the composer shows a switcher; the choice is persisted per
 *   format (MMKV) so it survives the editor, retries and an app relaunch
 * - `initialProfileId` lets a restored local draft re-assert its profile
 *   without racing the identities query (it is never overridden by the
 *   first/personal profile once set).
 */
export function usePublisherSelection(
  format: PublishFormat,
  initialProfileId?: string | null,
) {
  const query = usePublishingIdentitiesQuery();
  const identities = useMemo(() => query.data ?? [], [query.data]);
  const [selectedId, setSelectedId] = useState<string | null>(
    () =>
      initialProfileId ??
      publisherSelectionStore.loadSelection(format)?.publisherProfileId ??
      null,
  );

  const resolved = resolveActivePublisher(identities, selectedId);

  const select = useCallback(
    (identityOrId: PublishingIdentity | string) => {
      const identity =
        typeof identityOrId === 'string'
          ? identities.find(item => item.id === identityOrId)
          : identityOrId;
      if (!identity) return;
      setSelectedId(identity.id);
      publisherSelectionStore.saveSelection(format, identity);
    },
    [format, identities],
  );

  /** Re-apply a profile restored from a saved draft. */
  const restore = useCallback((profileId: string | null | undefined) => {
    if (profileId) setSelectedId(profileId);
  }, []);

  return {
    identities,
    identity: resolved.active,
    selectedId: resolved.active?.id ?? selectedId,
    needsSwitcher: resolved.needsSwitcher,
    fallbackApplied: resolved.fallbackApplied,
    isLoading: query.isLoading,
    select,
    restore,
  };
}
