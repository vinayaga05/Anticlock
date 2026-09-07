import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { readStoredSession } from '@/shared/services/auth/authService';
import type {
  MyInterestsResponse,
  UpdateMyInterestsRequest,
} from '@/features/interests/types';

export const myInterestsQueryKey = ['interests', 'me'] as const;

function ensureAuthToken() {
  if (!readStoredSession()?.token) {
    throw new Error('Not authenticated');
  }
}

export function useMyInterestsQuery(enabled = true) {
  return useQuery({
    queryKey: myInterestsQueryKey,
    enabled: enabled && isApiEnabled,
    queryFn: async () => {
      ensureAuthToken();
      return apiRequest<MyInterestsResponse>('/v1/interests/me');
    },
  });
}

export function useUpdateMyInterestsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (interestIds: string[]) => {
      ensureAuthToken();
      return apiRequest<MyInterestsResponse>('/v1/interests/me', {
        method: 'PUT',
        body: JSON.stringify({ interestIds } satisfies UpdateMyInterestsRequest),
      });
    },
    onSuccess: data => {
      queryClient.setQueryData(myInterestsQueryKey, data);
      void queryClient.invalidateQueries({ queryKey: myInterestsQueryKey });
    },
  });
}
