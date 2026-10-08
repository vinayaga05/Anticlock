import type { UserStory, StoryItem } from '@/shared/data/flash/storyTypes';
import type {
  FlashPost,
  PostAuthor,
  PostMedia,
  PostVisibility,
} from '@/shared/data/flash/types';
import type { PublisherProfileType } from './publisherSelection';

/** `publisher` block returned by every content feed/profile endpoint. */
export type ApiContentPublisher = {
  id: string;
  type: PublisherProfileType;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  verified: boolean;
  businessCategory: string | null;
};

/** Item shape of `GET /v1/content/posts` and profile post lists. */
export type ApiContentPost = {
  id: string;
  format: 'clip' | 'flash' | 'story';
  mediaType: 'text' | 'image' | 'video' | 'hybrid';
  contentStatus?: string;
  caption: string;
  mediaIds: string[];
  media?: { id: string; kind: string; url: string }[];
  thumbnailMediaId: string | null;
  posterUrl?: string | null;
  visibility: string;
  publisherProfileId?: string;
  publisherProfileType?: PublisherProfileType;
  publisher?: ApiContentPublisher;
  author: {
    type: 'user' | 'provider';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewerHasLiked?: boolean;
  viewerCanManage?: boolean;
  createdAt: string;
  publishedAt?: string;
  expiresAt: string | null;
};

export type ApiContentPostsResponse = {
  items?: ApiContentPost[];
  data?: ApiContentPost[];
  nextCursor?: string | null;
};

export function postsOf(response: ApiContentPostsResponse): ApiContentPost[] {
  return response.items ?? response.data ?? [];
}

const STORY_DURATION_MS = 5_000;
const TEXT_STORY_BACKGROUND = '#0F766E';
const VISIBILITIES: PostVisibility[] = [
  'public',
  'followers',
  'friends',
  'community',
  'only_me',
];

function publisherOf(post: ApiContentPost): ApiContentPublisher {
  if (post.publisher) return post.publisher;
  return {
    id: post.author.id,
    type: post.author.type === 'provider' ? 'business' : 'personal',
    displayName: post.author.name,
    handle: null,
    avatarUrl: post.author.avatarUrl,
    verified: false,
    businessCategory: null,
  };
}

/** The shown creator is always the publisher profile, never the owner. */
export function publisherToAuthor(publisher: ApiContentPublisher): PostAuthor {
  return {
    id: publisher.id,
    name: publisher.displayName,
    avatarUrl: publisher.avatarUrl ?? '',
    verified: publisher.verified,
    isProvider: publisher.type === 'business',
    profileType: publisher.type,
    handle: publisher.handle,
    businessCategory: publisher.businessCategory,
    followed: false,
  };
}

export function relativeTimeLabel(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function postMedia(post: ApiContentPost): PostMedia[] {
  return (post.media ?? [])
    .filter(item => typeof item.url === 'string' && item.url.length > 0)
    .map(item => ({
      id: item.id,
      type: item.kind === 'video' ? ('video' as const) : ('image' as const),
      url: item.url,
      posterUrl:
        item.kind === 'video' && post.posterUrl ? post.posterUrl : undefined,
    }));
}

export function mapApiFlashPost(post: ApiContentPost, now = Date.now()): FlashPost {
  const publisher = publisherOf(post);
  const publishedAt = post.publishedAt ?? post.createdAt;
  return {
    id: post.id,
    author: publisherToAuthor(publisher),
    createdAt: publishedAt,
    timeLabel: relativeTimeLabel(publishedAt, now),
    visibility: VISIBILITIES.includes(post.visibility as PostVisibility)
      ? (post.visibility as PostVisibility)
      : 'public',
    text: post.caption ? post.caption : undefined,
    media: postMedia(post),
    feedTabs: ['forYou', 'following', 'nearby'],
    reactionCounts: post.likeCount ? { like: post.likeCount } : {},
    commentCount: post.commentCount ?? 0,
    shareCount: post.shareCount ?? 0,
    viewCount: post.viewCount,
    viewerReaction: post.viewerHasLiked ? 'like' : null,
    isOwn: post.viewerCanManage === true,
    commentsEnabled: true,
    source: 'api',
    publisherProfileId: publisher.id,
    publisherProfileType: publisher.type,
  };
}

function storyItem(post: ApiContentPost): StoryItem {
  const first = postMedia(post)[0];
  const type: StoryItem['type'] =
    post.mediaType === 'text' ? 'text' : first?.type === 'video' ? 'video' : 'photo';
  return {
    id: post.id,
    type,
    mediaUrl: first?.url,
    posterUrl: post.posterUrl ?? undefined,
    textContent: post.mediaType === 'text' ? post.caption : undefined,
    backgroundColor: post.mediaType === 'text' ? TEXT_STORY_BACKGROUND : undefined,
    createdAt: post.publishedAt ?? post.createdAt,
    expiresAt:
      post.expiresAt ??
      new Date(Date.parse(post.publishedAt ?? post.createdAt) + 86_400_000).toISOString(),
    durationMs: STORY_DURATION_MS,
  };
}

/**
 * Groups live stories into one tray entry per publisher profile (personal
 * or business), oldest item first like the viewer expects. Expired or
 * media-less stories are dropped.
 */
export function mapApiStoriesToUserStories(
  posts: ApiContentPost[],
  now = Date.now(),
): UserStory[] {
  const groups = new Map<string, UserStory>();
  for (const post of posts) {
    if (post.format !== 'story') continue;
    if (post.expiresAt && Date.parse(post.expiresAt) <= now) continue;
    const item = storyItem(post);
    if (item.type !== 'text' && !item.mediaUrl) continue;
    const publisher = publisherOf(post);
    const key = `${publisher.type}:${publisher.id}`;
    const group = groups.get(key) ?? {
      authorId: publisher.id,
      author: publisherToAuthor(publisher),
      audience:
        post.visibility === 'public'
          ? ('public' as const)
          : post.visibility === 'friends'
            ? ('close_friends' as const)
            : ('followers' as const),
      items: [],
      source: 'api' as const,
    };
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].map(group => ({
    ...group,
    items: [...group.items].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  }));
}
