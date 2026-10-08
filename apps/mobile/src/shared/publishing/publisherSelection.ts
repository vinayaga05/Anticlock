/**
 * Pure publisher-profile selection + draft persistence.
 *
 * A Reel/Clip, Flash post or Story is always published AS one profile the
 * signed-in owner controls: their personal profile or a business profile
 * they manage. New drafts start from the global active profile
 * (`activeProfile.ts`); a draft keeps its own profile through the
 * draft → upload → editor → retry → publish flow and is never silently
 * reset. `saveSelection`/`loadSelection` remain for older persisted data.
 *
 * This module has no React Native dependencies so it can be unit tested;
 * `publisherSelectionStorage.ts` binds it to MMKV.
 */

export type PublishFormat = 'clip' | 'flash' | 'story';
export type PublisherProfileType = 'personal' | 'business';

export type PublisherIdentityLike = {
  type: 'user' | 'provider';
  id: string;
  name: string;
  avatarUrl: string | null;
  profileType?: PublisherProfileType;
};

export type KeyValueStore = {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void | boolean;
};

export type PersistedPublisherSelection = {
  publisherProfileId: string;
  publisherProfileType: PublisherProfileType;
  selectedAt: string;
};

/** Server draft created for an in-progress publish (reused on retry). */
export type PersistedPublishDraft = {
  format: PublishFormat;
  draftId: string;
  publisherProfileId: string;
  publisherProfileType: PublisherProfileType;
  visibility: string;
  updatedAt: string;
};

export function identityProfileType(
  identity: Pick<PublisherIdentityLike, 'type' | 'profileType'>,
): PublisherProfileType {
  if (identity.profileType) return identity.profileType;
  return identity.type === 'provider' ? 'business' : 'personal';
}

export type ActivePublisher<T extends PublisherIdentityLike> = {
  /** Profile the content will be published as (null while loading). */
  active: T | null;
  /** More than one profile → the composer must show a switcher. */
  needsSwitcher: boolean;
  /**
   * The persisted choice is no longer available (e.g. membership removed),
   * so the first profile was used. The composer keeps showing "Posting as"
   * so the creator sees the change before publishing.
   */
  fallbackApplied: boolean;
};

/**
 * One profile → auto-selected. Multiple → the selected one wins when it is
 * still owned; otherwise the personal profile (or the first one).
 */
export function resolveActivePublisher<T extends PublisherIdentityLike>(
  identities: readonly T[],
  preferredId: string | null | undefined,
): ActivePublisher<T> {
  if (identities.length === 0) {
    return { active: null, needsSwitcher: false, fallbackApplied: false };
  }
  const preferred = preferredId
    ? identities.find(identity => identity.id === preferredId)
    : undefined;
  const personal = identities.find(
    identity => identityProfileType(identity) === 'personal',
  );
  return {
    active: preferred ?? personal ?? identities[0]!,
    needsSwitcher: identities.length > 1,
    fallbackApplied: Boolean(preferredId) && !preferred,
  };
}

function parseJson<T>(raw: string | undefined, guard: (value: any) => boolean) {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return guard(value) ? (value as T) : null;
  } catch {
    return null;
  }
}

const isProfileType = (value: unknown) =>
  value === 'personal' || value === 'business';

export function createPublisherSelectionStore(
  kv: KeyValueStore,
  prefix = 'publishing',
) {
  const selectionKey = (format: PublishFormat) =>
    `${prefix}.selection.${format}`;
  const draftKey = (format: PublishFormat) => `${prefix}.draft.${format}`;

  return {
    loadSelection(format: PublishFormat): PersistedPublisherSelection | null {
      return parseJson<PersistedPublisherSelection>(
        kv.getString(selectionKey(format)),
        value =>
          typeof value?.publisherProfileId === 'string' &&
          isProfileType(value?.publisherProfileType),
      );
    },
    saveSelection(format: PublishFormat, identity: PublisherIdentityLike) {
      const selection: PersistedPublisherSelection = {
        publisherProfileId: identity.id,
        publisherProfileType: identityProfileType(identity),
        selectedAt: new Date().toISOString(),
      };
      kv.set(selectionKey(format), JSON.stringify(selection));
      return selection;
    },
    loadDraft(format: PublishFormat): PersistedPublishDraft | null {
      return parseJson<PersistedPublishDraft>(
        kv.getString(draftKey(format)),
        value =>
          value?.format === format &&
          typeof value?.draftId === 'string' &&
          typeof value?.publisherProfileId === 'string' &&
          isProfileType(value?.publisherProfileType),
      );
    },
    saveDraft(draft: Omit<PersistedPublishDraft, 'updatedAt'>) {
      const persisted: PersistedPublishDraft = {
        ...draft,
        updatedAt: new Date().toISOString(),
      };
      kv.set(draftKey(draft.format), JSON.stringify(persisted));
      return persisted;
    },
    /**
     * Clears the persisted draft for a format. With a draft id, only that
     * draft is cleared, so finishing or cancelling an older upload can never
     * drop a newer draft the creator started since.
     */
    clearDraft(format: PublishFormat, draftId?: string) {
      if (draftId) {
        const current = parseJson<PersistedPublishDraft>(
          kv.getString(draftKey(format)),
          value => typeof value?.draftId === 'string',
        );
        if (current && current.draftId !== draftId) return;
      }
      kv.remove(draftKey(format));
    },
  };
}

export type PublisherSelectionStore = ReturnType<
  typeof createPublisherSelectionStore
>;

/**
 * A persisted server draft can be reused only for the same publisher and
 * visibility; otherwise a fresh draft is created (publisher is immutable).
 */
export function canReuseDraft(
  draft: PersistedPublishDraft | null,
  identity: PublisherIdentityLike,
  visibility: string,
): boolean {
  return Boolean(
    draft &&
      draft.publisherProfileId === identity.id &&
      draft.publisherProfileType === identityProfileType(identity) &&
      draft.visibility === visibility,
  );
}

/** Composer label: "Posting as [profile name]". */
export function postingAsLabel(
  identity: Pick<PublisherIdentityLike, 'name'> | null | undefined,
) {
  return identity ? `Posting as ${identity.name}` : 'Loading profile…';
}
