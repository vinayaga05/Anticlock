import {
  canReuseDraft,
  createPublisherSelectionStore,
  identityProfileType,
  postingAsLabel,
  resolveActivePublisher,
  type KeyValueStore,
} from './publisherSelection';

/** In-memory stand-in for MMKV; reusing `data` simulates an app relaunch. */
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

const personal = {
  type: 'user' as const,
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Asha',
  avatarUrl: null,
};
const business = {
  type: 'provider' as const,
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Lotus Yoga',
  avatarUrl: 'https://cdn.example/logo.png',
  profileType: 'business' as const,
};

describe('resolveActivePublisher', () => {
  it('auto-selects the only profile without a switcher', () => {
    expect(resolveActivePublisher([personal], null)).toEqual({
      active: personal,
      needsSwitcher: false,
      fallbackApplied: false,
    });
  });

  it('keeps the chosen business profile when several are owned', () => {
    const result = resolveActivePublisher([personal, business], business.id);
    expect(result.active).toBe(business);
    expect(result.needsSwitcher).toBe(true);
    expect(result.fallbackApplied).toBe(false);
  });

  it('flags a fallback when the persisted profile is no longer owned', () => {
    const result = resolveActivePublisher([personal], business.id);
    expect(result.active).toBe(personal);
    expect(result.fallbackApplied).toBe(true);
  });

  it('returns nothing while identities are loading', () => {
    expect(resolveActivePublisher([], business.id).active).toBeNull();
  });
});

describe('identity helpers', () => {
  it('derives the profile type from legacy identity types', () => {
    expect(identityProfileType(personal)).toBe('personal');
    expect(identityProfileType({ type: 'provider' })).toBe('business');
  });

  it('labels the composer with the selected profile name', () => {
    expect(postingAsLabel(business)).toBe('Posting as Lotus Yoga');
    expect(postingAsLabel(null)).toBe('Loading profile…');
  });
});

describe('persisted publisher selection + draft (scenario 9)', () => {
  it('survives an app relaunch and is not reset to the personal profile', () => {
    const kv = memoryKv();
    const before = createPublisherSelectionStore(kv);
    before.saveSelection('clip', business);
    before.saveDraft({
      format: 'clip',
      draftId: 'draft-1',
      publisherProfileId: business.id,
      publisherProfileType: 'business',
      visibility: 'public',
    });

    // "Relaunch": a brand-new store over the same persisted storage.
    const after = createPublisherSelectionStore(memoryKv(kv.data));
    const selection = after.loadSelection('clip');
    expect(selection?.publisherProfileId).toBe(business.id);
    expect(selection?.publisherProfileType).toBe('business');
    expect(
      resolveActivePublisher([personal, business], selection?.publisherProfileId)
        .active,
    ).toBe(business);

    const draft = after.loadDraft('clip');
    expect(draft?.draftId).toBe('draft-1');
    expect(draft?.publisherProfileId).toBe(business.id);
  });

  it('keeps selections independent per content format', () => {
    const store = createPublisherSelectionStore(memoryKv());
    store.saveSelection('story', business);
    store.saveSelection('flash', personal);
    expect(store.loadSelection('story')?.publisherProfileId).toBe(business.id);
    expect(store.loadSelection('flash')?.publisherProfileId).toBe(personal.id);
    expect(store.loadSelection('clip')).toBeNull();
  });

  it('clears the draft after publish and ignores corrupt data', () => {
    const kv = memoryKv();
    const store = createPublisherSelectionStore(kv);
    store.saveDraft({
      format: 'flash',
      draftId: 'draft-2',
      publisherProfileId: personal.id,
      publisherProfileType: 'personal',
      visibility: 'public',
    });
    store.clearDraft('flash');
    expect(store.loadDraft('flash')).toBeNull();

    kv.set('publishing.selection.clip', '{not json');
    kv.set('publishing.draft.story', JSON.stringify({ format: 'clip' }));
    expect(store.loadSelection('clip')).toBeNull();
    expect(store.loadDraft('story')).toBeNull();
  });

  it('reuses a draft only for the same publisher and visibility', () => {
    const store = createPublisherSelectionStore(memoryKv());
    const draft = store.saveDraft({
      format: 'clip',
      draftId: 'draft-3',
      publisherProfileId: business.id,
      publisherProfileType: 'business',
      visibility: 'public',
    });
    expect(canReuseDraft(draft, business, 'public')).toBe(true);
    expect(canReuseDraft(draft, personal, 'public')).toBe(false);
    expect(canReuseDraft(draft, business, 'followers')).toBe(false);
    expect(canReuseDraft(null, business, 'public')).toBe(false);
  });
});
