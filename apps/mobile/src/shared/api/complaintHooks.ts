import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateComplaintRequest, CreateComplaintResponse, ListComplaintsResponse } from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { apiRequest } from './client';

export function useComplaintsQuery(enabled = true) {
  const { user } = useAuth();
  const signedIn = Boolean(user && user.id !== 'temporary-guest');
  return useInfiniteQuery({
    queryKey: ['complaints', user?.id ?? 'signed-out'],
    enabled: enabled && signedIn,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      return apiRequest<ListComplaintsResponse>(`/v1/complaints?${params}`);
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
    staleTime: 0,
  });
}

export function useCreateComplaintMutation() {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (request: CreateComplaintRequest) => {
      if (!user || user.id === 'temporary-guest') throw new Error('Sign in to post a complaint.');
      const result = await apiRequest<CreateComplaintResponse>('/v1/complaints', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      return result.complaint;
    },
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['complaints'] }); },
  });
}
