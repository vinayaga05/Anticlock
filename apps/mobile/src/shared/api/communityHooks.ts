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
import { apiRequest } from './client';

export function useCommunitiesQuery(search?: string) {
  return useQuery({
    queryKey: ['communities', search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const response = await apiRequest<CommunityListResponse>(
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
      const response = await apiRequest<CommunityListResponse>('/v1/communities/my');
      return response;
    },
  });
}

export function useCommunityQuery(communityId: string) {
  return useQuery({
    queryKey: ['communities', communityId],
    queryFn: async () => {
      const response = await apiRequest<{ community: CommunityDetail }>(
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
      const response = await apiRequest<{ community: Community }>(
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
      await apiRequest(`/v1/communities/${communityId}/join`, {
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
      await apiRequest(`/v1/communities/${communityId}/leave`, {
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
      const response = await apiRequest<CommunityPostListResponse>(
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
      const response = await apiRequest<{ post: CommunityPost }>(
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
    mutationFn: async ({ postId, communityId: _communityId }: { postId: string; communityId: string }) => {
      await apiRequest(`/v1/communities/posts/${postId}/like`, {
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
    mutationFn: async ({ postId, communityId: _communityId }: { postId: string; communityId: string }) => {
      await apiRequest(`/v1/communities/posts/${postId}/unlike`, {
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
      const response = await apiRequest<CommentListResponse>(
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
      const response = await apiRequest<{ comment: CommunityPostComment }>(
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
      await apiRequest(`/v1/communities/posts/${postId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
    },
  });
}
