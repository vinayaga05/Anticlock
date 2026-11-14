import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { SavedBusinessesResponse } from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { ApiError, getApiToken } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import type { ProfileRef } from '@/shared/api/profileFollows';
import { readStoredSession } from '@/shared/services/auth/authService';
import { businessRequest } from './businessProfileHooks';

type Session = { userId: string; token: string };

function sessionFor(userId: string | undefined): Session {
  const session = readStoredSession();
  const token = getApiToken();
  if (
    !userId ||
    userId === 'temporary-guest' ||
    !token ||
    session?.user.id !== userId ||
    session.token !== token
  ) {
    throw new ApiError(
      401,
      'unauthorized',
      'Sign in to see your saved businesses.',
    );
  }
  return { userId, token };
}
function assertSession(expected: Session) {
  const current = readStoredSession();
  if (
    current?.user.id !== expected.userId ||
    current.token !== expected.token ||
    getApiToken() !== expected.token
  ) {
    throw new ApiError(
      0,
      'session_changed',
      'Your account changed. Reopen Saved to continue.',
    );
  }
}
function viewerParams(viewer?: ProfileRef) {
  const params = new URLSearchParams();
  if (viewer) {
    params.set('viewerProfileId', viewer.id);
    params.set('viewerProfileType', viewer.type);
  }
  return params;
}

export function useSavedBusinessesQuery(viewer?: ProfileRef) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['saved-businesses', user?.id, viewer?.type, viewer?.id],
    enabled:
      isApiEnabled &&
      Boolean(user && user.id !== 'temporary-guest' && getApiToken()),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const session = sessionFor(user?.id);
      const params = viewerParams(viewer);
      params.set('limit', '20');
      if (pageParam) params.set('cursor', pageParam);
      const result = await businessRequest<SavedBusinessesResponse>(
        `/v1/business-profiles/saved?${params}`,
        { signal },
      );
      assertSession(session);
      return result;
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}

/** Keep the row until server acknowledgement; failures stay retryable. */
export function useUnsaveBusinessMutation(viewer?: ProfileRef) {
  const { user } = useAuth();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const session = sessionFor(user?.id);
      const params = viewerParams(viewer).toString();
      const result = await businessRequest<{ saved: boolean }>(
        `/v1/business-profiles/${encodeURIComponent(providerId)}/save${
          params ? `?${params}` : ''
        }`,
        {
          method: 'PUT',
          body: JSON.stringify({ saved: false }),
        },
      );
      assertSession(session);
      return { ...result, session, providerId };
    },
    onSuccess: ({ session, providerId }) => {
      assertSession(session);
      void client.invalidateQueries({
        queryKey: ['saved-businesses', session.userId],
      });
      void client.invalidateQueries({
        queryKey: ['business-profile', providerId, session.userId],
      });
    },
    retry: false,
  });
}
