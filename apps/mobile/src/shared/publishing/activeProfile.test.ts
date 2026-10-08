import {
  createActiveProfileStorage,
  personalIdentity,
  resolveActiveProfile,
} from './activeProfile';
import type { KeyValueStore } from './publisherSelection';

const mockKvData = new Map<string, string>();
jest.mock('@/shared/services/storage', () => ({
  storage: {
    getString: (key: string) => mockKvData.get(key),
    set: (key: string, value: string) => {
      mockKvData.set(key, value);
    },
    remove: (key: string) => mockKvData.delete(key),
  },
}));
jest.mock('@/shared/services/auth/authService', () => ({
  readStoredSession: () => mockSession,
}));
let mockSession: { user: { id: string } } | null = null;

import {
  createActiveProfileStore,
  getActiveProfileIdSnapshot,
  useActiveProfileStore,
} from './activeProfileStore';

/** In-memory MMKV stand-in; reusing `data` simulates an app relaunch. */
function memoryKv(data = new Map<string, string>()): KeyValueStore & {
  data: Map<string, string>;
} {
  return {
    data,
    getString: key => data.get(key),
    set: (key, value) => {
      data.set(key, value);
    },
    remove: key => data.delete(key),
  };
}

const OWNER = '11111111-1111-4111-8111-111111111111';
const personal = { type: 'user' as const, id: OWNER, name: 'Arjun', avatarUrl: null };
const lotus = {
  type: 'provider' as const,
  id: 'b1',
  name: 'Lotus Yoga',
  avatarUrl: 'https://img/lotus.jpg',
  profileType: 'business' as const,
};
const fade = { ...lotus, id: 'b2', name: 'Urban Fade' };

describe('active profile storage', () => {
  it('persists and restores the active profile across a relaunch', () => {
    const data = new Map<string, string>();
    createActiveProfileStorage(memoryKv(data)).save(OWNER, lotus);

    const relaunched = createActiveProfileStorage(memoryKv(data));
    expect(relaunched.load(OWNER)).toEqual(
      expect.objectContaining({
        ownerUserId: OWNER,
        profileId: 'b1',
        profileType: 'business',
      }),
    );
  });

  it('keeps choices per account and ignores corrupt values', () => {
    const kv = memoryKv();
    const storage = createActiveProfileStorage(kv);
    storage.save(OWNER, lotus);
    expect(storage.load('someone-else')).toBeNull();

    kv.set(`publishing.activeProfile.${OWNER}`, '{not json');
    expect(storage.load(OWNER)).toBeNull();
    kv.set(
      `publishing.activeProfile.${OWNER}`,
      JSON.stringify({ ownerUserId: OWNER, profileId: 'b1', profileType: 'admin' }),
    );
    expect(storage.load(OWNER)).toBeNull();
  });

  it('clears the persisted choice', () => {
    const storage = createActiveProfileStorage(memoryKv());
    storage.save(OWNER, lotus);
    storage.clear(OWNER);
    expect(storage.load(OWNER)).toBeNull();
  });
});

describe('resolveActiveProfile', () => {
  it('uses the persisted profile while it is still owned', () => {
    expect(resolveActiveProfile([personal, lotus, fade], 'b2')).toEqual({
      active: fade,
      fallbackApplied: false,
    });
  });

  it('falls back to the personal profile when the persisted one is gone', () => {
    // Business listed first on purpose: fallback is personal, not "first".
    expect(resolveActiveProfile([lotus, personal], 'deleted-business')).toEqual({
      active: personal,
      fallbackApplied: true,
    });
  });

  it('defaults to personal without a persisted choice and waits for identities', () => {
    expect(resolveActiveProfile([lotus, personal], null)).toEqual({
      active: personal,
      fallbackApplied: false,
    });
    expect(resolveActiveProfile([], 'b1')).toEqual({
      active: null,
      fallbackApplied: false,
    });
    expect(personalIdentity([lotus])).toBe(lotus);
  });
});

describe('active profile store (global single source of truth)', () => {
  it('hydrates from storage, switches, and survives a relaunch', () => {
    const data = new Map<string, string>();
    const first = createActiveProfileStore(createActiveProfileStorage(memoryKv(data)));
    first.getState().hydrate(OWNER);
    expect(first.getState().profileId).toBeNull();

    const listener = jest.fn();
    first.subscribe(listener);
    first.getState().setActive(OWNER, lotus);
    expect(first.getState()).toEqual(
      expect.objectContaining({ ownerUserId: OWNER, profileId: 'b1', profileType: 'business' }),
    );
    expect(listener).toHaveBeenCalled();

    // "Relaunch": a brand-new store over the same persisted data.
    const second = createActiveProfileStore(createActiveProfileStorage(memoryKv(data)));
    second.getState().hydrate(OWNER);
    expect(second.getState().profileId).toBe('b1');
    expect(resolveActiveProfile([personal, lotus], second.getState().profileId).active).toBe(lotus);
  });

  it('getActiveProfileIdSnapshot reads the signed-in account choice (MMKV-bound store)', () => {
    mockKvData.set(
      `publishing.activeProfile.${OWNER}`,
      JSON.stringify({ ownerUserId: OWNER, profileId: 'b2', profileType: 'business', selectedAt: 'x' }),
    );
    mockSession = { user: { id: OWNER } };
    // Not hydrated yet: read straight from storage without touching the store.
    expect(getActiveProfileIdSnapshot()).toBe('b2');
    expect(useActiveProfileStore.getState().ownerUserId).toBeNull();

    useActiveProfileStore.getState().setActive(OWNER, lotus);
    expect(getActiveProfileIdSnapshot()).toBe('b1');
    expect(JSON.parse(mockKvData.get(`publishing.activeProfile.${OWNER}`)!).profileId).toBe('b1');

    mockSession = null;
    expect(getActiveProfileIdSnapshot()).toBeNull();
  });
});
