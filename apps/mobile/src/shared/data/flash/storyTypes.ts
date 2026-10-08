import type { PostAuthor } from './types';

export type StoryAudience = 'public' | 'followers' | 'close_friends' | 'selected';

export type StoryMediaType = 'photo' | 'video' | 'text';

export type StoryShareKind =
  | 'moment'
  | 'reel'
  | 'flash_post'
  | 'product'
  | 'event'
  | 'team'
  | 'challenge';

export interface StoryItem {
  id: string;
  type: StoryMediaType;
  mediaUrl?: string | number;
  posterUrl?: string;
  textContent?: string;
  backgroundColor?: string;
  shareKind?: StoryShareKind;
  shareTitle?: string;
  shareSubtitle?: string;
  shareCta?: string;
  shareRefId?: string;
  createdAt: string;
  expiresAt: string;
  durationMs?: number;
}

export interface UserStory {
  authorId: string;
  author: PostAuthor;
  items: StoryItem[];
  audience: StoryAudience;
  /** Server-published (refetched) story group. */
  source?: 'api' | 'local';
}

export interface StoryArchiveEntry extends StoryItem {
  authorId: string;
  archivedAt: string;
}

export interface StoryTrayEntry {
  authorId: string;
  author: PostAuthor;
  items: StoryItem[];
  isOwn: boolean;
  hasActiveStory: boolean;
  hasUnread: boolean;
}

export const STORY_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const STORY_DEFAULT_DURATION_MS = 5000;

export function storyTimeLabel(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h`;
  return '1d';
}
