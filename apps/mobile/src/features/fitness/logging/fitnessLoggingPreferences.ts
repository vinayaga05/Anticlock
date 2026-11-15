import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/shared/context/AuthProvider';
import { useFitnessDataEpoch } from '../fitnessSession';

type Preferences = {
  scope: string;
  favouriteFoodIds: string[];
  mediaNoticeSeen: boolean;
};
let preferences: Preferences = {
  scope: '',
  favouriteFoodIds: [],
  mediaNoticeSeen: false,
};
const listeners = new Set<() => void>();
const publish = () => listeners.forEach(listener => listener());
export function resetFitnessLoggingPreferences(scope: string) {
  if (preferences.scope === scope) return;
  preferences = { scope, favouriteFoodIds: [], mediaNoticeSeen: false };
  publish();
}
export function toggleFitnessFavourite(scope: string, id: string) {
  if (preferences.scope !== scope) return;
  preferences = {
    ...preferences,
    favouriteFoodIds: preferences.favouriteFoodIds.includes(id)
      ? preferences.favouriteFoodIds.filter(value => value !== id)
      : [...preferences.favouriteFoodIds, id],
  };
  publish();
}
export function acknowledgeFitnessMediaNotice(scope: string) {
  if (preferences.scope !== scope) return;
  preferences = { ...preferences, mediaNoticeSeen: true };
  publish();
}
export function fitnessLoggingPreferenceSnapshot() {
  return preferences;
}
/** UI-only IDs and a notice acknowledgement in memory; no health journal is persisted on device. */
export function useFitnessLoggingPreferences() {
  const { user } = useAuth();
  const epoch = useFitnessDataEpoch(),
    scope = `${user?.id ?? 'signed-out'}:${epoch}`;
  const snapshot = useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => preferences,
    () => preferences,
  );
  useEffect(() => resetFitnessLoggingPreferences(scope), [scope]);
  return {
    scope,
    favouriteFoodIds: snapshot.scope === scope ? snapshot.favouriteFoodIds : [],
    mediaNoticeSeen: snapshot.scope === scope && snapshot.mediaNoticeSeen,
    toggleFavourite: (id: string) => toggleFitnessFavourite(scope, id),
    acknowledgeMediaNotice: () => acknowledgeFitnessMediaNotice(scope),
  };
}
