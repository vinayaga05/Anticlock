import { create } from 'zustand';
import { storage } from '@/shared/services/storage';
import { readStoredSession } from '@/shared/services/auth/authService';
import {
  createActiveProfileStorage,
  type ActiveProfileStorage,
} from './activeProfile';
import type {
  PublisherIdentityLike,
  PublisherProfileType,
} from './publisherSelection';

export type ActiveProfileState = {
  /** Account the loaded choice belongs to (choices are per account). */
  ownerUserId: string | null;
  profileId: string | null;
  profileType: PublisherProfileType | null;
  /** Load the persisted choice for this account (no-op if already loaded). */
  hydrate: (ownerUserId: string) => void;
  /** Switch the app-wide active profile and persist it (survives relaunch). */
  setActive: (
    ownerUserId: string,
    identity: Pick<PublisherIdentityLike, 'id' | 'type' | 'profileType'>,
  ) => void;
};

/** Factory so tests can bind the store to an in-memory key-value store. */
export function createActiveProfileStore(persistence: ActiveProfileStorage) {
  return create<ActiveProfileState>((set, get) => ({
    ownerUserId: null,
    profileId: null,
    profileType: null,
    hydrate: ownerUserId => {
      if (get().ownerUserId === ownerUserId) return;
      const persisted = persistence.load(ownerUserId);
      set({
        ownerUserId,
        profileId: persisted?.profileId ?? null,
        profileType: persisted?.profileType ?? null,
      });
    },
    setActive: (ownerUserId, identity) => {
      const persisted = persistence.save(ownerUserId, identity);
      set({
        ownerUserId,
        profileId: persisted.profileId,
        profileType: persisted.profileType,
      });
    },
  }));
}

export const activeProfileStorage = createActiveProfileStorage(storage);

/** Single source of truth for the global active publishing profile. */
export const useActiveProfileStore = createActiveProfileStore(
  activeProfileStorage,
);

/**
 * Snapshot of the persisted active profile id for the signed-in account,
 * read once by composers when a NEW draft starts. Never subscribe to it in
 * a composer: a later switch must not change an open draft.
 */
export function getActiveProfileIdSnapshot(): string | null {
  const ownerUserId = readStoredSession()?.user.id;
  if (!ownerUserId) return null;
  const state = useActiveProfileStore.getState();
  if (state.ownerUserId === ownerUserId) return state.profileId;
  // Not hydrated yet: read the persisted value without updating the store
  // (this runs during a composer's first render).
  return activeProfileStorage.load(ownerUserId)?.profileId ?? null;
}
