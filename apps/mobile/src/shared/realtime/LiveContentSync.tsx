import { useActiveProfile } from '@/shared/publishing/useActiveProfile';
import { identityProfileType } from '@/shared/publishing/publisherSelection';
import { useLiveContentSync } from './useLiveContent';

/** Mounted only for a signed-in session; renders nothing. */
export function LiveContentSync() {
  const { active } = useActiveProfile();
  useLiveContentSync(
    true,
    active ? { id: active.id, type: identityProfileType(active) } : undefined,
  );
  return null;
}
