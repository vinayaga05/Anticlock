import { create } from 'zustand';
import { CURRENT_USER, flashAuthors } from '@/shared/data/flash/posts';
import { getProfileMeta } from '@/shared/data/flash/users';
import type { ProfileHighlight } from '@/shared/data/flash/types';
import type { StoryItem } from '@/shared/data/flash/storyTypes';
import { useEngagementStore } from '@/shared/services/engagementRepository';
import { useStoryStore } from '@/shared/data/flash/storyStore';
import { seedStories } from '@/shared/data/flash/stories';
import { useCommunityStore } from '@/shared/data/community/store';

function seedFollowingIds(): string[] {
  const ids = Object.values(flashAuthors)
    .filter(a => a.followed)
    .map(a => a.id);
  return [...new Set([...ids, 'user-priya', 'user-arun'])];
}

type ProfileState = {
  followingIds: string[];
  followerDeltas: Record<string, number>;

  isFollowing: (userId: string) => boolean;
  toggleFollow: (userId: string) => void;
  getFollowerCount: (userId: string) => number;
  getFollowingCount: (userId: string) => number;
  getPostCount: (userId: string) => number;
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  followingIds: seedFollowingIds(),
  followerDeltas: {},

  isFollowing: userId => get().followingIds.includes(userId),

  toggleFollow: userId => {
    if (userId === CURRENT_USER.id) return;
    const wasFollowing = get().isFollowing(userId);
    set(state => ({
      followingIds: wasFollowing
        ? state.followingIds.filter(id => id !== userId)
        : [...state.followingIds, userId],
      followerDeltas: {
        ...state.followerDeltas,
        [userId]: (state.followerDeltas[userId] ?? 0) + (wasFollowing ? -1 : 1),
      },
    }));
    useEngagementStore.getState().followAuthor(userId, !wasFollowing);
  },

  getFollowerCount: userId => {
    const base = getProfileMeta(userId).followerCount;
    return Math.max(0, base + (get().followerDeltas[userId] ?? 0));
  },

  getFollowingCount: userId => {
    if (userId === CURRENT_USER.id) return get().followingIds.length;
    return getProfileMeta(userId).followingCount;
  },

  getPostCount: userId =>
    useEngagementStore.getState().getPostsByAuthor(userId).length,
}));

function storyThumb(item: StoryItem): string | undefined {
  if (item.type === 'photo' && typeof item.mediaUrl === 'string') {
    return item.mediaUrl;
  }
  if (item.posterUrl) return item.posterUrl;
  if (typeof item.mediaUrl === 'string') return item.mediaUrl;
  return undefined;
}

/** Highlights row — active story, archive, and saved rings. */
export function getProfileHighlights(userId: string): ProfileHighlight[] {
  const meta = getProfileMeta(userId);
  const storyState = useStoryStore.getState();
  const activeStory = storyState.getActiveStory(userId);
  const archive = storyState.archive.filter(a => a.authorId === userId);
  const highlights: ProfileHighlight[] = [];

  if (userId === CURRENT_USER.id) {
    highlights.push({ id: 'hl-new', label: 'New', isNew: true });
  }

  if (activeStory?.items.length) {
    const thumb = storyThumb(activeStory.items[0]);
    highlights.push({
      id: `hl-story-${userId}`,
      label: 'Story',
      imageUrl: thumb,
    });
  }

  if (userId === CURRENT_USER.id && archive.length > 0) {
    highlights.push({
      id: 'hl-archive',
      label: 'Archive',
      imageUrl: storyThumb(archive[0]),
    });
  }

  for (const item of meta.highlights ?? []) {
    if (item.isNew && userId === CURRENT_USER.id) continue;
    if (highlights.some(h => h.id === item.id)) continue;
    highlights.push(item);
  }

  return highlights;
}

export type ProfileShortcut = {
  id: string;
  label: string;
  imageUrl: string;
  kind: 'saved' | 'team' | 'story';
  refId?: string;
};

export function getProfileShortcuts(userId: string): ProfileShortcut[] {
  if (userId !== CURRENT_USER.id) return [];

  const shortcuts: ProfileShortcut[] = [];
  const saved = useEngagementStore.getState().saved;

  for (const item of saved.slice(0, 3)) {
    shortcuts.push({
      id: `saved-${item.id}`,
      label: item.title,
      imageUrl:
        item.imageUrl ??
        'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?auto=format&fit=crop&w=200&h=200&q=80',
      kind: 'saved',
      refId: item.refId,
    });
  }

  const teams = useCommunityStore.getState().getMyTeams();
  for (const team of teams.slice(0, 4 - shortcuts.length)) {
    shortcuts.push({
      id: `team-${team.id}`,
      label: team.name.split(' ')[0] ?? team.name,
      imageUrl: team.logoUrl,
      kind: 'team',
      refId: team.id,
    });
  }

  const active = useStoryStore.getState().getActiveStory(userId);
  if (shortcuts.length < 4 && active?.items[0]) {
    const thumb = storyThumb(active.items[0]);
    if (thumb) {
      shortcuts.push({
        id: 'shortcut-story',
        label: 'Story',
        imageUrl: thumb,
        kind: 'story',
      });
    }
  }

  return shortcuts.slice(0, 4);
}

/** Resolve any author referenced in flash posts or stories. */
export function resolveProfileUser(userId: string) {
  if (userId === CURRENT_USER.id) return CURRENT_USER;
  const fromFlash = Object.values(flashAuthors).find(a => a.id === userId);
  if (fromFlash) return fromFlash;
  return seedStories.find(s => s.authorId === userId)?.author;
}
