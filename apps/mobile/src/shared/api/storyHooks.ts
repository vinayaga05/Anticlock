import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import { isApiEnabled } from './config';
import type { UserStory } from '@/shared/data/flash/storyTypes';
import type { PostAuthor } from '@/shared/data/flash/types';

type ApiContentPost = {
  id: string;
  format: 'story' | 'flash';
  mediaType: 'text' | 'image' | 'video' | 'hybrid';
  caption: string;
  mediaIds: string[];
  thumbnailMediaId: string | null;
  visibility: string;
  author: {
    type: 'user' | 'provider';
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  expiresAt: string | null;
};

function mapApiStoryToUserStory(apiPost: ApiContentPost): UserStory {
  const author: PostAuthor = {
    id: apiPost.author.id,
    name: apiPost.author.name,
    avatarUrl: apiPost.author.avatarUrl ?? '',
    followed: false,
  };

  return {
    authorId: apiPost.author.id,
    author,
    audience: apiPost.visibility === 'friends' ? 'close_friends' : 'followers',
    items: [{
      id: apiPost.id,
      type: apiPost.mediaType === 'text' ? 'text' : apiPost.mediaType === 'video' ? 'video' : 'photo',
      mediaUrl: apiPost.mediaIds[0] ? `/v1/content/posts/${apiPost.id}/media` : undefined,
      textContent: apiPost.mediaType === 'text' ? apiPost.caption : undefined,
      backgroundColor: apiPost.mediaType === 'text' ? '#0F766E' : undefined,
      createdAt: apiPost.createdAt,
      expiresAt: apiPost.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      durationMs: 5000,
    }],
  };
}

export function useStoriesQuery() {
  return useQuery({
    queryKey: ['stories', 'feed', isApiEnabled ? 'api' : 'local'],
    queryFn: async (): Promise<UserStory[]> => {
      if (!isApiEnabled) {
        return [];
      }
      const response = await apiRequest<{ data: ApiContentPost[] }>(
        '/v1/content/posts?format=story',
      );
      return response.data.map(mapApiStoryToUserStory);
    },
    enabled: isApiEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function useFlashPostsQuery() {
  return useQuery({
    queryKey: ['flash', 'feed', isApiEnabled ? 'api' : 'local'],
    queryFn: async (): Promise<ApiContentPost[]> => {
      if (!isApiEnabled) {
        return [];
      }
      const response = await apiRequest<{ data: ApiContentPost[] }>(
        '/v1/content/posts?format=flash',
      );
      return response.data;
    },
    enabled: isApiEnabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
