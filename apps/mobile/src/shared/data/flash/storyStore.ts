import { create } from 'zustand';
import {
  seedStories,
  seedViewedStoryItems,
  STORY_TRAY_PAGE_SIZE,
} from '@/shared/data/flash/stories';
import { CURRENT_USER } from '@/shared/data/flash/posts';
import type { PostAuthor } from '@/shared/data/flash/types';
import {
  STORY_LIFETIME_MS,
  type StoryArchiveEntry,
  type StoryAudience,
  type StoryItem,
  type StoryTrayEntry,
  type UserStory,
} from '@/shared/data/flash/storyTypes';
import { isApiEnabled } from '@/shared/api/config';

export type StoryViewerProfile = {
  id: string;
  type: 'personal' | 'business';
  name?: string;
  avatarUrl?: string | null;
};

type PublishStoryInput = {
  type: StoryItem['type'];
  mediaUrl?: string | number;
  textContent?: string;
  backgroundColor?: string;
  storyStyle?: StoryItem['storyStyle'];
  locationName?: string;
  durationMs?: number;
  audience?: StoryAudience;
};

type StoryState = {
  viewerProfile: StoryViewerProfile | null;
  setViewerProfile: (profile: StoryViewerProfile | null) => void;
  removeStoryItem: (itemId: string) => void;
  stories: UserStory[];
  viewedByAuthor: Record<string, string[]>;
  archive: StoryArchiveEntry[];
  trayVisibleCount: number;

  setApiStories: (apiStories: UserStory[]) => void;
  getTrayEntries: () => StoryTrayEntry[];
  getAllTrayEntries: () => StoryTrayEntry[];
  hasMoreTrayStories: () => boolean;
  loadMoreTrayStories: () => void;
  getActiveStory: (authorId: string) => UserStory | undefined;
  isItemViewed: (authorId: string, itemId: string) => boolean;
  markItemViewed: (authorId: string, itemId: string) => void;
  markAllViewed: (authorId: string) => void;
  publishStory: (input: PublishStoryInput) => StoryItem;
  pruneExpired: () => void;
};

function isActive(item: StoryItem) {
  return new Date(item.expiresAt).getTime() > Date.now();
}

function activeItems(story: UserStory) {
  return story.items.filter(isActive);
}

function buildTrayEntries(
  stories: UserStory[],
  viewedByAuthor: Record<string, string[]>,
  viewerProfile: StoryViewerProfile | null,
): StoryTrayEntry[] {
  const ownId =
    viewerProfile?.id ?? (!isApiEnabled ? CURRENT_USER.id : undefined);
  const entries: StoryTrayEntry[] = stories
    .map(story => {
      const items = activeItems(story);
      const viewed = viewedByAuthor[story.authorId] ?? [];
      const hasUnread = items.some(item => !viewed.includes(item.id));
      return {
        authorId: story.authorId,
        author: story.author,
        items,
        isOwn:
          story.authorId === ownId &&
          (!viewerProfile ||
            (story.author.profileType ??
              (story.author.isProvider ? 'business' : 'personal')) ===
              viewerProfile.type),
        hasActiveStory: items.length > 0,
        hasUnread,
      };
    })
    .filter(entry => entry.isOwn || entry.hasActiveStory);

  if (viewerProfile && !entries.some(entry => entry.isOwn)) {
    entries.unshift({
      authorId: viewerProfile.id,
      author: {
        id: viewerProfile.id,
        name: viewerProfile.name ?? 'Your story',
        avatarUrl: viewerProfile.avatarUrl ?? '',
        profileType: viewerProfile.type,
        isProvider: viewerProfile.type === 'business',
      },
      items: [],
      isOwn: true,
      hasActiveStory: false,
      hasUnread: false,
    });
  }
  entries.sort((a, b) => {
    if (a.isOwn) return -1;
    if (b.isOwn) return 1;
    if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
    return 0;
  });

  return entries;
}

export const useStoryStore = create<StoryState>((set, get) => ({
  viewerProfile: null,
  setViewerProfile: profile =>
    set(state => {
      if (
        state.viewerProfile?.id === profile?.id &&
        state.viewerProfile?.type === profile?.type &&
        state.viewerProfile?.name === profile?.name &&
        state.viewerProfile?.avatarUrl === profile?.avatarUrl
      )
        return state;
      const identityChanged =
        state.viewerProfile?.id !== profile?.id ||
        state.viewerProfile?.type !== profile?.type;
      return {
        viewerProfile: profile,
        ...(isApiEnabled && identityChanged
          ? {
              stories: [],
              viewedByAuthor: {},
              archive: [],
              trayVisibleCount: STORY_TRAY_PAGE_SIZE,
            }
          : {}),
      };
    }),
  removeStoryItem: itemId =>
    set(state => ({
      stories: state.stories.map(story => ({
        ...story,
        items: story.items.filter(item => item.id !== itemId),
      })),
      archive: state.archive.filter(item => item.id !== itemId),
    })),
  stories: isApiEnabled
    ? []
    : seedStories.map(s => ({ ...s, items: [...s.items] })),
  viewedByAuthor: isApiEnabled ? {} : { ...seedViewedStoryItems },
  archive: [],
  trayVisibleCount: STORY_TRAY_PAGE_SIZE,

  setApiStories: (apiStories: UserStory[]) => {
    if (!isApiEnabled) return;
    // An API snapshot is authoritative. Demo/local items must never appear
    // beside real stories or survive a viewer profile change.
    set({ stories: apiStories.map(story => ({ ...story, source: 'api' })) });
  },

  getTrayEntries: () => {
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const all = buildTrayEntries(stories, viewedByAuthor, get().viewerProfile);
    return all.slice(0, Math.min(trayVisibleCount, all.length));
  },

  getAllTrayEntries: () => {
    const { stories, viewedByAuthor } = get();
    return buildTrayEntries(stories, viewedByAuthor, get().viewerProfile);
  },

  hasMoreTrayStories: () => {
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const all = buildTrayEntries(stories, viewedByAuthor, get().viewerProfile);
    return trayVisibleCount < all.length;
  },

  loadMoreTrayStories: () => {
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const total = buildTrayEntries(
      stories,
      viewedByAuthor,
      get().viewerProfile,
    ).length;
    if (trayVisibleCount >= total) return;
    set({
      trayVisibleCount: Math.min(
        trayVisibleCount + STORY_TRAY_PAGE_SIZE,
        total,
      ),
    });
  },

  getActiveStory: authorId => {
    const story = get().stories.find(s => s.authorId === authorId);
    if (!story) return undefined;
    return { ...story, items: activeItems(story) };
  },

  isItemViewed: (authorId, itemId) =>
    (get().viewedByAuthor[authorId] ?? []).includes(itemId),

  markItemViewed: (authorId, itemId) => {
    set(state => {
      const prev = state.viewedByAuthor[authorId] ?? [];
      if (prev.includes(itemId)) return state;
      return {
        viewedByAuthor: {
          ...state.viewedByAuthor,
          [authorId]: [...prev, itemId],
        },
      };
    });
  },

  markAllViewed: authorId => {
    const story = get().getActiveStory(authorId);
    if (!story) return;
    set(state => ({
      viewedByAuthor: {
        ...state.viewedByAuthor,
        [authorId]: story.items.map(i => i.id),
      },
    }));
  },

  publishStory: input => {
    const createdAt = new Date().toISOString();
    const item: StoryItem = {
      id: `story-${Date.now()}`,
      type: input.type,
      mediaUrl: input.mediaUrl,
      textContent: input.textContent,
      storyStyle: input.storyStyle,
      locationName: input.locationName,
      viewerCanManage: true,
      backgroundColor: input.backgroundColor ?? '#0F766E',
      createdAt,
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS).toISOString(),
      durationMs:
        input.type === 'video' &&
        Number.isFinite(input.durationMs) &&
        (input.durationMs ?? 0) > 0
          ? input.durationMs
          : 5000,
    };

    set(state => {
      const meId = state.viewerProfile?.id ?? CURRENT_USER.id;
      const idx = state.stories.findIndex(s => s.authorId === meId);
      if (idx < 0) {
        const profile = state.viewerProfile;
        return {
          stories: [
            {
              authorId: meId,
              author: profile
                ? {
                    id: meId,
                    name: profile.name ?? 'Your story',
                    avatarUrl: profile.avatarUrl ?? '',
                    profileType: profile.type,
                    isProvider: profile.type === 'business',
                  }
                : CURRENT_USER,
              items: [item],
              audience: input.audience ?? 'public',
              source: 'local',
            },
            ...state.stories,
          ],
        };
      }

      const next = [...state.stories];
      const current = next[idx];
      next[idx] = {
        ...current,
        audience: input.audience ?? current.audience,
        items: [...current.items.filter(isActive), item],
      };
      return { stories: next };
    });

    return item;
  },

  pruneExpired: () => {
    set(state => {
      const archiveAdds: StoryArchiveEntry[] = [];
      const stories = state.stories.map(story => {
        const kept: StoryItem[] = [];
        for (const item of story.items) {
          if (isActive(item)) {
            kept.push(item);
          } else if (
            story.source !== 'api' &&
            story.authorId === (state.viewerProfile?.id ?? CURRENT_USER.id)
          ) {
            // A private archive may only contain this creator's own local
            // stories; viewing a remote story must not save someone else's media.
            archiveAdds.push({
              ...item,
              authorId: story.authorId,
              archivedAt: new Date().toISOString(),
            });
          }
        }
        return { ...story, items: kept };
      });

      if (
        !archiveAdds.length &&
        stories.every(
          (story, index) =>
            story.items.length === state.stories[index]?.items.length,
        )
      )
        return state;
      return {
        stories,
        archive: [...archiveAdds, ...state.archive],
      };
    });
  },
}));

export function getStoryAuthorName(author: PostAuthor) {
  return author.name.split(' ')[0] ?? author.name;
}
