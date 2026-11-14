import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  Booking,
  BusinessAnalytics,
  BusinessAvailability,
  BusinessAvailabilityQuery,
  BusinessProfile,
  BusinessReview,
  CreateBusinessReviewRequest,
  UpdateBusinessProfileRequest,
  UpdateBusinessServicesRequest,
} from '@anticlock/contracts';
import { useAuth } from '@/shared/context/AuthProvider';
import { ApiError, apiRequest, getApiToken } from '@/shared/api/client';
import { isApiEnabled } from '@/shared/api/config';
import { getStoredSession } from '@/shared/services/storage';
import { isSessionExpired } from '@/shared/services/auth/types';
import type { ProfileRef } from '@/shared/api/profileFollows';

export type BusinessEligibleBooking = {
  id: string;
  serviceTitle: string;
  startsAt: string;
};
export type BusinessReviewsPage = {
  reviews: BusinessReview[];
  nextCursor: string | null;
  eligibleBookings: BusinessEligibleBooking[];
};
export type BusinessReportRequest = { reason: string; details?: string };
type Session = { userId: string; token: string };
const prefix = '/v1/business-profiles';

/** Bounds headers and response-body reads; the shared client only bounds headers. */
export async function businessRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel: (() => void) | undefined;
  const failure = () =>
    Object.assign(new Error('Request cancelled'), { name: 'AbortError' });
  if (init.signal?.aborted) throw failure();
  try {
    return await Promise.race([
      apiRequest<T>(path, { ...init, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(
            new ApiError(
              0,
              'request_timeout',
              'The request timed out. Check your connection and try again.',
            ),
          );
        }, 25_000);
        cancel = () => {
          controller.abort();
          reject(failure());
        };
        init.signal?.addEventListener('abort', cancel, { once: true });
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (cancel) init.signal?.removeEventListener('abort', cancel);
  }
}

function pathFor(providerId: string, suffix = '', viewer?: ProfileRef) {
  const params = new URLSearchParams();
  if (viewer) {
    params.set('viewerProfileId', viewer.id);
    params.set('viewerProfileType', viewer.type);
  }
  const query = params.toString();
  return `${prefix}/${encodeURIComponent(providerId)}${suffix}${
    query ? `?${query}` : ''
  }`;
}
function sessionFor(userId: string | undefined): Session {
  const session = getStoredSession();
  const token = getApiToken();
  if (
    !userId ||
    userId === 'temporary-guest' ||
    !session ||
    isSessionExpired(session.expiresAt) ||
    session.user.id !== userId ||
    !token ||
    session.token !== token
  )
    throw new ApiError(401, 'unauthorized', 'Sign in to continue.');
  return { userId, token };
}
function sameSession(expected: Session) {
  const current = getStoredSession();
  return (
    current?.user.id === expected.userId &&
    !isSessionExpired(current.expiresAt) &&
    current.token === expected.token &&
    getApiToken() === expected.token
  );
}
function assertSession(expected: Session) {
  if (!sameSession(expected))
    throw new ApiError(
      0,
      'session_changed',
      'Your account changed. Reopen this page to continue.',
    );
}

export function useBusinessProfileQuery(
  providerId: string,
  viewer?: ProfileRef,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [
      'business-profile',
      providerId,
      user?.id,
      viewer?.type,
      viewer?.id,
    ],
    enabled:
      isApiEnabled &&
      Boolean(
        providerId && user && user.id !== 'temporary-guest' && getApiToken(),
      ),
    queryFn: async ({ signal }) => {
      const session = sessionFor(user?.id);
      const response = await businessRequest<{ business: BusinessProfile }>(
        pathFor(providerId, '', viewer),
        { signal },
      );
      assertSession(session);
      return response.business;
    },
    staleTime: 20_000,
  });
}
export function useBusinessAvailabilityQuery(
  providerId: string,
  options: BusinessAvailabilityQuery | null,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['business-availability', providerId, user?.id, options],
    enabled:
      isApiEnabled &&
      Boolean(
        providerId &&
          options &&
          user &&
          user.id !== 'temporary-guest' &&
          getApiToken(),
      ),
    queryFn: async ({ signal }) => {
      const session = sessionFor(user?.id);
      if (!options) throw new Error('Select a service and date.');
      const params = new URLSearchParams({
        date: options.date,
        categoryId: options.categoryId,
        serviceMode: options.serviceMode,
        durationMinutes: String(options.durationMinutes ?? 60),
      });
      const response = await businessRequest<{
        availability: BusinessAvailability;
      }>(`${pathFor(providerId, '/availability')}?${params}`, { signal });
      assertSession(session);
      return response.availability;
    },
    staleTime: 0,
  });
}
export function useBusinessReviewsQuery(
  providerId: string,
  viewer?: ProfileRef,
) {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: [
      'business-reviews',
      providerId,
      user?.id,
      viewer?.type,
      viewer?.id,
    ],
    enabled:
      isApiEnabled &&
      Boolean(
        providerId && user && user.id !== 'temporary-guest' && getApiToken(),
      ),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const session = sessionFor(user?.id);
      const params = new URLSearchParams({ limit: '20' });
      if (pageParam) params.set('cursor', pageParam);
      if (viewer) {
        params.set('viewerProfileId', viewer.id);
        params.set('viewerProfileType', viewer.type);
      }
      const response = await businessRequest<BusinessReviewsPage>(
        `${pathFor(providerId, '/reviews')}?${params}`,
        { signal },
      );
      assertSession(session);
      return response;
    },
    getNextPageParam: page => page.nextCursor ?? undefined,
  });
}
export function useBusinessAnalyticsQuery(providerId: string, enabled = true) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['business-analytics', providerId, user?.id],
    enabled:
      enabled &&
      isApiEnabled &&
      Boolean(
        providerId && user && user.id !== 'temporary-guest' && getApiToken(),
      ),
    queryFn: async ({ signal }) => {
      const session = sessionFor(user?.id);
      const response = await businessRequest<{ analytics: BusinessAnalytics }>(
        pathFor(providerId, '/analytics'),
        { signal },
      );
      assertSession(session);
      return response.analytics;
    },
  });
}

function useBusinessMutation<V, R>(
  request: (variables: V) => Promise<R>,
  onSuccess?: (data: R, session: Session) => void,
) {
  const { user } = useAuth();
  return useMutation({
    onMutate: () => sessionFor(user?.id),
    mutationFn: async (variables: V) => {
      const session = sessionFor(user?.id);
      const result = await request(variables);
      assertSession(session);
      return result;
    },
    onSuccess: (data, _variables, session) => {
      if (session && sameSession(session)) onSuccess?.(data, session);
    },
    retry: false,
  });
}
export function useSaveBusinessMutation(
  providerId: string,
  viewer?: ProfileRef,
) {
  const client = useQueryClient();
  return useBusinessMutation<boolean, { saved: boolean }>(
    saved =>
      businessRequest(pathFor(providerId, '/save', viewer), {
        method: 'PUT',
        body: JSON.stringify({ saved }),
      }),
    (data, session) => {
      client.setQueriesData(
        { queryKey: ['business-profile', providerId, session.userId] },
        (current: BusinessProfile | undefined) =>
          current
            ? { ...current, viewer: { ...current.viewer, isSaved: data.saved } }
            : current,
      );
      void client.invalidateQueries({
        queryKey: ['business-profile', providerId, session.userId],
      });
      void client.invalidateQueries({
        queryKey: ['saved-businesses', session.userId],
      });
    },
  );
}
export function useReportBusinessMutation(
  providerId: string,
  viewer?: ProfileRef,
) {
  return useBusinessMutation<BusinessReportRequest, { reportId: string }>(
    body =>
      businessRequest(pathFor(providerId, '/reports', viewer), {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  );
}
export function useCreateBusinessReviewMutation(
  providerId: string,
  viewer?: ProfileRef,
) {
  const client = useQueryClient();
  return useBusinessMutation<
    CreateBusinessReviewRequest,
    { review: BusinessReview }
  >(
    body =>
      businessRequest(pathFor(providerId, '/reviews', viewer), {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    () => {
      void client.invalidateQueries({
        queryKey: ['business-profile', providerId],
      });
      void client.invalidateQueries({
        queryKey: ['business-reviews', providerId],
      });
    },
  );
}
export function useUpdateBusinessProfileMutation(providerId: string) {
  const client = useQueryClient();
  return useBusinessMutation<
    UpdateBusinessProfileRequest,
    { business: BusinessProfile }
  >(
    body =>
      businessRequest(pathFor(providerId), {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    () => {
      void client.invalidateQueries({
        queryKey: ['business-profile', providerId],
      });
      void client.invalidateQueries({ queryKey: ['marketplace'] });
      void client.invalidateQueries({
        queryKey: ['provider', 'business', providerId],
      });
    },
  );
}
export function useUpdateBusinessServicesMutation(providerId: string) {
  const client = useQueryClient();
  return useBusinessMutation<
    UpdateBusinessServicesRequest,
    { business: BusinessProfile }
  >(
    body =>
      businessRequest(pathFor(providerId, '/services'), {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    () => {
      void client.invalidateQueries({
        queryKey: ['business-profile', providerId],
      });
      void client.invalidateQueries({
        queryKey: ['business-availability', providerId],
      });
      void client.invalidateQueries({
        queryKey: ['provider', 'business', providerId],
      });
    },
  );
}

/** Customer booking uses the existing persistent booking route with a whole-response deadline. */
export function useCreateBusinessBookingMutation(providerId: string) {
  const client = useQueryClient();
  return useBusinessMutation<
    import('@anticlock/contracts').CreateBookingRequest,
    Booking
  >(
    async body =>
      (
        await businessRequest<{ booking: Booking }>('/v1/bookings', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      ).booking,
    () => {
      void client.invalidateQueries({ queryKey: ['bookings'] });
      void client.invalidateQueries({
        queryKey: ['business-availability', providerId],
      });
    },
  );
}

export function useBusinessServiceCatalogQuery(
  providerKind: string | undefined,
  enabled = true,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['business-service-catalog', user?.id, providerKind],
    enabled:
      enabled &&
      isApiEnabled &&
      Boolean(user && user.id !== 'temporary-guest' && getApiToken()),
    queryFn: async ({ signal }) => {
      const session = sessionFor(user?.id);
      const params = new URLSearchParams();
      if (providerKind) params.set('providerKind', providerKind);
      const response = await businessRequest<{
        data: import('@/shared/api/hooks').ApiServiceCategory[];
      }>(`/v1/catalog/categories?${params}`, { signal });
      assertSession(session);
      return response.data;
    },
  });
}
