import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import type { UserStory } from '@/shared/data/flash/storyTypes';
import type { FlashPost } from '@/shared/data/flash/types';
import { contentQueryKeys } from '@/shared/publishing/contentQueryKeys';
import {
  mapApiFlashPost,
  mapApiStoriesToUserStories,
  postsOf,
  type ApiContentPost,
  type ApiContentPostsResponse,
  type ApiContentPublisher,
} from '@/shared/publishing/contentPostMappers';
import type {
  PublishFormat,
  PublisherProfileType,
} from '@/shared/publishing/publisherSelection';

export type { ApiContentPost, ApiContentPublisher };

/**
 * Story tray: live (`published`, not expired) stories the viewer may see,
 * grouped per publisher profile. Previously this called a route that did
 * not exist, so published stories never reached other users.
 */
export function useStoriesQuery() {
  return useQuery({
    queryKey: [...contentQueryKeys.storyTray, isApiEnabled ? 'api' : 'local'],
    queryFn: async (): Promise<UserStory[]> => {
      if (!isApiEnabled) return [];
      const response = await apiRequest<ApiContentPostsResponse>(
        '/v1/content/posts?format=story&limit=50',
      );
      return mapApiStoriesToUserStories(postsOf(response));
    },
    enabled: isApiEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Flash feed: published Flash posts from personal and business profiles. */
export function useFlashPostsQuery() {
  return useQuery({
    queryKey: [...contentQueryKeys.flashFeed, isApiEnabled ? 'api' : 'local'],
    queryFn: async (): Promise<FlashPost[]> => {
      if (!isApiEnabled) return [];
      const response = await apiRequest<ApiContentPostsResponse>(
        '/v1/content/posts?format=flash&limit=50',
      );
      const now = Date.now();
      return postsOf(response).map(post => mapApiFlashPost(post, now));
    },
    enabled: isApiEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export type ContentProfileSummary = {
  publisher: ApiContentPublisher;
  counts: { posts: number; clips: number; flash: number; stories: number };
  viewerCanManage: boolean;
};

/** Profile header + counts for a personal or business publisher profile. */
export function useContentProfileQuery(
  type: PublisherProfileType | undefined,
  id: string | undefined,
) {
  return useQuery({
    queryKey: contentQueryKeys.profile(type ?? 'personal', id ?? ''),
    queryFn: async () => {
      const response = await apiRequest<{ profile: ContentProfileSummary }>(
        `/v1/content/profiles/${type}/${id}`,
      );
      return response.profile;
    },
    enabled: isApiEnabled && Boolean(type && id),
    staleTime: 15_000,
  });
}

/** Content published AS a profile (filtered by publisher, never by owner). */
export function useContentProfilePostsQuery(
  type: PublisherProfileType | undefined,
  id: string | undefined,
  format: PublishFormat,
) {
  return useQuery({
    queryKey: contentQueryKeys.profilePosts(type ?? 'personal', id ?? '', format),
    queryFn: async (): Promise<ApiContentPost[]> => {
      const response = await apiRequest<ApiContentPostsResponse>(
        `/v1/content/profiles/${type}/${id}/posts?format=${format}&limit=30`,
      );
      return postsOf(response);
    },
    enabled: isApiEnabled && Boolean(type && id),
    staleTime: 15_000,
  });
}

export type MyContentItem = {
  id: string;
  draftId: string;
  postId: string | null;
  contentType: PublishFormat;
  contentStatus: string;
  visibility: string;
  publisherProfileId: string;
  publisherProfileType: PublisherProfileType;
  publisher: ApiContentPublisher;
  mediaType: string;
  caption: string;
  failureReason: string | null;
  createdAt: string;
  publishedAt: string | null;
};

/** Owner-only "My Content" (includes uploading/processing/review states). */
export function useMyContentQuery(publisherProfileId?: string, enabled = true) {
  return useQuery({
    queryKey: [...contentQueryKeys.mine, publisherProfileId ?? 'all'],
    queryFn: async (): Promise<MyContentItem[]> => {
      const query = publisherProfileId
        ? `?publisherProfileId=${encodeURIComponent(publisherProfileId)}`
        : '';
      const response = await apiRequest<{ items: MyContentItem[] }>(
        `/v1/content/mine${query}`,
      );
      return response.items;
    },
    enabled: isApiEnabled && enabled,
    staleTime: 10_000,
  });
}
