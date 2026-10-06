import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Community,
  CommunityDetail,
  CommunityListResponse,
  CommunityPost,
  CommunityPostListResponse,
  CommunityPostComment,
  CommentListResponse,
  CreateCommunityRequest,
  CreateCommunityPostRequest,
  CreateCommentRequest,
  ReportPostRequest,
} from '@anticlock/contracts';
import { apiFetch, isApiEnabled } from './client';

export function useCommunitiesQuery(search?: string) {
  return useQuery({
    queryKey: ['communities', search],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockCommunities(search);
      }

      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const response = await apiFetch<CommunityListResponse>(
        `/v1/communities?${params.toString()}`,
      );
      return response;
    },
  });
}

export function useMyCommunitiesQuery() {
  return useQuery({
    queryKey: ['communities', 'my'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockMyCommunities();
      }

      const response = await apiFetch<CommunityListResponse>('/v1/communities/my');
      return response;
    },
  });
}

export function useCommunityQuery(communityId: string) {
  return useQuery({
    queryKey: ['communities', communityId],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockCommunity(communityId);
      }

      const response = await apiFetch<{ community: CommunityDetail }>(
        `/v1/communities/${communityId}`,
      );
      return response.community;
    },
    enabled: !!communityId,
  });
}

export function useCreateCommunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreateCommunityRequest) => {
      if (!isApiEnabled) {
        return createMockCommunity(request);
      }

      const response = await apiFetch<{ community: Community }>(
        '/v1/communities',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      return response.community;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
    },
  });
}

export function useJoinCommunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!isApiEnabled) {
        return joinMockCommunity(communityId);
      }

      await apiFetch(`/v1/communities/${communityId}/join`, {
        method: 'POST',
      });
    },
    onSuccess: (_data, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'my'] });
    },
  });
}

export function useLeaveCommunityMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (communityId: string) => {
      if (!isApiEnabled) {
        return leaveMockCommunity(communityId);
      }

      await apiFetch(`/v1/communities/${communityId}/leave`, {
        method: 'POST',
      });
    },
    onSuccess: (_data, communityId) => {
      queryClient.invalidateQueries({ queryKey: ['communities'] });
      queryClient.invalidateQueries({ queryKey: ['communities', communityId] });
      queryClient.invalidateQueries({ queryKey: ['communities', 'my'] });
    },
  });
}

export function useCommunityPostsQuery(communityId: string) {
  return useQuery({
    queryKey: ['communities', communityId, 'posts'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockPosts(communityId);
      }

      const response = await apiFetch<CommunityPostListResponse>(
        `/v1/communities/${communityId}/posts`,
      );
      return response;
    },
    enabled: !!communityId,
  });
}

export function useCreatePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      communityId,
      request,
    }: {
      communityId: string;
      request: CreateCommunityPostRequest;
    }) => {
      if (!isApiEnabled) {
        return createMockPost(communityId, request);
      }

      const response = await apiFetch<{ post: CommunityPost }>(
        `/v1/communities/${communityId}/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      return response.post;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['communities', variables.communityId, 'posts'],
      });
      queryClient.invalidateQueries({
        queryKey: ['communities', variables.communityId],
      });
    },
  });
}

export function useLikePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, communityId }: { postId: string; communityId: string }) => {
      if (!isApiEnabled) {
        return;
      }

      await apiFetch(`/v1/communities/posts/${postId}/like`, {
        method: 'POST',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['communities', variables.communityId, 'posts'],
      });
    },
  });
}

export function useUnlikePostMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId, communityId }: { postId: string; communityId: string }) => {
      if (!isApiEnabled) {
        return;
      }

      await apiFetch(`/v1/communities/posts/${postId}/unlike`, {
        method: 'POST',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['communities', variables.communityId, 'posts'],
      });
    },
  });
}

export function usePostCommentsQuery(postId: string) {
  return useQuery({
    queryKey: ['posts', postId, 'comments'],
    queryFn: async () => {
      if (!isApiEnabled) {
        return getMockComments(postId);
      }

      const response = await apiFetch<CommentListResponse>(
        `/v1/communities/posts/${postId}/comments`,
      );
      return response;
    },
    enabled: !!postId,
  });
}

export function useCreateCommentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      request,
    }: {
      postId: string;
      request: CreateCommentRequest;
    }) => {
      if (!isApiEnabled) {
        return createMockComment(postId, request);
      }

      const response = await apiFetch<{ comment: CommunityPostComment }>(
        `/v1/communities/posts/${postId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        },
      );
      return response.comment;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['posts', variables.postId, 'comments'],
      });
    },
  });
}

export function useReportPostMutation() {
  return useMutation({
    mutationFn: async ({
      postId,
      request,
    }: {
      postId: string;
      request: ReportPostRequest;
    }) => {
      if (!isApiEnabled) {
        return;
      }

      await apiFetch(`/v1/communities/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    },
  });
}

const mockCommunities: CommunityDetail[] = [
  {
    id: 'mock-comm-1',
    name: 'Chennai Cricket Fans',
    slug: 'chennai-cricket-fans',
    description:
      'For everyone who loves cricket in Chennai! Share updates, organize meetups, and discuss matches.',
    memberCount: 1248,
    postCount: 156,
    tags: ['Cricket', 'Sports', 'Chennai'],
    status: 'published',
    ownerName: 'Arun Kumar',
    isMember: true,
    myRole: 'member',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    suspendedAt: null,
  },
  {
    id: 'mock-comm-2',
    name: 'Fitness & Wellness',
    slug: 'fitness-wellness',
    description:
      'A community for fitness enthusiasts, wellness seekers, and healthy living advocates.',
    memberCount: 892,
    postCount: 234,
    tags: ['Fitness', 'Wellness', 'Health'],
    status: 'published',
    ownerName: 'Priya Sharma',
    isMember: false,
    myRole: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    suspendedAt: null,
  },
  {
    id: 'mock-comm-3',
    name: 'Tech Talk Chennai',
    slug: 'tech-talk-chennai',
    description:
      'Discuss the latest in technology, startups, and innovations happening in Chennai.',
    memberCount: 456,
    postCount: 89,
    tags: ['Technology', 'Startups', 'Chennai'],
    status: 'published',
    ownerName: 'Ravi Chandran',
    isMember: false,
    myRole: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    suspendedAt: null,
  },
];

function getMockCommunities(search?: string): CommunityListResponse {
  let filtered = mockCommunities;
  if (search) {
    filtered = mockCommunities.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase()),
    );
  }
  return { communities: filtered, nextCursor: null };
}

function getMockMyCommunities(): CommunityListResponse {
  const filtered = mockCommunities.filter((c) => c.isMember);
  return { communities: filtered, nextCursor: null };
}

function getMockCommunity(communityId: string): CommunityDetail | null {
  return mockCommunities.find((c) => c.id === communityId) ?? null;
}

function createMockCommunity(request: CreateCommunityRequest): Community {
  return {
    id: `mock-comm-${Date.now()}`,
    name: request.name,
    slug: request.slug,
    description: request.description,
    memberCount: 1,
    postCount: 0,
    tags: request.tags ?? [],
    status: 'published',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    suspendedAt: null,
  };
}

function joinMockCommunity(_communityId: string): void {
  // Mock join - in real app would update membership
}

function leaveMockCommunity(_communityId: string): void {
  // Mock leave - in real app would update membership
}

const mockPosts: CommunityPost[] = [
  {
    id: 'mock-post-1',
    communityId: 'mock-comm-1',
    authorId: 'mock-user-1',
    authorName: 'Arun Kumar',
    content:
      'Just watched an amazing match today! CSK vs MI was absolutely thrilling. What did you all think?',
    likeCount: 42,
    commentCount: 8,
    isLiked: false,
    status: 'visible',
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    removedAt: null,
  },
  {
    id: 'mock-post-2',
    communityId: 'mock-comm-1',
    authorId: 'mock-user-2',
    authorName: 'Priya Sharma',
    content:
      'Looking to organize a weekend cricket match at ECR. Who wants to join? We need at least 16 players!',
    likeCount: 28,
    commentCount: 15,
    isLiked: true,
    status: 'visible',
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
    removedAt: null,
  },
];

function getMockPosts(communityId: string): CommunityPostListResponse {
  const filtered = mockPosts.filter((p) => p.communityId === communityId);
  return { posts: filtered, nextCursor: null };
}

function createMockPost(
  communityId: string,
  request: CreateCommunityPostRequest,
): CommunityPost {
  return {
    id: `mock-post-${Date.now()}`,
    communityId,
    authorId: 'mock-user-1',
    authorName: 'You',
    content: request.content,
    mediaUrl: request.mediaAssetId ? 'https://example.com/media.jpg' : undefined,
    likeCount: 0,
    commentCount: 0,
    isLiked: false,
    status: 'visible',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    removedAt: null,
  };
}

const mockComments: CommunityPostComment[] = [
  {
    id: 'mock-comment-1',
    postId: 'mock-post-1',
    authorId: 'mock-user-3',
    authorName: 'Karthik',
    content: 'Great match indeed! The last over was nail-biting!',
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
  {
    id: 'mock-comment-2',
    postId: 'mock-post-1',
    authorName: 'Meera',
    authorId: 'mock-user-4',
    content: 'I missed it! Anyone has highlights?',
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
];

function getMockComments(postId: string): CommentListResponse {
  const filtered = mockComments.filter((c) => c.postId === postId);
  return { comments: filtered };
}

function createMockComment(
  postId: string,
  request: CreateCommentRequest,
): CommunityPostComment {
  return {
    id: `mock-comment-${Date.now()}`,
    postId,
    authorId: 'mock-user-1',
    authorName: 'You',
    content: request.content,
    createdAt: new Date().toISOString(),
  };
}
