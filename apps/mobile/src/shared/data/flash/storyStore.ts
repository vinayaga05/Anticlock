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

type PublishStoryInput = {
  type: StoryItem['type'];
  mediaUrl?: string | number;
  textContent?: string;
  backgroundColor?: string;
  audience?: StoryAudience;
};

type StoryState = {
  stories: UserStory[];
  viewedByAuthor: Record<string, string[]>;
  archive: StoryArchiveEntry[];
  trayVisibleCount: number;

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
): StoryTrayEntry[] {
  const entries: StoryTrayEntry[] = stories
    .map(story => {
      const items = activeItems(story);
      const viewed = viewedByAuthor[story.authorId] ?? [];
      const hasUnread = items.some(item => !viewed.includes(item.id));
      return {
        authorId: story.authorId,
        author: story.author,
        items,
        isOwn: story.authorId === CURRENT_USER.id,
        hasActiveStory: items.length > 0,
        hasUnread,
      };
    })
    .filter(entry => entry.isOwn || entry.hasActiveStory);

  entries.sort((a, b) => {
    if (a.isOwn) return -1;
    if (b.isOwn) return 1;
    if (a.hasUnread !== b.hasUnread) return a.hasUnread ? -1 : 1;
    return 0;
  });

  return entries;
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: seedStories.map(s => ({ ...s, items: [...s.items] })),
  viewedByAuthor: { ...seedViewedStoryItems },
  archive: [],
  trayVisibleCount: STORY_TRAY_PAGE_SIZE,

  getTrayEntries: () => {
    get().pruneExpired();
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const all = buildTrayEntries(stories, viewedByAuthor);
    return all.slice(0, Math.min(trayVisibleCount, all.length));
  },

  getAllTrayEntries: () => {
    get().pruneExpired();
    const { stories, viewedByAuthor } = get();
    return buildTrayEntries(stories, viewedByAuthor);
  },

  hasMoreTrayStories: () => {
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const all = buildTrayEntries(stories, viewedByAuthor);
    return trayVisibleCount < all.length;
  },

  loadMoreTrayStories: () => {
    const { stories, viewedByAuthor, trayVisibleCount } = get();
    const total = buildTrayEntries(stories, viewedByAuthor).length;
    if (trayVisibleCount >= total) return;
    set({
      trayVisibleCount: Math.min(trayVisibleCount + STORY_TRAY_PAGE_SIZE, total),
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
      backgroundColor: input.backgroundColor ?? '#0F766E',
      createdAt,
      expiresAt: new Date(Date.now() + STORY_LIFETIME_MS).toISOString(),
      durationMs: 5000,
    };

    set(state => {
      const meId = CURRENT_USER.id;
      const idx = state.stories.findIndex(s => s.authorId === meId);
      if (idx < 0) return state;

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
          } else {
            archiveAdds.push({
              ...item,
              authorId: story.authorId,
              archivedAt: new Date().toISOString(),
            });
          }
        }
        return { ...story, items: kept };
      });

      if (!archiveAdds.length) return state;
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
